import AxeBuilder from '@axe-core/playwright';
import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_FRIEND_CODE} from '../fixtures/supabaseStub';
import {newestCoreSet, setCards} from '../helpers/cardData';
import {binder, COLLECTOR_ID, signInAsCollector, type Entries} from '../helpers/collector';
import {serveFriends, type FriendsWorld, type FriendshipRow, type Player} from '../helpers/friends';

/**
 * Friends who have it (#1055), behind `VITE_SHOW_COLLECTION` and `VITE_SHOW_FRIENDS`, which
 * `playwright.config.ts` pins on: the card window's count of the sharing friends who hold the
 * card in a finish the reader lacks, the dialog (a sheet on a phone) it opens, and a row of it
 * opening that friend's binder at the card.
 *
 * The reader is the collector (`helpers/collector.ts`); every friends call answers from a world
 * the test keeps (`helpers/friends.ts`), as the database would.
 */

const player = (id: string, displayName: string, code: string): Player => ({
  id,
  displayName,
  handle: displayName.toLowerCase().replaceAll(' ', '_'),
  code,
});
const ME = player(COLLECTOR_ID, 'Sapphire Dragon 204', E2E_FRIEND_CODE);
const RUBY = player('e2e-ruby', 'Ruby Hero 042', 'RH42Q7KM');
const EMERALD = player('e2e-emerald', 'Emerald Fairy 913', 'EF13W9ZN');
const AMBER = player('e2e-amber', 'Amber Toy 115', 'AT15W9ZN');

const friendship = (other: Player): FriendshipRow => ({
  requester_id: other.id,
  addressee_id: ME.id,
  status: 'accepted',
  created_at: '2026-10-20T10:00:00Z',
  accepted_at: '2026-10-20T10:00:00Z',
});

/*
 * Hand-counted, on the newest set's cards, each printed in both finishes:
 *
 *   card    you      Ruby       Emerald            Complete set           Master set
 *   FIRST   normal   foil       -                  no one                 Ruby: 1 foil (gold)
 *   DEEP    -        2 normal   3 normal, 1 foil   Emerald 3 + 1, Ruby 2  the same
 *
 * DEEP sits past the binder's first spread and a phone's first pages, so a friend's binder
 * opened at it shows other pockets than one opened at its start. Amber is a friend who doesn't
 * share.
 */
const SET = newestCoreSet();
const BASE = setCards(SET);
const FIRST = BASE[0];
/** A card with one pocket in the binder: no other printing goes by its name. */
const DEEP = BASE.slice(40).find((card) => !card.variants?.length && BASE.filter((each) => each.fullName === card.fullName).length === 1)!;
const id = (card: {id: number | string}) => String(card.id);
const MINE: Entries = {[id(FIRST)]: {normal: 1, foil: 0}};
const RUBYS: Entries = {[id(FIRST)]: {normal: 0, foil: 1}, [id(DEEP)]: {normal: 2, foil: 0}};
const EMERALDS: Entries = {[id(DEEP)]: {normal: 3, foil: 1}};

const worldOf = (): FriendsWorld => ({
  me: ME,
  others: [RUBY, EMERALD, AMBER],
  rows: [friendship(RUBY), friendship(EMERALD), friendship(AMBER)],
  sharing: [RUBY.id, EMERALD.id],
  collections: {[RUBY.id]: RUBYS, [EMERALD.id]: EMERALDS},
});

async function signIn(page: Page, world: FriendsWorld = worldOf()): Promise<void> {
  await signInAsCollector(page, MINE);
  await serveFriends(page, world);
}

/** A card's pocket on show: a page turning draws the pages it leaves too, inert. */
const tile = (page: Page, card: {fullName: string}) =>
  binder(page).locator(`[data-testid="card-tile"][aria-label="${card.fullName}"]:not([inert] *)`);
const modal = (page: Page) => page.getByTestId('card-overview-modal');
const friendsSlot = (page: Page) => page.getByTestId('card-overview-friends-slot');
const whoHasIt = (page: Page) => page.getByRole('dialog', {name: 'Friends who have it'});
const rows = (dialog: Locator) => dialog.getByRole('listitem');

/** Turns to the binder's spread or page `to`: by its arrow on a computer, by the page map on a phone. */
async function turnTo(page: Page, to: number): Promise<void> {
  const next = binder(page).getByRole('button', {name: 'Next spread'});
  if ((await next.count()) > 0) return next.last().click();
  return binder(page).getByRole('navigation', {name: 'Binder pages'}).getByRole('button', {name: new RegExp(`^Page ${to} of`)}).click();
}

/** Opens the binder on the card's set, and the card's window from its pocket. */
async function openWindow(page: Page, card: {fullName: string}): Promise<void> {
  await page.goto(`/browse?binder=${SET}`);
  const pocket = tile(page, card);
  await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
  // A card past the first spread, or a phone's first pages.
  for (let shown = 1; !(await pocket.isVisible()) && shown < 9; shown++) await turnTo(page, shown + 1);
  await pocket.click();
  await expect(modal(page).locator('h1')).toHaveText(card.fullName);
}

test.describe('Friends who have it', () => {
  test('the window counts the friends who have the card, and the dialog lists them, most copies first', async ({page}) => {
    await signIn(page);
    await openWindow(page, DEEP);
    const count = friendsSlot(page).getByRole('button', {name: '2 friends have it'});
    await expect(count).toBeVisible();
    await count.click();

    const dialog = whoHasIt(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("You're missing it")).toBeVisible();
    await expect(rows(dialog)).toHaveCount(2);
    await expect(rows(dialog).nth(0).getByRole('link')).toHaveAccessibleName(
      `${EMERALD.displayName}: 3 normal, 1 foil. Open their binder`,
    );
    await expect(rows(dialog).nth(1).getByRole('link')).toHaveAccessibleName(
      `${RUBY.displayName}: 2 normal, 0 foil. Open their binder`,
    );
    await expect(dialog.getByText("1 friend doesn't share their collection, so they aren't counted.")).toBeVisible();
  });

  test('a row opens that friend\'s binder at the card, and the window closes', async ({page}) => {
    await signIn(page);
    await openWindow(page, DEEP);
    await friendsSlot(page).getByRole('button', {name: '2 friends have it'}).click();
    await rows(whoHasIt(page)).nth(1).getByRole('link').click();

    await expect(page).toHaveURL(new RegExp(`binder=${SET}&friend=${RUBY.handle}$`));
    await expect(modal(page)).toHaveCount(0);
    await expect(page.getByText(RUBY.displayName).first()).toBeVisible();
    await expect(tile(page, DEEP)).toBeVisible();
    // Opened at the card, not at the binder's start.
    await expect(tile(page, FIRST)).toBeHidden();
  });

  test('under Master set, a foil a friend has of a card you hold in normal shows in gold, and under Complete set not at all', async ({page}, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile-'), "the headline is picked on a phone's cover; the count is the same");
    await signIn(page);
    await openWindow(page, FIRST);
    await expect(modal(page).getByTestId('card-overview-copies-slot').getByRole('group')).toBeVisible();
    await expect(friendsSlot(page).getByRole('button')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);

    await page.getByRole('region', {name: 'Collection numbers'}).getByRole('button', {name: /^Master set/}).click();
    await tile(page, FIRST).click();
    const count = friendsSlot(page).getByRole('button', {name: '1 friend has the foil'});
    await expect(count).toBeVisible();
    const ground = await count.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(ground).toContain('linear-gradient');
    await count.click();
    const dialog = whoHasIt(page);
    await expect(dialog.getByText('You have 1 normal · missing the foil')).toBeVisible();
    await expect(rows(dialog)).toHaveCount(1);
    await expect(rows(dialog).getByRole('link')).toHaveAccessibleName(`${RUBY.displayName}: 1 foil. Open their binder`);
  });

  test('Escape closes the dialog alone, and from the keyboard the count is a stop in the window', async ({page}, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile-'), 'a keyboard and Escape are a computer\'s');
    await signIn(page);
    await openWindow(page, DEEP);
    const count = friendsSlot(page).getByRole('button', {name: '2 friends have it'});
    await expect(count).toBeVisible();
    // The dialog moves focus to its × 100ms after opening; Tab from there until the count has it.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 150)));
    for (let tabs = 0; tabs < 30 && !(await count.evaluate((el) => el === document.activeElement)); tabs++) {
      await page.keyboard.press('Tab');
    }
    await expect(count).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = whoHasIt(page);
    await expect(dialog).toBeVisible();
    expect((await new AxeBuilder({page}).include('[role="dialog"][aria-label="Friends who have it"]').analyze()).violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    await expect(count).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
  });

  test('with no friend sharing, the window shows no count and reads no collection', async ({page}) => {
    const world = {...worldOf(), sharing: []};
    let collectionReads = 0;
    page.on('request', (request) => {
      if (request.url().includes('rpc/friend_collections')) collectionReads++;
    });
    await signIn(page, world);
    const sharingRead = page.waitForResponse((response) => response.url().includes('rpc/shared_friends'));
    await openWindow(page, DEEP);
    await expect(modal(page).getByTestId('card-overview-copies-slot').getByRole('group')).toBeVisible();
    await sharingRead;
    await expect(friendsSlot(page).getByRole('button')).toHaveCount(0);
    expect(collectionReads).toBe(0);
  });
});
