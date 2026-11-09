import type {Locator, Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {test, expect} from '../fixtures';
import {newestCoreSet, setCards, setPrintings} from '../helpers/cardData';
import {binder, COLLECTOR_ID, shelf, shelfCover, signInAsCollector, type Entries} from '../helpers/collector';
import {binderRow, failBinderReads, serveBinders, type BindersWorld} from '../helpers/binders';
import {serveFriends, type FriendsWorld, type Player} from '../helpers/friends';
import {E2E_FRIEND_CODE} from '../fixtures/supabaseStub';

/**
 * Binders of your own: a link that opens one, the set picker's Binders tab, a binder that
 * isn't on your shelf, the shelf Collection opens (#1074), where they move and go, and the New
 * binder window that makes and changes them (#1075).
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

/** What axe finds on the whole page: WCAG A and AA, and its best practices. */
const violations = async (page: Page) => (await new AxeBuilder({page}).analyze()).violations;

/** The audits run on the desktop projects, as `accessibility.spec.ts`'s do. */
const DESKTOP_AUDIT = 'Audited on the desktop projects';
const isPhone = (projectName: string) => projectName.startsWith('mobile-');

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
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(0)).toHaveAccessibleName('All your binders, 4 binders');
    await expect(rows.nth(1)).toHaveAccessibleName(/^My collection/);
    await expect(binderOption(page, 'Amber vines')).toHaveAccessibleName(
      `Amber vines, ${percentOfBinder(HELD.length)}% complete`,
    );
    await expect(rows.nth(5)).toHaveAccessibleName('New binder');

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

  test('the shelf has no axe violations, nor with a ⋯ menu or Delete binder open', async ({page}, testInfo) => {
    test.skip(isPhone(testInfo.project.name), DESKTOP_AUDIT);
    await signIn(page);
    await page.goto('/browse?binder=shelf');
    await expect.poll(() => coverNames(page), {timeout: 20_000}).toEqual(['My collection', 'Amber', 'Amber vines', 'Epics']);
    expect(await violations(page)).toEqual([]);

    await actionsOf(page, 'Amber').click();
    await expect(page.getByRole('menu')).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.getByRole('menuitem', {name: 'Delete binder'}).click();
    const confirm = page.getByRole('dialog', {name: 'Delete binder'});
    // Until its fade ends, the dialog's text measures against a half-drawn panel.
    await expect(confirm).toHaveCSS('opacity', '1');
    expect(await violations(page)).toEqual([]);
  });

  test("on a phone, two covers across, each binder's ⋯ shown, and the title in the binder row", async ({page}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), "A phone's shelf");
    await signIn(page);
    await page.goto('/browse?binder=shelf');

    // My collection, the three binders, then New binder.
    const covers = shelf(page).getByRole('listitem');
    await expect(covers).toHaveCount(5, {timeout: 20_000});
    const [first, second, third] = await Promise.all([0, 1, 2].map(async (at) => (await covers.nth(at).boundingBox())!));
    expect(Math.abs(second.y - first.y), 'two across').toBeLessThanOrEqual(1);
    expect(third.y, 'the third on the next row').toBeGreaterThan(first.y + first.height - 1);
    for (const name of ['Amber', 'Amber vines', 'Epics']) await expect(actionsOf(page, name)).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('phone-binder-row').getByRole('heading', {name: 'Your binders'})).toBeVisible();
  });
});

/**
 * The New binder window, a dialog on a computer and a sheet on a phone, once it shows: 20 s, for
 * the dev server compiling its chunk on a cold run.
 */
async function windowOf(page: Page, name: 'New binder' | 'Edit binder'): Promise<Locator> {
  const dialog = page.getByRole('dialog', {name});
  await expect(dialog).toBeVisible({timeout: 20_000});
  return dialog;
}

/** Its save: "Create binder" or "Save changes" on a computer, "Create" or "Save" in a phone's header. */
const createIn = (dialog: Locator) => dialog.getByRole('button', {name: /^Create( binder)?$/});
const saveIn = (dialog: Locator) => dialog.getByRole('button', {name: /^Save( changes)?$/});

/** Its Name field: "Name has" is the search's. */
const nameIn = (dialog: Locator) => dialog.getByRole('textbox', {name: 'Name', exact: true});

/** The count the window says its rules hold, as a number. */
async function windowCount(dialog: Locator): Promise<number> {
  const words = await dialog.getByText(/^[\d,]+ cards?$/).textContent();
  return Number((words ?? '').replace(/\D/g, ''));
}

/** The cards a cover counts, from its name's "N of M cards". */
async function coverCards(cover: Locator): Promise<number> {
  const name = await cover.evaluate((link) => link.querySelector(':scope > :not([aria-hidden])')?.textContent ?? '');
  return Number(/of ([\d,]+) (cards|promos)$/.exec(name)?.[1].replace(/,/g, '') ?? NaN);
}

/** A shelf of `count` binders, each Amber's rules under its own name. */
const rowsOf = (count: number) =>
  Array.from({length: count}, (_, place) => binderRow({id: `b-${place}`, name: `Binder ${place + 1}`, rules: 'ink=Amber', place}));

test.describe('the New binder window', () => {
  test('makes a binder from its picks, counted as the shelf counts it: one POST, its cover last and focused', async ({page}) => {
    const world = worldOf();
    await signIn(page, world);
    await page.goto('/browse?binder=shelf');
    const amberCards = await coverCards(shelfCover(page, 'Amber'));

    await shelf(page).getByRole('button', {name: /^New binder/}).click({timeout: 20_000});
    const dialog = await windowOf(page, 'New binder');
    await expect(createIn(dialog)).toBeDisabled();
    await nameIn(dialog).fill('Gold and amber');
    await dialog.getByRole('button', {name: 'Filter by Amber'}).click();
    // The Amber binder already on the shelf holds the same rules.
    await expect.poll(() => windowCount(dialog)).toBe(amberCards);

    await createIn(dialog).click();
    await expect(dialog).toHaveCount(0);
    expect(world.calls).toEqual([
      {what: 'create', row: {owner_id: COLLECTOR_ID, name: 'Gold and amber', scope: 'all', rules: 'ink=Amber', cover_id: null}},
    ]);
    await expect.poll(() => coverNames(page)).toEqual(['My collection', 'Amber', 'Amber vines', 'Epics', 'Gold and amber']);
    await expect(shelfCover(page, 'Gold and amber')).toBeFocused();
  });

  test('has no axe violations, empty and with its rules picked', async ({page}, testInfo) => {
    test.skip(isPhone(testInfo.project.name), DESKTOP_AUDIT);
    await signIn(page);
    await page.goto('/browse?binder=shelf');
    const amberCards = await coverCards(shelfCover(page, 'Amber'));
    await shelf(page).getByRole('button', {name: /^New binder/}).click({timeout: 20_000});
    const dialog = await windowOf(page, 'New binder');
    await expect(dialog).toHaveCSS('opacity', '1');
    expect(await violations(page)).toEqual([]);

    await nameIn(dialog).fill('Gold and amber');
    await dialog.getByRole('button', {name: 'Filter by Amber'}).click();
    await expect.poll(() => windowCount(dialog)).toBe(amberCards);
    await expect(createIn(dialog)).toBeEnabled();
    expect(await violations(page)).toEqual([]);
  });

  test('keeps Create off for rules that hold no card, and says so', async ({page}) => {
    await signIn(page);
    await page.goto('/browse?binder=shelf');
    await shelf(page).getByRole('button', {name: /^New binder/}).click({timeout: 20_000});

    const dialog = await windowOf(page, 'New binder');
    await nameIn(dialog).fill('Nothing');
    await dialog.getByRole('textbox', {name: 'Name has'}).fill('no card is called this');
    await expect(dialog.getByText('0 cards')).toBeVisible();
    await expect(dialog.getByText('No card matches these rules.')).toBeVisible();
    await expect(createIn(dialog)).toBeDisabled();
  });

  test("Edit rules adds Epic: one PATCH, the cover's count follows, and focus returns to its ⋯", async ({page}) => {
    const world = worldOf();
    await signIn(page, world);
    await page.goto('/browse?binder=shelf');
    const before = await coverCards(shelfCover(page, 'Amber'));

    await actionsOf(page, 'Amber').click({timeout: 20_000});
    await page.getByRole('menuitem', {name: 'Edit rules'}).click();
    const dialog = await windowOf(page, 'Edit binder');
    await expect(dialog.getByRole('heading', {name: 'Edit Amber'})).toBeVisible();
    await expect(saveIn(dialog)).toBeDisabled();
    await dialog.getByRole('group', {name: 'Rarity filters'}).getByRole('button', {name: 'Epic'}).click();
    const epics = await windowCount(dialog);
    expect(epics).toBeLessThan(before);

    await saveIn(dialog).click();
    await expect(dialog).toHaveCount(0);
    expect(world.calls).toEqual([{what: 'change', id: AMBER.id, patch: {name: 'Amber', scope: 'all', rules: 'ink=Amber&rarity=Epic'}}]);
    await expect(shelfCover(page, 'Amber')).toHaveAccessibleName(/^Amber, Amber ink · Epic,/);
    expect(await coverCards(shelfCover(page, 'Amber'))).toBe(epics);
    await expect(actionsOf(page, 'Amber')).toBeFocused();
  });

  test('says a shelf filled elsewhere when Create meets the cap, and the shelf then says why there is no New binder', async ({page}) => {
    const world: BindersWorld = {rows: rowsOf(29)};
    await signIn(page, world);
    await page.goto('/browse?binder=shelf');
    await shelf(page).getByRole('button', {name: /^New binder/}).click({timeout: 20_000});

    const dialog = await windowOf(page, 'New binder');
    await nameIn(dialog).fill('One too many');
    await dialog.getByRole('button', {name: 'Filter by Amber'}).click();
    // Another tab makes the thirtieth.
    world.rows = rowsOf(30);
    await createIn(dialog).click();
    await expect(dialog.getByRole('alert')).toHaveText('Your shelf holds 30 binders, the most it can.');
    await expect(nameIn(dialog)).toHaveValue('One too many');

    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(dialog).toHaveCount(0);
    await expect(shelf(page).getByText('Your shelf holds 30 binders, the most it can. Delete one to make another.')).toBeVisible();
    await expect(shelf(page).getByRole('button', {name: /^New binder/})).toHaveCount(0);
  });

  test('New binder in the Binders tab opens the binder it makes', async ({page}) => {
    await signIn(page);
    await openAt(page, '/browse?binder=all');

    await openBindersTab(setButton(page));
    await page.getByRole('listbox', {name: 'Binders'}).getByRole('option', {name: 'New binder'}).click();
    const dialog = await windowOf(page, 'New binder');
    await nameIn(dialog).fill('Sapphire');
    await dialog.getByRole('button', {name: 'Filter by Sapphire'}).click();
    await createIn(dialog).click();

    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/[?&]custom=b-made-3(&|$)/);
    await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Sapphire'));
  });
});

const filterPanel = (page: Page) => page.getByRole('complementary', {name: 'Filters'});

/** Save as a binder's box, once it shows: 20 s, for the dev server compiling its chunk on a cold run. */
async function boxOf(page: Page): Promise<Locator> {
  const box = page.getByRole('dialog', {name: 'Save as a binder'});
  await expect(box).toBeVisible({timeout: 20_000});
  return box;
}

/** The page's cards, once a filter's write has landed: the binder's tiles, read when they stop changing. */
async function settledTiles(page: Page): Promise<(string | null)[]> {
  let last: (string | null)[] = [];
  await expect
    .poll(async () => {
      const now = await tileNames(page);
      const same = JSON.stringify(now) === JSON.stringify(last);
      last = now;
      return same && now.length > 0;
    })
    .toBe(true);
  return last;
}

test.describe('Save as a binder', () => {
  test("keeps My collection's Amber ink as a binder: one POST, opened in place over the same cards, the panel clear", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile-'), "The docked filter panel's foot");
    const world = worldOf();
    await signIn(page, world);
    await openAt(page, '/browse?binder=all');
    const panel = filterPanel(page);
    const save = panel.getByRole('button', {name: 'Save as a binder'});
    await expect(save, 'no filter, no offer').toHaveCount(0);

    await panel.getByRole('button', {name: 'Filter by Amber'}).click();
    await expect(page).toHaveURL(/[?&]ink=Amber(&|$)/);
    const line = panel.getByText(/^Keeps Amber ink as a binder of its own: [\d,]+ cards$/);
    await expect(line).toBeVisible();
    // Pinned to the panel's bottom edge, over its sections, so it shows with no scroll.
    await expect(save).toBeInViewport();
    const [panelBox, lineBox] = await Promise.all([panel.boundingBox(), line.boundingBox()]);
    expect(panelBox!.y + panelBox!.height - (lineBox!.y + lineBox!.height), 'at the foot').toBeLessThan(40);
    const onScreen = await settledTiles(page);

    await save.click();
    const box = await boxOf(page);
    await expect(box.getByRole('textbox', {name: 'Name'})).toHaveValue('Amber');
    await box.getByRole('button', {name: 'Save binder'}).click();
    await expect(box).toHaveCount(0);
    expect(world.calls).toEqual([
      {what: 'create', row: {owner_id: COLLECTOR_ID, name: 'Amber', scope: 'all', rules: 'ink=Amber', cover_id: null}},
    ]);
    await expect(page).toHaveURL(/[?&]custom=b-made-3(&|$)/);
    expect(new URL(page.url()).searchParams.has('ink'), 'the filter panel is clear').toBe(false);
    await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Amber'));
    await expect(binderButton(page)).toBeFocused();
    expect(await settledTiles(page)).toEqual(onScreen);
  });

  test('inside Amber, offers nothing for Steel, and with Epic on saves a binder of Amber Epics holding the cards on screen', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile-'), "The docked filter panel's foot");
    const world = worldOf();
    await signIn(page, world);
    await openAt(page, `/browse?binder=all&custom=${AMBER.id}`);
    const panel = filterPanel(page);
    const save = panel.getByRole('button', {name: 'Save as a binder'});

    await panel.getByRole('button', {name: 'Filter by Steel'}).click();
    await expect(page).toHaveURL(/[?&]ink=Steel(&|$)/);
    await expect(save, 'Steel widens Amber, so no binder joins them').toHaveCount(0);
    await panel.getByRole('button', {name: 'Filter by Steel'}).click();

    await panel.getByRole('group', {name: 'Rarity filters'}).getByRole('button', {name: 'Epic'}).click();
    await expect(page).toHaveURL(/[?&]rarity=Epic(&|$)/);
    await expect(save).toBeVisible();
    const onScreen = await settledTiles(page);
    await save.click();
    const box = await boxOf(page);
    await box.getByRole('button', {name: 'Save binder'}).click();
    await expect(box).toHaveCount(0);
    expect(world.calls).toEqual([
      {what: 'create', row: {owner_id: COLLECTOR_ID, name: 'Amber', scope: 'all', rules: 'ink=Amber&rarity=Epic', cover_id: null}},
    ]);
    await expect(page).toHaveURL(/[?&]custom=b-made-3(&|$)/);
    expect(await settledTiles(page)).toEqual(onScreen);
  });

  test("the panel's Save as a binder and its box have no axe violations", async ({page}, testInfo) => {
    test.skip(isPhone(testInfo.project.name), DESKTOP_AUDIT);
    await signIn(page);
    await openAt(page, '/browse?binder=all');
    const panel = filterPanel(page);
    await panel.getByRole('button', {name: 'Filter by Amber'}).click();
    await expect(panel.getByText(/^Keeps Amber ink as a binder of its own: [\d,]+ cards$/)).toBeVisible();
    await settledTiles(page);
    await expect(numbers(page)).toHaveAttribute('aria-busy', 'false');
    expect(await violations(page)).toEqual([]);

    await panel.getByRole('button', {name: 'Save as a binder'}).click();
    const box = await boxOf(page);
    await expect(box).toHaveCSS('opacity', '1');
    expect(await violations(page)).toEqual([]);
  });

  test("on a phone, the Binder sheet's Save as a binder applies its draft, and the box saves and opens the binder", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), "A phone's Binder sheet");
    const world = worldOf();
    await signIn(page, world);
    await openAt(page, '/browse?binder=all');

    await page.getByTestId('phone-binder-row').getByRole('button', {name: /^Filters/}).click();
    const sheet = page.getByRole('dialog', {name: 'Binder', exact: true});
    await sheet.getByRole('button', {name: 'Filter by Amber'}).click();
    await sheet.getByRole('button', {name: 'Save as a binder'}).click();
    // The press applied the draft and closed the sheet, under the box.
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/[?&]ink=Amber(&|$)/);

    const box = await boxOf(page);
    await box.getByRole('button', {name: 'Save binder'}).click();
    await expect(box).toHaveCount(0);
    expect(world.calls).toEqual([
      {what: 'create', row: {owner_id: COLLECTOR_ID, name: 'Amber', scope: 'all', rules: 'ink=Amber', cover_id: null}},
    ]);
    await expect(page).toHaveURL(/[?&]custom=b-made-3(&|$)/);
    await expect(binderButton(page)).toHaveAccessibleName(named('Binder: Amber'));
  });
});

/** Change cover's dialog, once it shows: 20 s, for its chunk on a cold run. */
async function pickerOf(page: Page): Promise<Locator> {
  const picker = page.getByRole('dialog', {name: 'Change cover'});
  await expect(picker).toBeVisible({timeout: 20_000});
  return picker;
}

/** The art a shelf cover draws, or the art a picker's card shows. */
const artOf = (where: Locator) => where.locator('img').first().getAttribute('src');

/**
 * Picks the second card Change cover offers, which is never the cover the rarest card would
 * give, and answers its art.
 */
async function pickSecondCard(picker: Locator): Promise<string | null> {
  const choice = picker.getByRole('list', {name: 'Your cards'}).getByRole('button').nth(1);
  const art = await artOf(choice);
  await choice.click();
  return art;
}

test.describe('Rename and Change cover', () => {
  test('Rename binder and Change cover have no axe violations', async ({page}, testInfo) => {
    test.skip(isPhone(testInfo.project.name), DESKTOP_AUDIT);
    await signIn(page);
    await page.goto('/browse?binder=shelf');

    await actionsOf(page, 'Epics').click({timeout: 20_000});
    await page.getByRole('menuitem', {name: 'Rename'}).click();
    const rename = page.getByRole('dialog', {name: 'Rename binder'});
    await expect(rename).toHaveCSS('opacity', '1');
    expect(await violations(page)).toEqual([]);
    await rename.getByRole('button', {name: 'Cancel'}).click();
    await expect(rename).toHaveCount(0);

    await actionsOf(page, 'Amber').click();
    await page.getByRole('menuitem', {name: 'Change cover'}).click();
    const picker = await pickerOf(page);
    await expect(picker.getByRole('heading', {name: 'Cover for Amber'})).toBeVisible();
    await expect(picker.getByRole('list', {name: 'Your cards'}).getByRole('button').first()).toBeVisible();
    await expect(picker).toHaveCSS('opacity', '1');
    expect(await violations(page)).toEqual([]);
  });

  test('rename a binder, then change its cover and My collection\'s: one PATCH each, one upsert, and the shelf shows each', async ({
    page,
  }) => {
    const world = worldOf();
    await signIn(page, world);
    await page.goto('/browse?binder=shelf');

    await actionsOf(page, 'Epics').click({timeout: 20_000});
    await page.getByRole('menuitem', {name: 'Rename'}).click();
    const rename = page.getByRole('dialog', {name: 'Rename binder'});
    await rename.getByRole('textbox', {name: 'Name'}).fill('Epic chase');
    await rename.getByRole('button', {name: 'Save'}).click();
    await expect(rename).toHaveCount(0);
    await expect.poll(() => coverNames(page)).toEqual(['My collection', 'Amber', 'Amber vines', 'Epic chase']);
    await expect(actionsOf(page, 'Epic chase')).toBeFocused();

    await actionsOf(page, 'Amber').click();
    await page.getByRole('menuitem', {name: 'Change cover'}).click();
    let picker = await pickerOf(page);
    await expect(picker.getByRole('heading', {name: 'Cover for Amber'})).toBeVisible();
    const amberArt = await pickSecondCard(picker);
    await expect(picker).toHaveCount(0);
    await expect.poll(() => artOf(shelfCover(page, 'Amber'))).toBe(amberArt);

    await actionsOf(page, 'My collection').click();
    await page.getByRole('menuitem', {name: 'Change cover'}).click();
    picker = await pickerOf(page);
    await expect(picker.getByRole('heading', {name: 'Cover for My collection'})).toBeVisible();
    const collectionArt = await pickSecondCard(picker);
    await expect(picker).toHaveCount(0);
    await expect.poll(() => artOf(shelfCover(page, 'My collection'))).toBe(collectionArt);

    expect(world.calls).toEqual([
      {what: 'change', id: EPICS.id, patch: {name: 'Epic chase'}},
      {what: 'change', id: AMBER.id, patch: {cover_id: expect.any(String)}},
      {what: 'shelf cover', row: {owner_id: COLLECTOR_ID, cover_id: world.shelfCover}, onConflict: 'owner_id'},
    ]);
    expect(world.shelfCover).toEqual(expect.any(String));

    // Read back on the next visit: My collection keeps the card picked.
    await page.reload();
    await expect.poll(() => artOf(shelfCover(page, 'My collection')), {timeout: 20_000}).toBe(collectionArt);
  });
});

test.describe('Save as a binder from a filter sheet', () => {
  test("a phone's Binder sheet or a tablet's filter dialog: the press applies the draft, and closing the box hands focus back to Filters", async ({
    page,
  }, testInfo) => {
    const phone = testInfo.project.name.startsWith('mobile-');
    // Below the desktop width the filters open in a dialog rather than the docked panel.
    if (!phone) await page.setViewportSize({width: 900, height: 768});
    await signIn(page);
    await openAt(page, '/browse?binder=all');

    const filters = phone
      ? page.getByTestId('phone-binder-row').getByRole('button', {name: /^Filters/})
      : page.getByRole('button', {name: /^Filters/});
    await filters.click();
    const sheet = phone ? page.getByRole('dialog', {name: 'Binder', exact: true}) : page.getByRole('dialog', {name: 'Filters'});
    // A tablet's dialog has no inks, which its toolbar holds.
    await (phone
      ? sheet.getByRole('button', {name: 'Filter by Amber'})
      : sheet.getByRole('button', {name: 'Common', exact: true})
    ).click();
    await sheet.getByRole('button', {name: 'Save as a binder'}).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(phone ? /[?&]ink=Amber(&|$)/ : /[?&]rarity=Common(&|$)/);

    const box = await boxOf(page);
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);
    await expect(filters).toBeFocused();
  });
});

test.describe('Change cover under the pointer', () => {
  test("the chosen card keeps its gold ring under the pointer, where another card takes the hover ring", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile-'), 'A pointer resting on a card');
    // No fade, so each ring read is the one the card settles on.
    await page.emulateMedia({reducedMotion: 'reduce'});
    await signIn(page);
    await page.goto('/browse?binder=shelf');
    await actionsOf(page, 'My collection').click({timeout: 20_000});
    await page.getByRole('menuitem', {name: 'Change cover'}).click();
    const picker = await pickerOf(page);
    const ringOf = (choice: Locator) => choice.evaluate((button) => getComputedStyle(button).boxShadow);
    // My collection follows the rarest card, so "The rarest card you have" is the one chosen.
    const chosen = picker.locator('.cover-choice[aria-pressed="true"]');
    const other = picker.getByRole('list', {name: 'Your cards'}).getByRole('button').nth(1);
    const chosenRing = await ringOf(chosen);
    const otherEdge = await ringOf(other);
    // The chosen card wears its ring at rest, so holding it under the pointer means something.
    expect(chosenRing).not.toBe(otherEdge);
    await chosen.hover();
    expect(await ringOf(chosen)).toBe(chosenRing);
    await other.hover();
    expect(await ringOf(other)).not.toBe(otherEdge);
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
