import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_FRIEND_CODE} from '../fixtures/supabaseStub';
import {newestCoreSet, setCards} from '../helpers/cardData';
import {binder, COLLECTOR_ID, signInAsCollector, type Entries} from '../helpers/collector';
import {serveFriends, type FriendsWorld, type FriendshipRow, type Player} from '../helpers/friends';

/**
 * Letting friends see your collection (#1045), behind `VITE_SHOW_COLLECTION` and
 * `VITE_SHOW_FRIENDS`, which `playwright.config.ts` pins on: the switch on /account, the
 * Friends list's View binder, and a friend's binder, read only, with You need and They need.
 *
 * The reader is the collector (`helpers/collector.ts`), and every friends and sharing call
 * answers from a world the test keeps (`helpers/friends.ts`), which changes as the database
 * would: the switch's upsert writes it, a cleared collection takes it along, and the two
 * functions answer only for an accepted friend whose switch is on.
 */

const player = (id: string, displayName: string, code: string): Player => ({
  id,
  displayName,
  handle: displayName.toLowerCase().replaceAll(' ', '_'),
  code,
});
const ME = player(COLLECTOR_ID, 'Sapphire Dragon 204', E2E_FRIEND_CODE);
const RUBY = player('e2e-ruby', 'Ruby Hero 042', 'RH42Q7KM');
const AMBER = player('e2e-amber', 'Amber Toy 115', 'AT15W9ZN');
const STEEL = player('e2e-steel', 'Steel Pirate 777', 'SP77M3XT');

const friendship = (other: Player): FriendshipRow => ({
  requester_id: other.id,
  addressee_id: ME.id,
  status: 'accepted',
  created_at: '2026-10-20T10:00:00Z',
  accepted_at: '2026-10-20T10:00:00Z',
});

/*
 * Five of the newest set's cards, each printed in both finishes, hand-counted:
 *
 *   card  you          Ruby         Complete set           Master set
 *   0     normal       foil         -                      You need, They need
 *   1     both         normal       -                      They need
 *   2     -            2 normal     You need               You need
 *   3     normal       -            They need              They need
 *   4     normal       -            They need              They need
 *
 * So Ruby's only copy of card 0 is the foil you lack, and her only copy of card 1 the normal
 * you hold. Every other card of the set is held by neither.
 */
const SET = newestCoreSet();
const BASE = setCards(SET);
const SET_TOTAL = BASE.length;
const [c0, c1, c2, c3, c4] = BASE;
const id = (card: {id: number | string}) => String(card.id);
const MINE: Entries = {
  [id(c0)]: {normal: 1, foil: 0},
  [id(c1)]: {normal: 1, foil: 1},
  [id(c3)]: {normal: 1, foil: 0},
  [id(c4)]: {normal: 1, foil: 0},
};
const RUBYS: Entries = {
  [id(c0)]: {normal: 0, foil: 1},
  [id(c1)]: {normal: 1, foil: 0},
  [id(c2)]: {normal: 2, foil: 0},
};
const names = (...cards: {fullName: string}[]) => cards.map((card) => card.fullName);

/** Ruby and Amber are friends; Ruby shares, Amber doesn't. Steel shares, but is no friend. */
const worldOf = (overrides: Partial<FriendsWorld> = {}): FriendsWorld => ({
  me: ME,
  others: [RUBY, AMBER, STEEL],
  rows: [friendship(RUBY), friendship(AMBER)],
  sharing: [RUBY.id, STEEL.id],
  collections: {[RUBY.id]: RUBYS, [STEEL.id]: RUBYS},
  ...overrides,
});

const RUBY_BINDER = `/browse?binder=${SET}&friend=${RUBY.handle}`;

/** Signs in as the collector holding `entries` (none for null), and serves `world`. */
async function signIn(page: Page, world: FriendsWorld, entries: Entries | null = MINE): Promise<void> {
  await signInAsCollector(page, entries);
  await serveFriends(page, world);
}

const numbers = (page: Page) => page.getByRole('region', {name: 'Collection numbers'});
const shows = (page: Page) => page.getByRole('group', {name: 'Binder shows'});
const tiles = (page: Page) => binder(page).getByTestId('card-tile');
/** The binder's cards by name, in pocket order. */
const tileNames = (page: Page) => tiles(page).evaluateAll((all) => all.map((tile) => tile.getAttribute('aria-label')));
const sharingSwitch = (page: Page) => page.getByRole('switch', {name: 'Let my friends see my collection'});

/** Whether the page asked to change the switch, by its upserts: none until it writes. */
const sharingWrites = (world: FriendsWorld) => world.sharingWrites ?? [];

const percentOfSet = (count: number) => Math.floor((count / SET_TOTAL) * 100);

/** The tab is hidden, then shown again, as when the reader comes back to it. */
async function hideAndShow(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const state of ['hidden', 'visible'] as const) {
      Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
}

test.describe("A friend's collection", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({page: _}, testInfo) => {
    // The docked set panel is the desktop layout; the phone's is tested at phone width below.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
  });

  test('the switch on /account writes each change once, and a reload shows it as saved', async ({page}) => {
    const world = worldOf();
    await signIn(page, world);
    await page.goto('/account');
    await expect(sharingSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(sharingSwitch(page)).toBeEnabled();

    await sharingSwitch(page).click();
    await expect(sharingSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => sharingWrites(world)).toEqual([true]);

    await page.reload();
    await expect(sharingSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(sharingSwitch(page)).toBeEnabled();
    await sharingSwitch(page).click();
    await expect.poll(() => sharingWrites(world)).toEqual([true, false]);
    await expect(sharingSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });

  test('clearing the collection takes the switch with it', async ({page}) => {
    const world = worldOf({mySharing: true});
    await signIn(page, world);
    await page.goto('/account');
    await expect(sharingSwitch(page)).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', {name: 'Clear'}).click();
    await expect(page.getByRole('alert')).toContainText('Sharing with your friends turns off too.');
    await page.getByRole('button', {name: 'Delete my collection'}).click();
    await expect(sharingSwitch(page)).toHaveCount(0);
    await expect.poll(() => world.mySharing).toBeUndefined();
  });

  test('the Friends list offers View binder for a friend who shares, and says Not sharing for one who doesn’t', async ({
    page,
  }) => {
    await signIn(page, worldOf());
    await page.goto('/account');
    const view = page.getByRole('link', {name: 'View binder of Ruby Hero 042'});
    await expect(view).toBeVisible();
    await expect(page.getByText('Not sharing')).toHaveCount(1);
    await expect(page.getByRole('link', {name: /View binder of Amber/})).toHaveCount(0);

    await view.click();
    await expect(page).toHaveURL(new RegExp(`[?&]friend=${RUBY.handle}(&|$)`));
    await expect(page.getByRole('heading', {name: "Ruby Hero 042's binder"})).toBeVisible();
  });

  test("a friend's binder shows their copies, read only, under their name", async ({page}) => {
    await signIn(page, worldOf());
    await page.goto(RUBY_BINDER);
    await expect(page.getByRole('heading', {name: "Ruby Hero 042's binder"})).toBeVisible();
    await expect(page.getByText('Read only', {exact: true})).toBeVisible();
    await expect(page.getByText(`@${RUBY.handle}`)).toBeVisible();

    // Ruby's counts, in her pockets, and no collection actions.
    await expect(binder(page).getByRole('group', {name: '2 normal', exact: true})).toHaveCount(1);
    await expect(binder(page).getByRole('group', {name: '1 foil', exact: true})).toHaveCount(1);
    await expect(page.getByRole('button', {name: 'Collection actions'})).toHaveCount(0);

    // Pointed at, a pocket's stripe stays shut: where counts can change it opens to every
    // finish the card is printed in, so card 2's group would read "2 normal, 0 foil".
    await tiles(page).nth(2).hover();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(binder(page).getByRole('group', {name: '2 normal', exact: true})).toHaveCount(1);
    await expect(binder(page).getByRole('group', {name: '2 normal, 0 foil', exact: true})).toHaveCount(0);
  });

  test('You need and They need list the hand-counted cards, finish by finish under Master set', async ({page}) => {
    await signIn(page, worldOf());
    await page.goto(RUBY_BINDER);
    const youNeed = shows(page).getByRole('button', {name: /^You need/});
    const theyNeed = shows(page).getByRole('button', {name: /^They need/});
    await expect(youNeed).toHaveAccessibleName('You need 1');
    await expect(theyNeed).toHaveAccessibleName('They need 2');

    await youNeed.click();
    await expect(page).toHaveURL(/[?&]owned=you-need(&|$)/);
    await expect.poll(() => tileNames(page)).toEqual(names(c2));
    await theyNeed.click();
    await expect.poll(() => tileNames(page)).toEqual(
      names(c3, c4),
    );

    // Master set asks finish by finish: Ruby's only foil of card 0 is one you lack, and your
    // foil of card 1 is one she lacks.
    await numbers(page).getByRole('button', {name: /^Master set/}).click();
    await expect(youNeed).toHaveAccessibleName('You need 2');
    await expect(theyNeed).toHaveAccessibleName('They need 4');
    await expect.poll(() => tileNames(page)).toEqual(
      names(c0, c1, c3, c4),
    );
    await youNeed.click();
    await expect.poll(() => tileNames(page)).toEqual(
      names(c0, c2),
    );
  });

  test("the set panel shows the friend's percentage, with yours under it", async ({page}) => {
    await signIn(page, worldOf());
    await page.goto(RUBY_BINDER);
    const complete = numbers(page).getByRole('button', {name: /^Complete set/});
    await expect(complete).toContainText(`${percentOfSet(3)}%`);
    await expect(complete).toContainText(new RegExp(`You${percentOfSet(4)}%$`));
  });

  test("a link to someone who doesn't share says so and shows none of their cards", async ({page}) => {
    await signIn(page, worldOf());
    // Steel shares, but not with the reader, who isn't his friend; Amber is, and doesn't share.
    for (const other of [STEEL, AMBER]) {
      await page.goto(`/browse?binder=${SET}&friend=${other.handle}`);
      await expect(page.getByText(`${other.displayName} doesn't share their collection with you.`)).toBeVisible();
      await expect(tiles(page)).toHaveCount(0);
    }
  });

  test('a friend who stops sharing drops out once the tab is shown again', async ({page}) => {
    const world = worldOf();
    await signIn(page, world);
    await page.goto(RUBY_BINDER);
    await expect(page.getByText('Read only', {exact: true})).toBeVisible();

    world.sharing = [];
    await hideAndShow(page);
    await expect(page.getByText("Ruby Hero 042 doesn't share their collection with you.")).toBeVisible();
    await expect(tiles(page)).toHaveCount(0);
  });

  test('Back to your binder drops the friend and keeps the scope', async ({page}) => {
    await signIn(page, worldOf());
    await page.goto(`${RUBY_BINDER}&owned=they-need`);
    await page.getByRole('button', {name: /Back to your binder/}).click();
    await expect(page).toHaveURL(new RegExp(`\\?binder=${SET}$`));
    await expect(page.getByRole('heading', {name: /binder$/})).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Collection actions'})).toBeVisible();
  });

  test("a reader with no collection opens a friend's binder with no compare row, and Back to browse leaves it", async ({
    page,
  }) => {
    await signIn(page, worldOf(), null);
    await page.goto(RUBY_BINDER);
    await expect(page.getByRole('heading', {name: "Ruby Hero 042's binder"})).toBeVisible();
    await expect(binder(page)).toBeVisible();
    await expect(shows(page).getByRole('button', {name: /need/})).toHaveCount(0);

    await page.getByRole('button', {name: /Back to browse/}).click();
    await expect(binder(page)).toHaveCount(0);
    expect(new URL(page.url()).search).toBe('');
  });
});

test.describe("A friend's collection (phone width)", () => {
  // Runs on every project: the phone layout is chosen by width, so a forced viewport renders it anywhere.
  test('the banner says how many of their cards you need, goes back as Yours, and the Binder sheet offers You need', async ({
    page,
  }) => {
    await page.setViewportSize({width: 390, height: 844});
    await signIn(page, worldOf());
    await page.goto(RUBY_BINDER);
    await expect(page.getByText('Read only · you need 1 of theirs')).toBeVisible();

    await page.getByRole('button', {name: /^Filters/}).click();
    const sheet = page.getByRole('dialog', {name: 'Binder'});
    await sheet.getByRole('button', {name: 'You need 1'}).click();
    await sheet.getByRole('button', {name: 'Apply'}).click();
    await expect(page).toHaveURL(/[?&]owned=you-need(&|$)/);
    await expect.poll(() => tileNames(page)).toEqual(names(c2));

    await page.getByRole('button', {name: /Yours/}).click();
    await expect(page).toHaveURL(new RegExp(`\\?binder=${SET}$`));
  });
});
