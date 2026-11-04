import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {newestCoreSet, setCards, setPrintings} from '../helpers/cardData';
import {binder, COLLECTOR_ID, shelf, shelfCover, signInAsCollector, type Entries} from '../helpers/collector';
import {binderRow, failBinderReads, serveBinders, type BindersWorld} from '../helpers/binders';
import {serveFriends, type FriendsWorld, type Player} from '../helpers/friends';
import {E2E_FRIEND_CODE} from '../fixtures/supabaseStub';

/**
 * Binders of your own: a link that opens one, the set picker's Binders tab, a binder that
 * isn't on your shelf, and the shelf Collection opens (#1074), where they move and go.
 *
 * The reader is the collector (`helpers/collector.ts`), and every binder read answers from a
 * world the test keeps (`helpers/binders.ts`). The binders are drawn from the card data, not
 * hardcoded, so the suite follows the data when a set graduates.
 */

const SET = newestCoreSet();

const isAmber = (card: {color?: string}) => (card.color ?? '').split('-').includes('Amber');

/**
 * The newest set's Amber cards, and their printings that are pockets of their own
 * (`setPrintings`): what the "Amber vines" binder holds.
 */
const AMBER_BASE = setCards(SET).filter(isAmber);
const AMBER_VARIANT_IDS = new Set(AMBER_BASE.flatMap((card) => (card.variants ?? []).map((v) => String(v.id))));
const AMBER_PRINTINGS = setPrintings(SET).filter((printing) => AMBER_VARIANT_IDS.has(printing.id));
const AMBER_TOTAL = AMBER_BASE.length + AMBER_PRINTINGS.length;

/** Two of its Amber cards, in one finish: so Complete counts two and Master none. */
const HELD = AMBER_BASE.slice(0, 2);
const ENTRIES: Entries = Object.fromEntries(HELD.map((card) => [String(card.id), {normal: 1, foil: 0}]));

/** A share of a binder as the panel writes it: a whole percent, rounded down (`percentOf`). */
const percentOfBinder = (count: number) => Math.floor((count / AMBER_TOTAL) * 100);

const AMBER = binderRow({id: 'b-amber', name: 'Amber', scope: 'all', rules: 'ink=Amber', place: 0});
const VINES = binderRow({id: 'b-vines', name: 'Amber vines', scope: SET, rules: 'ink=Amber', place: 1});
const EPICS = binderRow({id: 'b-epics', name: 'Epics', scope: 'all', rules: 'rarity=Epic', place: 2});

const worldOf = (): BindersWorld => ({rows: [AMBER, VINES, EPICS]});

/** Signs in as the collector holding the two Amber cards, and serves the shelf. */
async function signIn(page: Page, world: BindersWorld = worldOf()): Promise<void> {
  await signInAsCollector(page, ENTRIES);
  await serveBinders(page, world);
}

const numbers = (page: Page) => page.getByRole('region', {name: 'Collection numbers'});
const tiles = (page: Page) => binder(page).getByTestId('card-tile');
const tileNames = (page: Page) => tiles(page).evaluateAll((all) => all.map((tile) => tile.getAttribute('aria-label')));
const setButton = (page: Page) => page.getByRole('button', {name: /^Binder set/});
const binderButton = (page: Page) => page.getByRole('button', {name: /^Binder: /});

/**
 * What a trigger's name says, however it is drawn: a phone's row button adds its two percentages
 * after the words (`RowLabel`), so each case matches the words and what may follow.
 */
const named = (words: string) => new RegExp(`^${words.replaceAll('·', '\\u00b7')}(,|$)`);

/** Opens `url` and waits for the binder, past the first visit's chunk download on a cold dev server. */
async function openAt(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(binder(page)).toBeVisible({timeout: 20_000});
}

/**
 * Opens the picker's Binders tab from `trigger`, the button the test expects to name the open
 * choice. Each caller names it: the binder can show a moment before the toolbar names it, so a
 * check of which button is there yet can pick the one that is about to go.
 */
async function openBindersTab(trigger: Locator): Promise<void> {
  await trigger.click();
  const menu = trigger.page().getByRole('dialog', {name: 'Binder set'});
  await menu.getByRole('button', {name: 'Binders', exact: true}).click();
}

const binderOption = (page: Page, name: string) =>
  page.getByRole('listbox', {name: 'Binders'}).getByRole('option', {name: new RegExp(`^${name}(,|$)`)});

test.describe('a binder of your own', () => {
  test('a link opens it: its name on the button, its own numbers, and only its cards', async ({page}, testInfo) => {
    // The panel's numbers are the desktop layout: a phone's live on the binder's inside cover.
    const phone = testInfo.project.name.startsWith('mobile-');
    await signIn(page);
    await openAt(page, `/browse?binder=${SET}&custom=${VINES.id}`);

    await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Amber vines'));
    if (!phone) {
      const complete = numbers(page).getByRole('button', {name: /^Complete binder/});
      await expect(complete).toContainText(`${percentOfBinder(HELD.length)}%`);
      await expect(complete).toHaveAccessibleName(new RegExp(`${HELD.length} of ${AMBER_TOTAL} cards`));
    }
    // Its first pockets are the set's Amber cards in collector order, no other ink among them.
    await expect.poll(() => tileNames(page)).toEqual(expect.arrayContaining([AMBER_BASE[0].fullName]));
    const shown = new Set(await tileNames(page));
    const others = setCards(SET).filter((card) => !isAmber(card) && shown.has(card.fullName));
    expect(others.map((card) => card.fullName)).toEqual([]);
  });

  test('the Binders tab lists My collection and your binders, and opens one with the filters cleared', async ({page}) => {
    await signIn(page);
    await openAt(page, `/browse?binder=${SET}&ink=Amber&q=${encodeURIComponent(HELD[0].fullName)}`);

    await openBindersTab(setButton(page));
    const rows = page.getByRole('listbox', {name: 'Binders'}).getByRole('option');
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0)).toHaveAccessibleName('All your binders, 4 binders');
    await expect(rows.nth(1)).toHaveAccessibleName(/^My collection/);
    await expect(binderOption(page, 'Amber vines')).toHaveAccessibleName(
      `Amber vines, ${percentOfBinder(HELD.length)}% complete`,
    );

    await binderOption(page, 'Epics').click();
    await expect(page).toHaveURL(/[?&]custom=b-epics(&|$)/);
    // Its Sets, with the page's ink filter and search gone.
    await expect(page).toHaveURL(/[?&]binder=all(&|$)/);
    await expect(page).not.toHaveURL(/[?&](ink|q)=/);
    await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Epics'));
  });

  test('My collection closes the binder, dropping it from the address', async ({page}) => {
    await signIn(page);
    await openAt(page, `/browse?binder=all&custom=${AMBER.id}`);

    await openBindersTab(binderButton(page));
    await binderOption(page, 'My collection').click();
    await expect(page).not.toHaveURL(/[?&]custom=/);
    await expect(page).toHaveURL(/[?&]binder=all(&|$)/);
    // The button names a scope again, not a binder.
    await expect(binderButton(page)).toHaveCount(0);
    await expect(setButton(page)).toHaveAccessibleName(/the whole collection|Whole collection/);
  });

  test('a set picked inside it keeps the binder: "Amber · Set 12" over the set', async ({page}) => {
    await signIn(page);
    await openAt(page, `/browse?binder=all&custom=${AMBER.id}`);

    await binderButton(page).click();
    await page.getByRole('dialog', {name: 'Binder set'}).getByRole('button', {name: 'Standard', exact: true}).click();
    await page
      .getByRole('listbox', {name: 'Standard sets'})
      .getByRole('option', {name: new RegExp(`^Set ${SET},`)})
      .click();

    await expect(page).toHaveURL(new RegExp(`[?&]binder=${SET}(&|$)`));
    await expect(page).toHaveURL(/[?&]custom=b-amber(&|$)/);
    // The toolbar's button names the binder and the set; the panel's adds the set's name.
    await expect(binderButton(page)).toHaveAccessibleName(named(`Binder: Amber · Set ${SET}`));
    await expect.poll(() => tileNames(page)).toEqual(expect.arrayContaining([AMBER_BASE[0].fullName]));
  });

  test('a filter inside it narrows the binder, and a reload keeps both', async ({page}) => {
    await signIn(page);
    const held = HELD[0];
    await openAt(page, `/browse?binder=${SET}&custom=${VINES.id}&q=${encodeURIComponent(held.fullName)}`);
    await expect.poll(() => tileNames(page)).toEqual([held.fullName]);

    await page.reload();
    await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Amber vines'));
    await expect.poll(() => tileNames(page)).toEqual([held.fullName]);
  });

  test("a binder that isn't on your shelf says so, and Go to your binders opens the shelf", async ({page}) => {
    await signIn(page);
    await page.goto('/browse?binder=all&custom=someone-elses');

    await expect(page.getByText("This binder isn't on your shelf.")).toBeVisible({timeout: 20_000});
    await expect(binder(page)).toHaveCount(0);
    await expect(numbers(page)).toHaveCount(0);

    await page.getByRole('button', {name: 'Go to your binders'}).click();
    await expect(page).not.toHaveURL(/[?&]custom=/);
    await expect(page).toHaveURL(/[?&]binder=shelf(&|$)/);
    await expect(shelfCover(page, 'Amber')).toBeVisible();
  });

  test.describe('whose read fails', () => {
    // The read's own log: the page says so too, which is what this checks.
    test.use({expectedConsoleErrors: [/^\[collection\] read binders failed:/]});

    test('says so in the binder, and Try again reads again', async ({page}) => {
      await signInAsCollector(page, ENTRIES);
      await failBinderReads(page);
      await page.goto(`/browse?binder=all&custom=${AMBER.id}`);

      await expect(page.getByRole('alert')).toContainText("Couldn't load your binders.", {timeout: 20_000});
      await serveBinders(page, worldOf());
      await page.getByRole('button', {name: 'Try again'}).click();
      await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Amber'));
    });
  });
});

/** The shelf's covers by their binders' names, in the order drawn. */
const coverNames = (page: Page) =>
  shelf(page)
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.querySelector(':scope > :not([aria-hidden])')?.textContent?.split(',')[0]));

/** A binder's ⋯ on its cover. */
const actionsOf = (page: Page, name: string) =>
  shelf(page)
    .getByRole('listitem')
    .filter({has: page.getByRole('link', {name: new RegExp(`^${name},`)})})
    .getByRole('button', {name: 'Actions'});

const pressCollection = (page: Page) => page.getByRole('button', {name: 'Show my collection'}).click();

test.describe('the binder shelf', () => {
  test('Collection opens it: its heading and count, My collection, then your binders in place order', async ({page}) => {
    await signIn(page);
    await page.goto('/browse');
    await pressCollection(page);

    await expect(page).toHaveURL(/[?&]binder=shelf(&|$)/);
    await expect(page.getByRole('heading', {name: 'Your binders'})).toBeVisible({timeout: 20_000});
    await expect(page.getByText(/^4 binders$/)).toHaveCount(1);
    await expect.poll(() => coverNames(page)).toEqual(['My collection', 'Amber', 'Amber vines', 'Epics']);
    // Amber vines, hand-counted: its set's Amber cards and their printings, two of them held.
    await expect(shelfCover(page, 'Amber vines')).toHaveAccessibleName(
      new RegExp(`^Amber vines, Amber ink · .+, ${percentOfBinder(HELD.length)}%, ${HELD.length} of ${AMBER_TOTAL} cards$`),
    );
  });

  test('a cover opens its binder with the filters cleared, and Back returns to the shelf', async ({page}) => {
    await signIn(page);
    await page.goto('/browse?binder=shelf&ink=Steel');
    await shelfCover(page, 'Epics').click({timeout: 20_000});

    await expect(page).toHaveURL(/[?&]custom=b-epics(&|$)/);
    await expect(page).not.toHaveURL(/[?&]ink=/);
    await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Epics'));

    await page.goBack();
    await expect(page).toHaveURL(/[?&]binder=shelf(&|$)/);
    await expect(shelfCover(page, 'Epics')).toBeVisible();
  });

  test('with a Set filter on, Collection opens My collection at that set', async ({page}) => {
    await signIn(page);
    await page.goto(`/browse?set=${SET}`);
    await pressCollection(page);

    await expect(page).toHaveURL(new RegExp(`[?&]binder=${SET}(&|$)`));
    await expect(binder(page)).toBeVisible({timeout: 20_000});
    await expect(page).not.toHaveURL(/[?&]custom=/);
  });

  test("a collector with no copy and no binder gets the empty start; one with a binder and no copy gets the shelf", async ({
    page,
  }) => {
    await signInAsCollector(page, {});
    const world: BindersWorld = {rows: []};
    await serveBinders(page, world);
    await page.goto('/browse');
    await pressCollection(page);
    await expect(page).toHaveURL(/[?&]binder=all(&|$)/, {timeout: 20_000});
    await expect(binder(page)).toBeVisible();

    world.rows = [AMBER];
    await page.goto('/browse');
    await pressCollection(page);
    await expect(shelfCover(page, 'Amber')).toBeVisible({timeout: 20_000});
    await expect(page).toHaveURL(/[?&]binder=shelf(&|$)/);
  });

  test('Move later swaps two covers after one move_binder call, and focus stays on its ⋯', async ({page}) => {
    const world = worldOf();
    await signIn(page, world);
    await page.goto('/browse?binder=shelf');

    await actionsOf(page, 'Amber').click({timeout: 20_000});
    await page.getByRole('menuitem', {name: 'Move later'}).click();
    await expect.poll(() => coverNames(page)).toEqual(['My collection', 'Amber vines', 'Amber', 'Epics']);
    expect(world.calls).toEqual([{what: 'move', id: AMBER.id, earlier: false}]);
    await expect(actionsOf(page, 'Amber')).toBeFocused();
  });

  test('Delete binder asks first, then sends one DELETE, and the cover goes', async ({page}) => {
    const world = worldOf();
    await signIn(page, world);
    await page.goto('/browse?binder=shelf');

    await actionsOf(page, 'Epics').click({timeout: 20_000});
    await page.getByRole('menuitem', {name: 'Delete binder'}).click();
    const confirm = page.getByRole('dialog', {name: 'Delete binder'});
    await expect(confirm.getByRole('heading', {name: 'Delete Epics?'})).toBeVisible();
    expect(world.calls).toEqual([]);

    await confirm.getByRole('button', {name: 'Delete binder'}).click();
    await expect.poll(() => coverNames(page)).toEqual(['My collection', 'Amber', 'Amber vines']);
    expect(world.calls).toEqual([{what: 'delete', id: EPICS.id}]);
    await expect(confirm).toHaveCount(0);
    // The binder before it, as none comes after.
    await expect(shelfCover(page, 'Amber vines')).toBeFocused();
  });

  test('All your binders in the Binders tab opens the shelf', async ({page}) => {
    await signIn(page);
    await openAt(page, '/browse?binder=all');

    await openBindersTab(setButton(page));
    await page.getByRole('listbox', {name: 'Binders'}).getByRole('option', {name: /^All your binders/}).click();
    await expect(page).toHaveURL(/[?&]binder=shelf(&|$)/);
    await expect(shelfCover(page, 'Epics')).toBeVisible();
  });

  test("on a phone, two covers across, each binder's ⋯ shown, and the title in the binder row", async ({page}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), "A phone's shelf");
    await signIn(page);
    await page.goto('/browse?binder=shelf');

    const covers = shelf(page).getByRole('listitem');
    await expect(covers).toHaveCount(4, {timeout: 20_000});
    const [first, second, third] = await Promise.all([0, 1, 2].map(async (at) => (await covers.nth(at).boundingBox())!));
    expect(Math.abs(second.y - first.y), 'two across').toBeLessThanOrEqual(1);
    expect(third.y, 'the third on the next row').toBeGreaterThan(first.y + first.height - 1);
    for (const name of ['Amber', 'Amber vines', 'Epics']) await expect(actionsOf(page, name)).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('phone-binder-row').getByRole('heading', {name: 'Your binders'})).toBeVisible();
  });
});

test.describe("a friend's binder", () => {
  const ME: Player = {id: COLLECTOR_ID, handle: 'sapphire_dragon_204', displayName: 'Sapphire Dragon 204', code: E2E_FRIEND_CODE};
  const RUBY: Player = {id: 'e2e-ruby', handle: 'ruby_hero_042', displayName: 'Ruby Hero 042', code: 'RH42Q7KM'};
  const FRIENDS: FriendsWorld = {
    me: ME,
    others: [RUBY],
    rows: [
      {
        requester_id: RUBY.id,
        addressee_id: ME.id,
        status: 'accepted',
        created_at: '2026-10-20T10:00:00Z',
        accepted_at: '2026-10-20T10:00:00Z',
      },
    ],
    sharing: [RUBY.id],
    collections: {[RUBY.id]: ENTRIES},
  };

  test('shows none of your binders: the param goes and the picker has no Binders tab', async ({page}) => {
    await signIn(page);
    await serveFriends(page, FRIENDS);
    await openAt(page, `/browse?binder=${SET}&friend=${RUBY.handle}&custom=${AMBER.id}`);

    await expect(page).not.toHaveURL(/[?&]custom=/);
    await setButton(page).click();
    await expect(page.getByRole('dialog', {name: 'Binder set'}).getByRole('button', {name: 'Binders'})).toHaveCount(0);
  });
});
