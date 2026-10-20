import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {test, expect} from '../fixtures';
import {E2E_FRIEND_CODE} from '../fixtures/supabaseStub';
import {serveFriends, type FriendsWorld, type FriendshipRow, type Player} from '../helpers/friends';
import {signInAs} from '../helpers/session';

/**
 * The Friends section on /account (#852), behind `VITE_SHOW_FRIENDS`, which
 * `playwright.config.ts` pins on together with the accounts flag it requires.
 *
 * The player is signed in from a stored session (`helpers/session.ts`), and every friends
 * call answers from a world the test keeps (`helpers/friends.ts`), which changes the way the
 * database would: a send adds a waiting row, an accept turns it into a friendship. So each
 * test acts on the page and then reads what the page loads back.
 */

const player = (id: string, displayName: string, code: string): Player => ({
  id,
  displayName,
  handle: displayName.toLowerCase().replaceAll(' ', '_'),
  code,
});
const ME = player('e2e-sapphire', 'Sapphire Dragon 204', E2E_FRIEND_CODE);
const RUBY = player('e2e-ruby', 'Ruby Hero 042', 'RH42Q7KM');
const STEEL = player('e2e-steel', 'Steel Pirate 777', 'SP77M3XT');
const AMBER = player('e2e-amber', 'Amber Toy 115', 'AT15W9ZN');

const row = (from: Player, to: Player, status: FriendshipRow['status']): FriendshipRow => ({
  requester_id: from.id,
  addressee_id: to.id,
  status,
  created_at: '2026-10-20T10:00:00Z',
  accepted_at: status === 'accepted' ? '2026-10-20T10:00:00Z' : null,
});

const worldOf = (rows: FriendshipRow[]): FriendsWorld => ({me: ME, others: [RUBY, STEEL, AMBER], rows});

/** The Friends card: the page's section whose h2 reads "Friends". */
const friendsSection = (page: Page) =>
  page.locator('section').filter({has: page.getByRole('heading', {level: 2, name: 'Friends', exact: true})});

/** Signs in, serves `world`, and opens /account once the section has loaded. */
async function openAccount(page: Page, world: FriendsWorld): Promise<void> {
  await signInAs(page, ME.id);
  await serveFriends(page, world);
  await page.goto('/account');
  await expect(friendsSection(page).getByText('ABCD-2345')).toBeVisible();
}

async function sendCode(page: Page, typed: string): Promise<void> {
  await page.getByLabel('Add a friend').fill(typed);
  await page.getByRole('button', {name: 'Send request'}).click();
}

test.describe('Friends', () => {
  test("/account shows the player's friend code, and no one yet", async ({page}) => {
    await openAccount(page, worldOf([]));
    await expect(friendsSection(page).getByText("No friends yet. Share your code, or enter a friend's.")).toBeVisible();
  });

  test("a friend's code sends a request, which shows under Sent with their name", async ({page}) => {
    await openAccount(page, worldOf([]));
    // Typed as a player might: lower case, with the hyphen.
    await sendCode(page, 'sp77-m3xt');

    const section = friendsSection(page);
    await expect(section.getByRole('status')).toHaveText('Request sent to Steel Pirate 777.');
    await expect(section.getByRole('heading', {name: 'Sent (1)'})).toBeVisible();
    await expect(section.getByText('Steel Pirate 777', {exact: true})).toBeVisible();
    await expect(page.getByLabel('Add a friend')).toHaveValue('');
  });

  test('accepting a request moves it to Your friends', async ({page}) => {
    await openAccount(page, worldOf([row(RUBY, ME, 'pending')]));
    await page.getByRole('button', {name: 'Accept request from Ruby Hero 042'}).click();

    const section = friendsSection(page);
    await expect(section.getByRole('heading', {name: 'Your friends (1)'})).toBeVisible();
    await expect(section.getByRole('button', {name: 'Remove Ruby Hero 042'})).toBeVisible();
    await expect(section.getByRole('heading', {name: /^Requests/})).toHaveCount(0);
  });

  test('a code no one has says so, and changes nothing', async ({page}) => {
    const world = worldOf([]);
    await openAccount(page, world);
    await sendCode(page, 'M3PZ-8RQT');

    await expect(friendsSection(page).getByRole('alert')).toHaveText(
      'No one has that friend code. Check it with your friend.',
    );
    await expect(page.getByLabel('Add a friend')).toHaveValue('M3PZ-8RQT');
    expect(world.rows).toEqual([]);
  });

  test('/account with requests, sent requests and friends has no axe violations', async ({page}, testInfo) => {
    // Desktop only, as accessibility.spec.ts's audits are.
    test.skip(testInfo.project.name.startsWith('mobile-'), 'axe audits run on the desktop projects');
    await openAccount(page, worldOf([row(RUBY, ME, 'pending'), row(ME, STEEL, 'pending'), row(ME, AMBER, 'accepted')]));
    await expect(friendsSection(page).getByRole('heading', {name: 'Your friends (1)'})).toBeVisible();

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });
});
