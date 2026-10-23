import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';
import {
  cardFullNameById,
  newestCoreSet,
  preCoreCardWithEnchanted,
  promoSetWithOpenPocket,
  setCards,
  setPrintings,
} from '../helpers/cardData';
import {holdLazyModule} from '../helpers/lazyModule';
import {storedSession} from '../helpers/session';

/**
 * Collection mode (#553 Phase C), behind `VITE_SHOW_COLLECTION` and pinned on in
 * `playwright.config.ts` together with the accounts flag it requires.
 *
 * SIGNED IN WITHOUT SIGNING IN: an OAuth round-trip is out of E2E's reach, but a session
 * supabase-js RESTORES needs none. `signInAsCollector` stores an unexpired session, which
 * `getSession()` hands back without a network check, and the collector's collection, both
 * locally and as the server row the sync adopts on every load (`resolveCollectionSync`).
 * Everything else the placeholder project is asked answers empty (`supabaseStub`).
 *
 * The collection is drawn from the card data, not hardcoded: the newest set's first three
 * cards and its first alt-art printing, so the suite follows the data when a set graduates.
 */

/** The collector's uid: the session's user, and the owner stamped on the local copy. */
const COLLECTOR_ID = 'e2e-collector';
const IMPORTED_AT = Date.parse('2026-10-12T10:00:00Z');

const SET = newestCoreSet();
const BASE = setCards(SET);
const PRINTINGS = setPrintings(SET);
/** The binder's pockets for the set: every card, and every alt-art printing as one of its own. */
const SET_TOTAL = BASE.length + PRINTINGS.length;
const HELD_BASE = BASE.slice(0, 3);
const HELD_ALT = PRINTINGS[0];

type Entries = Record<string, {normal: number; foil: number}>;

const ENTRIES: Entries = {
  ...Object.fromEntries(HELD_BASE.map((card) => [String(card.id), {normal: 1, foil: 0}])),
  ...(HELD_ALT && {[HELD_ALT.id]: {normal: 0, foil: 1}}),
};
const HELD = Object.keys(ENTRIES).length;
/**
 * Held in every finish they come in. The base cards come in both and are held in one, so only
 * the printing counts: it comes in foil alone, which it is held in (`collectionStats.ts`, #880).
 */
const MASTER = HELD_ALT ? 1 : 0;

/** A share of the set as the panel writes it: a whole percent, rounded down (`percentOf`). */
const percentOfSet = (count: number) => Math.floor((count / SET_TOTAL) * 100);

const COLLECTIONS_PATH = '/rest/v1/collections';

interface CollectorOptions {
  /** Also store the local copy. False is a new browser: the collection is the server row alone. */
  local?: boolean;
  /** The server holds its answer until this settles, so a test can act before the sync hears. */
  answered?: Promise<void>;
}

/** The collections a page wrote to the account, oldest first (#826). */
type AccountWrites = Entries[];

/**
 * Signs the page in as a collector holding `entries`, or holding nothing for `null`: the
 * stored session, the local copy (stamped as the server's, so it is never uploaded back),
 * and the server row. Call before the first navigation.
 *
 * The row is the stub's to keep: an upload replaces it, as the table's one row per user is
 * replaced, and every later read answers with it. Returns the uploads, as the account saw them.
 */
async function signInAsCollector(
  page: Page,
  entries: Entries | null,
  {local: storeLocal = true, answered}: CollectorOptions = {},
): Promise<AccountWrites> {
  const local = storeLocal && entries && {
    schemaVersion: 1,
    importedAt: IMPORTED_AT,
    entries,
    ownerUid: COLLECTOR_ID,
    source: 'server',
  };
  await page.addInitScript(
    ({session, collection}) => {
      localStorage.setItem('inkweave:auth', JSON.stringify(session));
      if (collection) localStorage.setItem('inkweave:collection', JSON.stringify(collection));
    },
    {session: storedSession(COLLECTOR_ID), collection: local},
  );
  // Registered after the fixture's catch-all stub, so it wins for this table.
  let rows: object[] = entries
    ? [{entries, imported_at: new Date(IMPORTED_AT).toISOString(), schema_version: 1}]
    : [];
  const writes: AccountWrites = [];
  await page.route(
    (url) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === COLLECTIONS_PATH,
    async (route) => {
      if (route.request().method() === 'POST') {
        // `upsertCollection`: the row it sends replaces the one held.
        const sent = route.request().postDataJSON() as {entries: Entries; imported_at: string; schema_version: number};
        writes.push(sent.entries);
        rows = [{entries: sent.entries, imported_at: sent.imported_at, schema_version: sent.schema_version}];
        await route.fulfill({status: 201, body: ''});
        return;
      }
      await answered;
      await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(rows)});
    },
  );
  return writes;
}

/** Waits for the restored session: the header's control turns from "Sign in" to "Account". */
async function signedIn(page: Page): Promise<void> {
  await expect(
    page.getByTestId('compact-header').getByRole('button', {name: 'Account', exact: true}),
  ).toBeVisible();
}

// Exact: the frame drawn while the binder's code loads is named "Loading your binder" (#913).
const binder = (page: Page) => page.getByRole('region', {name: 'Binder', exact: true});
const numbers = (page: Page) => page.getByRole('region', {name: 'Collection numbers'});

/** What collection mode draws while the binder's code downloads (#913). */
const binderLoading = (page: Page) => page.getByRole('region', {name: 'Loading your binder'});

/** A lazy module's request, on the dev server or in a production build (see helpers/lazyModule.ts). */
const isModuleRequest = (url: string, name: string) => new RegExp(`/${name}(\\.tsx|-[\\w-]+\\.js)(\\?|$)`).test(url);

type Place = {x: number; y: number; width: number; height: number};

/**
 * Where each of Browse's toolbar controls stands, by name, once the page's fonts are in: its
 * layout box, which the hover's brief scale on a button (CtaButton's boop) leaves alone, where
 * getBoundingClientRect would catch the button mid-scale under the pointer that pressed it.
 */
async function toolbarPlaces(page: Page): Promise<Record<string, Place>> {
  // A late font changes the labels' widths, and with them where the controls after them stand.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page
    .getByTestId('browse-toolbar')
    .first()
    .evaluate((toolbar) => {
      const places: Record<string, Place> = {};
      for (const control of toolbar.querySelectorAll<HTMLElement>('button, input')) {
        const name = control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '';
        let x = 0;
        let y = 0;
        for (let box: Element | null = control; box instanceof HTMLElement; box = box.offsetParent) {
          x += box.offsetLeft;
          y += box.offsetTop;
        }
        places[name] = {x, y, width: control.offsetWidth, height: control.offsetHeight};
      }
      return places;
    });
}

/** Every control drawn before the binder's code arrived is where it was, within 1 px. */
function expectToolbarHeld(before: Record<string, Place>, after: Record<string, Place>): void {
  expect(Object.keys(before).length).toBeGreaterThan(0);
  for (const [name, place] of Object.entries(before)) {
    const now = after[name];
    expect(now, name).toBeDefined();
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(now[key] - place[key]), `${name} ${key}`).toBeLessThanOrEqual(1);
    }
  }
}

/** The docked set panel's parts, in order: what the binder shows, then the numbers. */
const setPanelParts = (page: Page) => page.getByRole('complementary', {name: 'Set', exact: true}).locator(':scope > *');

/** An element's box on the page, once the page's fonts are in. */
async function placeOf(locator: Locator): Promise<Place> {
  await locator.page().evaluate(() => document.fonts.ready.then(() => undefined));
  const box = await locator.boundingBox();
  expect(box, 'the element is on the page').not.toBeNull();
  return box!;
}

/** Each part is where its placeholder was, within 1 px. */
function expectPlacesHeld(parts: {name: string; before: Place; after: Place}[]): void {
  for (const {name, before, after} of parts) {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(after[key] - before[key]), `${name} ${key}: ${before[key]} -> ${after[key]}`).toBeLessThanOrEqual(1);
    }
  }
}

/**
 * Presses Collection with the binder's code held: the binder's frame shows at once, in place of
 * an empty area. Returns the toolbar as it stood then, and the release.
 */
async function pressCollectionWithBinderHeld(page: Page): Promise<{before: Record<string, Place>; release: () => void}> {
  const binderCode = await holdLazyModule(page, 'CollectionBinderSection');
  // The session is back once the sync reads the account's copy. The header's Account button
  // says so too (`signedIn`), but a phone has no header.
  const synced = page.waitForRequest(
    (request) => new URL(request.url()).pathname === COLLECTIONS_PATH && request.method() === 'GET',
  );
  await page.goto('/browse');
  await synced;
  await page.getByRole('button', {name: 'Show my collection'}).click();
  // A hold that caught nothing names itself here, rather than as a frame that never showed.
  await expect
    .poll(binderCode.caught, {message: "the binder's chunk never reached the hold", timeout: 10000})
    .toBeGreaterThan(0);
  await expect(binderLoading(page)).toBeVisible();
  return {before: await toolbarPlaces(page), release: binderCode.release};
}

/** Where an element's four edges sit on the page, in CSS pixels. */
async function edges(locator: Locator): Promise<{left: number; right: number; top: number; bottom: number}> {
  const box = await locator.boundingBox();
  expect(box, 'the element is on the page').not.toBeNull();
  return {left: box!.x, right: box!.x + box!.width, top: box!.y, bottom: box!.y + box!.height};
}

/** Where a box's middle sits across the page, from its `edges`. */
const middle = (box: {left: number; right: number}) => (box.left + box.right) / 2;

/**
 * An element's width once its transitions have run, or -1 while one runs. An edge disc grows
 * with a bounce that overshoots, and its button's boop scales it 3% on the way, so its width
 * says how big it is only once both have settled.
 */
async function settledWidth(locator: Locator): Promise<number> {
  return locator.evaluate((el) => (el.getAnimations().length > 0 ? -1 : el.getBoundingClientRect().width));
}

/** Whether the page shows the element 2px inside each side edge, halfway down: nothing cuts it off or covers it. */
async function shownSideToSide(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const y = box.top + box.height / 2;
    return [box.left + 2, box.right - 2].every((x) => el.contains(document.elementFromPoint(x, y)));
  });
}

/**
 * Opens a collector's binder at `size` and checks what its first spread keeps at every desktop
 * size (#922, owner 2026-10-23): it starts under the search bar's start and ends under its end,
 * each within 1px, a disc on each outer edge, and the right page's pockets the size the page's
 * height gives them. Returns that page's margin beside its pockets.
 */
async function checkSpreadAt(page: Page, size: {width: number; height: number}): Promise<number> {
  await page.setViewportSize(size);
  await signInAsCollector(page, ENTRIES);
  await page.goto(`/browse?binder=${SET}`);
  await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();

  const search = await edges(page.getByRole('textbox', {name: 'Search cards'}));
  const cover = await edges(binder(page).getByRole('group', {name: 'Front cover'}));
  const rightPage = binder(page).getByRole('group', {name: 'Right page'});
  const right = await edges(rightPage);
  expect(Math.abs(cover.left - search.left), 'the starts apart').toBeLessThanOrEqual(1);
  expect(Math.abs(right.right - search.right), 'the ends apart').toBeLessThanOrEqual(1);
  // Each disc's centre sits 2px past its page's outer edge (`edgeArrowPlace`).
  const previous = await edges(binder(page).getByRole('button', {name: 'Previous spread'}));
  const next = await edges(binder(page).getByRole('button', {name: 'Next spread'}));
  expect(Math.abs(middle(previous) - cover.left), 'the Previous disc off the start').toBeLessThanOrEqual(4);
  expect(Math.abs(middle(next) - right.right), 'the Next disc off the end').toBeLessThanOrEqual(4);

  // Each pocket is a card's shape, 8px (`SPACING.sm`) from its neighbours across and down, and
  // the three rows fill the page's height inside its 12px padding (`PAGE_PADDING`): the height
  // gives the cards their size, as on master. Across, a row's four sit in the page's middle.
  const pockets = rightPage.locator(':scope > div');
  await expect(pockets).toHaveCount(12);
  const [first, second, fourth, below, last] = await Promise.all([0, 1, 3, 4, 11].map((i) => edges(pockets.nth(i))));
  const shapeOff = first.right - first.left - 0.72 * (first.bottom - first.top);
  expect(Math.abs(shapeOff), "a pocket off a card's shape").toBeLessThanOrEqual(1);
  expect(Math.abs(second.left - first.right - 8), 'the gap across').toBeLessThanOrEqual(1);
  expect(Math.abs(below.top - first.bottom - 8), 'the gap down').toBeLessThanOrEqual(1);
  expect(Math.abs(first.top - right.top - 12), 'the margin above the pockets').toBeLessThanOrEqual(1);
  expect(Math.abs(right.bottom - last.bottom - 12), 'the margin below the pockets').toBeLessThanOrEqual(1);
  const margin = first.left - right.left;
  expect(Math.abs(margin - (right.right - fourth.right)), 'the pockets off centre').toBeLessThanOrEqual(1);
  return margin;
}

test.describe('Collection mode', () => {
  test('the Collection button asks a signed-out visitor to sign in', async ({page}) => {
    await page.goto('/browse');
    const toggle = page.getByRole('button', {name: 'Show my collection'});
    await expect(toggle).toBeVisible();
    // The collection's actions need an account: no gear signed out (owner, 2026-10-20).
    await expect(page.getByRole('button', {name: 'Collection actions'})).toHaveCount(0);

    await toggle.click();

    // The sign-in gate (owner ruling 2026-10-07): no import, no binder, until signed in.
    await expect(page.getByRole('dialog', {name: /sign in/i})).toBeVisible();
    await expect(binder(page)).toHaveCount(0);
  });

  test('a visit that never opens collection mode loads none of it', async ({page}, testInfo) => {
    // One project is enough: this asserts what the network requests, not how a
    // browser renders, and the five-browser matrix would only repeat it.
    if (testInfo.project.name !== 'chromium') test.skip();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('/browse');
    await expect(page.getByRole('button', {name: 'Show my collection'})).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Neither the 14 non-Core chunks nor the binder's lazy component.
    expect(requests.filter((url) => url.includes('/data/collection/'))).toEqual([]);
    expect(requests.filter((url) => url.includes('CollectionBinderSection'))).toEqual([]);
  });

  test('signed out, a binder link keeps the grid and a Set filter picked on it', async ({page}, testInfo) => {
    // #790: the page dropped a Set filter whenever `?binder=` was in the URL, honoured or not.
    // One project is enough: this asserts what the URL keeps, and the panel is the desktop one.
    if (testInfo.project.name !== 'chromium') test.skip();
    await page.goto(`/browse?binder=${SET}`);
    await expect(page.getByTestId('card-tile').first()).toBeVisible();
    const panel = page.getByRole('complementary', {name: 'Filters'});
    await panel.getByRole('button', {name: 'Set', exact: true}).click();
    const logo = panel.getByRole('group', {name: 'Set filters'}).getByRole('button').first();

    await logo.click();

    await expect(logo).toHaveAttribute('aria-pressed', 'true');
    expect(new URL(page.url()).searchParams.get('set')).not.toBeNull();
    await expect(binder(page)).toHaveCount(0);
  });
});

test.describe('Collection mode, signed in', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({page: _}, testInfo) => {
    // The docked collection and Filters panels are the desktop layout. Phones get the set
    // strip (tested at phone width below) and the filter drawer, which these locators miss.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
  });

  test("the Collection button opens a collector's binder on the whole collection, with its numbers", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto('/browse');
    await signedIn(page);

    await page.getByRole('button', {name: 'Show my collection'}).click();

    // The whole collection, not the newest set (owner, 2026-10-20).
    await expect(page).toHaveURL(/[?&]binder=all(&|$)/);
    await expect(binder(page)).toBeVisible();
    await expect(numbers(page).getByText('Complete collection', {exact: true})).toBeVisible();
  });

  test('on a new browser, the Collection button waits for the account instead of offering an import', async ({
    page,
  }) => {
    let answer = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    await signInAsCollector(page, ENTRIES, {local: false, answered});
    await page.goto('/browse');
    await signedIn(page);
    // Out through Home and back, so the collection's providers mount again with the account
    // already known: the mount that StrictMode's dev double effect makes the hard case.
    // Back is client-side too (history pop); a reload would restore the session again first.
    await page.getByRole('link', {name: 'Go to home page'}).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();

    await page.getByRole('button', {name: 'Show my collection'}).click();
    // The account's copy, which here IS the collection, has not answered yet: the click
    // opens the binder to wait (its param in the URL), where an import would leave the URL be.
    await expect(page).toHaveURL(/[?&]binder=/);

    answer();
    // Once the sync has answered, the binder stays only for a collection that arrived, and
    // its numbers show only once loaded (the click opens the whole collection, as above).
    await expect(numbers(page).getByText('Complete collection', {exact: true})).toBeVisible();
    await expect(binder(page)).toBeVisible();
    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toHaveCount(0);
  });

  test('when the account answers with no collection, the wait offers the import and drops the binder param', async ({
    page,
  }) => {
    let answer = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    await signInAsCollector(page, null, {local: false, answered});
    await page.goto('/browse');
    await signedIn(page);

    await page.getByRole('button', {name: 'Show my collection'}).click();
    await expect(page).toHaveURL(/[?&]binder=/);

    answer();
    // Nothing came, so the click's import opens, and the binder's param goes with the
    // binder: left behind, it reloaded into a loading binder.
    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toBeVisible();
    await expect(page).not.toHaveURL(/[?&]binder=/);
  });

  test('on a new browser, the account page checks the account before offering an import', async ({page}) => {
    let answer = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    await signInAsCollector(page, ENTRIES, {local: false, answered});
    await page.goto('/account');
    // The account's copy IS the collection here, and it has not answered: an import now
    // could replace it, so the section says it is checking and offers none.
    await expect(page.getByRole('button', {name: 'Import collection'})).toBeDisabled();
    await expect(page.getByText('Checking your account for a collection…')).toBeVisible();

    answer();
    await expect(page.getByText('Cards owned')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Re-import'})).toBeEnabled();
  });

  test('the panel counts every pocket of the set, the alt-art printings among them', async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    // Every pocket counts, the alt-art printings too (owner, 2026-10-15).
    await expect(numbers(page)).toContainText(`${HELD} of ${SET_TOTAL} cards`);
  });

  test('a count changed from a pocket shows at once and is still there after a reload (#826)', async ({
    page,
  }) => {
    // The first pocket after the three held: a card the collector has none of yet.
    const card = BASE[HELD_BASE.length];
    const writes = await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByTestId('card-tile');
    const heldCounts = binder(page).getByRole('group', {name: '1 normal', exact: true});
    await expect(heldCounts).toHaveCount(HELD_BASE.length);

    // A mouse on the pocket opens its stripe. It sits under aria-hidden: its group's label
    // speaks for it.
    await tiles.nth(HELD_BASE.length).hover();
    await binder(page)
      .getByRole('group', {name: '0 normal, 0 foil', exact: true})
      .getByRole('button', {name: 'Add one copy of normal', includeHidden: true})
      .click();
    await page.mouse.move(0, 0);

    // The pocket's count and the panel's numbers follow at once.
    await expect(heldCounts).toHaveCount(HELD_BASE.length + 1);
    await expect(numbers(page)).toContainText(`${HELD + 1} of ${SET_TOTAL} cards`);

    // Saved to the account a moment after the click, which a reload then reads back.
    await expect.poll(() => writes.at(-1)?.[String(card.id)]).toEqual({normal: 1, foil: 0});
    await page.reload();
    await expect(heldCounts).toHaveCount(HELD_BASE.length + 1);
    await expect(numbers(page)).toContainText(`${HELD + 1} of ${SET_TOTAL} cards`);
  });

  test('in Missing, copies added from a pocket and from the card window keep both cards and the spread (#826)', async ({
    page,
  }) => {
    const writes = await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}&owned=missing`);
    const shown = binder(page)
      .getByRole('navigation', {name: 'Binder pages'})
      .locator('[aria-current="true"]');
    await expect(shown).toHaveAccessibleName(/^Spread 1 of /);
    await binder(page).getByRole('button', {name: 'Next spread'}).click();
    await expect(shown).toHaveAccessibleName(/^Spread 2 of /);

    // The second spread's first two pockets: cards the collector has none of.
    const tiles = binder(page).getByTestId('card-tile');
    const names = [
      (await tiles.nth(0).getAttribute('aria-label')) ?? '',
      (await tiles.nth(1).getAttribute('aria-label')) ?? '',
    ];
    const ids = names.map((name) => BASE.find((base) => base.fullName === name)?.id);
    expect(ids, `${names.join(' and ')} are Set ${SET}'s cards`).not.toContain(undefined);

    // A first copy of the first, from its pocket a mouse points at. The stripe sits under
    // aria-hidden: its group's label speaks for it.
    await tiles.nth(0).hover();
    const stripe = binder(page).getByRole('group', {name: '0 normal, 0 foil', exact: true});
    await stripe.getByRole('button', {name: 'Add one copy of normal', includeHidden: true}).click();
    const open = binder(page).getByRole('group', {name: '1 normal, 0 foil', exact: true});
    await expect(open).toBeVisible();
    // The click left the focus where it was, off the hidden + that no Tab reaches.
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(await focused()).not.toBe('Add one copy of normal');

    // A first copy of the second, from its card window, whose arrows walk the binder: the
    // first, held now but kept, is the card before it. Clicked near its top, clear of the
    // stripe the mouse opens, which takes every press on the card's foot; then the keyboard
    // alone, so the mouse rests where it clicked.
    await page.mouse.move(0, 0);
    await tiles.nth(1).click({position: {x: 10, y: 10}});
    const modal = page.getByTestId('card-overview-modal');
    await expect(modal.locator('h1')).toHaveText(names[1]);
    const copies = page.getByTestId('card-overview-copies-slot').getByRole('group');
    // The dialog moves focus to its × 100ms after opening; a 100ms timer set now runs after it.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    await copies.getByRole('button', {name: `Add one copy of ${names[1]}`, exact: true}).focus();
    await page.keyboard.press('Enter');
    await expect(copies).toHaveAccessibleName('Your copies: 1 normal, 0 foil');
    await page.keyboard.press('ArrowLeft');
    await expect(modal.locator('h1')).toHaveText(names[0]);
    await page.keyboard.press('Escape');

    // The window closed over the mouse resting on the second pocket, whose stripe opens
    // again with no move of the mouse.
    await expect(modal).toHaveCount(0);
    await expect(open).toBeVisible();

    // Both held, so neither is missing, yet both keep their pockets and the binder its
    // spread: dropped from the view at once, a card reopened the binder at the first.
    for (const name of names) {
      await expect(binder(page).getByRole('button', {name, exact: true})).toBeVisible();
    }
    await expect(shown).toHaveAccessibleName(/^Spread 2 of /);
    await expect
      .poll(() => ids.map((id) => writes.at(-1)?.[String(id)]))
      .toEqual([
        {normal: 1, foil: 0},
        {normal: 1, foil: 0},
      ]);
  });

  test("the card window's stripe changes its copies by mouse and by keyboard, on the grid's windows too (#826)", async ({
    page,
  }) => {
    const card = HELD_BASE[0];
    const writes = await signInAsCollector(page, ENTRIES);
    // The grid's window, not the binder's: any window Browse opens carries the stripe for a
    // collector who is signed in (owner, 2026-10-20).
    await page.goto(`/browse?set=${SET}&q=${encodeURIComponent(card.fullName)}`);
    await signedIn(page);
    await page.getByRole('link', {name: card.fullName, exact: true}).click();
    const stripe = page.getByTestId('card-overview-copies-slot').getByRole('group');
    await expect(stripe).toHaveAccessibleName('Your copies: 1 normal, 0 foil');
    // The dialog moves focus to its × 100ms after opening; a 100ms timer set now runs after it.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));

    // Always open, the stripe needs no pointing: the mouse adds a normal copy...
    const normalPlus = stripe.getByRole('button', {name: `Add one copy of ${card.fullName}`, exact: true});
    await normalPlus.click();
    await expect(stripe).toHaveAccessibleName('Your copies: 2 normal, 0 foil');
    // ...and the keyboard a foil one, tabbing on through the foil's −, at 0, to its +.
    await normalPlus.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(stripe.getByRole('button', {name: `Add one copy of foil ${card.fullName}`, exact: true})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(stripe).toHaveAccessibleName('Your copies: 2 normal, 1 foil');

    // Saved to the account a moment after the presses.
    await expect.poll(() => writes.at(-1)?.[String(card.id)]).toEqual({normal: 2, foil: 1});
  });

  test('Owned keeps the held cards alone, and leaving the mode drops that view', async ({page}) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    await page
      .getByRole('group', {name: 'Binder shows'})
      .getByRole('button', {name: 'Owned'})
      .click();

    await expect(page).toHaveURL(/[?&]owned=owned/);
    await expect(binder(page).getByTestId('card-tile')).toHaveCount(HELD);

    await page.getByRole('button', {name: 'Show my collection'}).click();
    // Back on the grid, which has no collection to view: neither param survives.
    await expect(binder(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has('binder')).toBe(false);
    expect(new URL(page.url()).searchParams.has('owned')).toBe(false);
  });

  test('under Master set, Owned and Missing ask for a copy in each finish', async ({page}) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}&owned=owned`);
    const tiles = binder(page).getByTestId('card-tile');
    const shows = page.getByRole('group', {name: 'Binder shows'});
    await expect(tiles).toHaveCount(HELD);

    // The three base cards are held in one finish, so toward Master only the printing is done.
    await numbers(page)
      .getByRole('button', {name: /^Master set/})
      .click();
    await expect(tiles).toHaveCount(MASTER);

    // And Missing lists all three, as Master's number counts them, the set's first cards first:
    // Set 3's Nani - Protective Sister, held as a normal copy, hid from it while Master read 99%
    // (owner, 2026-10-20). The rest of the set fills spreads past the first, so no count here.
    await shows.getByRole('button', {name: 'Missing'}).click();
    for (const [i, card] of HELD_BASE.entries()) {
      await expect(tiles.nth(i)).toHaveAccessibleName(card.fullName);
    }

    // The page holds the choice, so a switch to the whole collection keeps it, and its Owned too.
    await page.getByRole('button', {name: /^Binder set/}).click();
    await page
      .getByRole('listbox', {name: 'Standard sets'})
      .getByRole('option', {name: /^All sets, the whole collection/})
      .click();
    await expect(numbers(page).getByRole('button', {name: /^Master collection/})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await shows.getByRole('button', {name: 'Owned'}).click();
    await expect(tiles).toHaveCount(MASTER);
  });

  test("the set picker's All sets opens the whole collection in the binder", async ({page}) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    await page.getByRole('button', {name: /^Binder set/}).click();
    await page
      .getByRole('listbox', {name: 'Standard sets'})
      .getByRole('option', {name: /^All sets, the whole collection/})
      .click();

    await expect(page).toHaveURL(/[?&]binder=all(&|$)/);
    await expect(page.getByRole('button', {name: 'Binder set: All sets, the whole collection'})).toBeVisible();
    // The binder and its numbers follow, not only the URL and the picker's label.
    await expect(numbers(page).getByText('Complete collection', {exact: true})).toBeVisible();
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
  });

  test('the keyboard pages the binder end to end without losing the focus', async ({page}) => {
    // #790: the pockets are one Tab stop between the arrows on the spread's edges (owner,
    // 2026-10-22), which stay focused, dimmed, at either end.
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByTestId('card-tile');
    await expect(tiles.first()).toBeVisible();

    await tiles.first().focus();
    await page.keyboard.press('Shift+Tab');
    const previous = binder(page).getByRole('button', {name: 'Previous spread'});
    await expect(previous).toBeFocused();
    await expect(previous).toHaveAttribute('aria-disabled', 'true');

    // Past the pockets' one stop to Next, then Enter through to the last spread.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const next = binder(page).getByRole('button', {name: 'Next spread'});
    await expect(next).toBeFocused();
    // Focused from the keyboard, an edge disc grows as it does under the pointer (owner, 2026-10-22).
    await expect.poll(() => settledWidth(next), {message: 'the focused Next disc'}).toBeCloseTo(40, 0);
    const shown = binder(page).getByRole('navigation', {name: 'Binder pages'}).locator('[aria-current="true"]');
    const spreads = Number(/ of (\d+)/.exec((await shown.getAttribute('aria-label')) ?? '')?.[1]);
    expect(spreads, 'spreads in the set').toBeGreaterThan(1);
    for (let turn = 1; turn < spreads; turn++) await page.keyboard.press('Enter');
    await expect(shown).toHaveAccessibleName(new RegExp(`^Spread ${spreads} of ${spreads}:`));
    await expect(next).toBeFocused();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    // At the binder's end it is small again, though it keeps the focus.
    await expect.poll(() => settledWidth(next), {message: 'the Next disc at the end'}).toBeCloseTo(28, 0);
  });

  // Where the window's height runs out first, the cards take their size from it and stop short
  // of the binder's box: the spread stopped 42px short of the search bar's end at 1920x900, and
  // 336px at 2560x1080. Its pages now take that width as margin around their pockets.
  for (const size of [
    {width: 1920, height: 900},
    {width: 2560, height: 1080},
  ]) {
    test(`the spread runs the search bar's length at ${size.width}x${size.height}, where the window's height runs out first, its cards keeping their size (owner, 2026-10-23)`, async ({
      page,
    }) => {
      const margin = await checkSpreadAt(page, size);
      // Wider than its padding, or the window no longer tests what it is here for.
      expect(margin, 'the margin beside the pockets, where the height runs out first').toBeGreaterThan(13);
    });
  }

  test("the spread fills its box at 1440x900, where the window's width runs out first, as on master", async ({
    page,
  }) => {
    const margin = await checkSpreadAt(page, {width: 1440, height: 900});
    // The pockets fill their page's width inside its padding, as before the pages widened.
    expect(Math.abs(margin - 12), 'the margin beside the pockets').toBeLessThanOrEqual(1);
  });

  test("the spread's edge discs grow under the pointer, clear of the panels beside it (owner, 2026-10-22)", async ({
    page,
  }) => {
    await page.setViewportSize({width: 1920, height: 900});
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();

    // A disc grows from 28px to 40px about its centre (`NavArrowButton`), still 2px past its
    // page's edge, so it reaches 22px into the spread's 32px gutter (`BROWSE_GUTTER`).
    const next = binder(page).getByRole('button', {name: 'Next spread'});
    await expect.poll(() => settledWidth(next), {message: 'the Next disc at rest'}).toBeCloseTo(28, 0);
    await next.hover();
    await expect.poll(() => settledWidth(next), {message: 'the Next disc grown'}).toBeCloseTo(40, 0);
    const right = await edges(binder(page).getByRole('group', {name: 'Right page'}));
    const grownNext = await edges(next);
    const setPanel = await edges(page.getByRole('complementary', {name: 'Set'}));
    expect(Math.abs(middle(grownNext) - right.right), 'the grown Next disc off the end').toBeLessThanOrEqual(4);
    expect(setPanel.left - grownNext.right, 'the grown Next disc into the Set panel').toBeGreaterThan(0);
    expect(await shownSideToSide(next), 'the grown Next disc cut off or covered').toBe(true);

    // Previous on the second spread: on the first it is dimmed, and stays small.
    await next.click();
    const leftPage = binder(page).getByRole('group', {name: 'Left page'});
    await expect(leftPage).toBeVisible();
    const previous = binder(page).getByRole('button', {name: 'Previous spread'});
    await expect.poll(() => settledWidth(previous), {message: 'the Previous disc at rest'}).toBeCloseTo(28, 0);
    await previous.hover();
    await expect.poll(() => settledWidth(previous), {message: 'the Previous disc grown'}).toBeCloseTo(40, 0);
    const left = await edges(leftPage);
    const grownPrevious = await edges(previous);
    const filters = await edges(page.getByRole('complementary', {name: 'Filters'}));
    expect(Math.abs(middle(grownPrevious) - left.left), 'the grown Previous disc off the start').toBeLessThanOrEqual(4);
    expect(grownPrevious.left - filters.right, 'the grown Previous disc into the Filters panel').toBeGreaterThan(0);
    expect(await shownSideToSide(previous), 'the grown Previous disc cut off or covered').toBe(true);
  });

  test("a search narrows the binder, and the panel's numbers count only what it finds", async ({
    page,
  }) => {
    // A held card with no alt-art printing, so its name finds one pocket.
    const card = HELD_BASE.find((c) => !c.variants?.length);
    test.skip(!card, `None of Set ${SET}'s first three cards is without a printing.`);
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    await page.getByTestId('browse-search').fill(cardFullNameById(String(card!.id)));

    await expect(binder(page).getByTestId('card-tile')).toHaveCount(1, {timeout: 10_000});
    await expect(numbers(page)).toContainText('1 of 1 cards');
    // Filtered, the headline names no set: the cards it counts are not one (owner, 2026-10-15).
    await expect(numbers(page).getByText('Complete', {exact: true})).toBeVisible();
  });

  test('Alt art cards picks the alt-art rarities, and the binder counts only those printings', async ({
    page,
  }) => {
    test.skip(!HELD_ALT, `Set ${SET} has no alt-art printings.`);
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    const preset = page
      .getByRole('complementary', {name: 'Filters'})
      .getByRole('button', {name: 'Alt art cards'});
    await preset.click();

    await expect(preset).toHaveAttribute('aria-pressed', 'true');
    // The promos too (owner, 2026-10-17), though a set's binder holds none: they are its promo sets'.
    expect(new URL(page.url()).searchParams.get('rarity')?.split(',').sort()).toEqual([
      'Enchanted',
      'Epic',
      'Iconic',
      'Special',
    ]);
    await expect(numbers(page)).toContainText(`1 of ${PRINTINGS.length} cards`);
  });

  test("the set picker lists the promo sets under their own tab, and a promo set's binder holds a pocket per number", async ({
    page,
  }) => {
    const promoSet = promoSetWithOpenPocket();
    await signInAsCollector(page, {...ENTRIES, [promoSet.promos[0]]: {normal: 0, foil: 1}});
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    await page.getByRole('button', {name: /^Binder set/}).click();
    await page.getByRole('dialog', {name: 'Binder set'}).getByRole('button', {name: 'Promo', exact: true}).click();
    await page
      .getByRole('listbox', {name: 'Promo sets'})
      .getByRole('option', {name: new RegExp(`^Promo set ${promoSet.code},`)})
      .click();

    await expect(page).toHaveURL(new RegExp(`[?&]binder=${promoSet.code}(&|$)`));
    // Complete set alone, counting promos: a promo set's numbers show no Master (#805).
    await expect(numbers(page)).toContainText(`1 of ${promoSet.promos.length} promos`);
    await expect(numbers(page).getByRole('button', {name: /^Master/})).toHaveCount(0);
    // The promo set's binder is on show, so the turns go to it. It opens on the front cover
    // (#806), so the open pocket can be a spread or more in.
    for (let spread = 1; spread < promoSet.openSpread; spread++) {
      await page.getByRole('button', {name: 'Next spread'}).last().click();
    }
    // A number with no promo is an open pocket, which shows the number's code (owner, 2026-10-17,
    // layout 1): why it is open (not listed, not released) is the promo set's to say.
    await expect(binder(page).getByText(promoSet.openPocket, {exact: true})).toBeVisible();
  });

  test("the set picker's Promo tab opens every promo set at once, counted as promos, with no Rarity filter (owner, 2026-10-20)", async ({
    page,
  }) => {
    const promoSet = promoSetWithOpenPocket();
    await signInAsCollector(page, {...ENTRIES, [promoSet.promos[0]]: {normal: 0, foil: 1}});
    await page.goto(`/browse?binder=${SET}&rarity=Common`);
    await expect(binder(page)).toBeVisible();
    const rarities = page.getByRole('complementary', {name: 'Filters'}).getByRole('group', {name: 'Rarity filters'});
    await expect(rarities).toBeVisible();

    await page.getByRole('button', {name: /^Binder set/}).click();
    await page.getByRole('dialog', {name: 'Binder set'}).getByRole('button', {name: 'Promo', exact: true}).click();
    await page
      .getByRole('listbox', {name: 'Promo sets'})
      .getByRole('option', {name: /^All sets, every promo set/})
      .click();

    await expect(page).toHaveURL(/[?&]binder=promos(&|$)/);
    // Every card is a promo: the Rarity filter goes, param and section, so it never empties the binder unseen.
    await expect(page).not.toHaveURL(/[?&]rarity=/);
    await expect(rarities).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Binder set: Promos, every promo set'})).toBeVisible();
    await expect(numbers(page).getByText('Complete promos', {exact: true})).toBeVisible();
    // The one promo held, among every promo set's, and no Master, as for one promo set.
    // The region's text runs its blocks together ("Complete promos1 of 261 promos"): no `\b`.
    await expect(numbers(page)).toContainText(/(?<!\d)1 of [\d,]+ promos/);
    await expect(numbers(page).getByRole('button', {name: /^Master/})).toHaveCount(0);
  });

  test("the set picker opens the whole collection's menu on Promo while the Rarity filter picks the promos (owner, 2026-10-20)", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto('/browse?binder=all&rarity=Special');
    await expect(binder(page)).toBeVisible();

    await page.getByRole('button', {name: /^Binder set/}).click();
    const menu = page.getByRole('dialog', {name: 'Binder set'});
    await expect(menu.getByRole('button', {name: 'Promo', exact: true})).toHaveAttribute('aria-pressed', 'true');
    await expect(menu.getByRole('listbox', {name: 'Promo sets'})).toBeVisible();
  });

  test("the gear after Collection opens the import from its menu, on the grid too (owner, 2026-10-20)", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto('/browse');
    await signedIn(page);

    const gear = page.getByRole('button', {name: 'Collection actions'});
    await gear.click();
    await page
      .getByRole('menu', {name: 'Collection actions'})
      .getByRole('menuitem', {name: /^Import collection/})
      .click();

    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toBeVisible();
    await expect(page.getByRole('menu', {name: 'Collection actions'})).toHaveCount(0);
  });

  test("a card glows gold when pointed at, more strongly on the binder's parchment (owner, 2026-10-21)", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);

    // The grid: the glow over the tile's resting shadow, lifted a layer, and no gold ring.
    await page.goto(`/browse?set=${SET}`);
    const tile = page.getByTestId('card-tile').first();
    await tile.hover();
    await expect(tile).toHaveCSS('box-shadow', /rgba\(255, 185, 0, 0\.4\d*\) 0px 0px 22px 3px/);
    await expect(tile).toHaveCSS('z-index', '1');
    expect(await tile.evaluate((t) => getComputedStyle(t, '::after').content)).toBe('none');
    // The first row's glow fits inside the grid's scroller, which clips it: 24px above the
    // tile, past its 3px spread and 22px blur, nothing of it shows any more.
    const roomAbove = await tile.evaluate(
      (t) => t.getBoundingClientRect().top - t.closest('[data-testid="virtuoso-scroller"]')!.getBoundingClientRect().top,
    );
    expect(roomAbove).toBeGreaterThanOrEqual(24);

    // A binder pocket: the stronger gold, which shows on the parchment.
    await page.goto(`/browse?binder=${SET}`);
    const pocket = binder(page).getByRole('button', {name: HELD_BASE[0].fullName, exact: true});
    await pocket.hover();
    await expect(pocket).toHaveCSS('box-shadow', /rgba\(255, 185, 0, 0\.8\d*\) 0px 0px 22px 4px/);
  });

  test('a signed-in visitor without a collection is asked to import one', async ({page}) => {
    await signInAsCollector(page, null);
    await page.goto('/browse');
    await signedIn(page);

    await page.getByRole('button', {name: 'Show my collection'}).click();

    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toBeVisible();
    await expect(binder(page)).toHaveCount(0);
  });

  test("a pre-Core card's window offers its Enchanted, and the Enchanted's pocket opens the card on it (#891)", async ({
    page,
  }) => {
    // Sets 1-8 keep a card's printings as cards of their own, each a pocket bearing its name.
    const card = preCoreCardWithEnchanted();
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${card.setCode}&q=${encodeURIComponent(card.fullName)}`);
    const tiles = binder(page).getByTestId('card-tile');
    await expect(tiles).toHaveCount(2);
    const modal = page.getByTestId('card-overview-modal');
    // The printing in front of the card's stack: the others sit behind it, inert.
    const inFront = modal.locator('[data-slide]:not([inert]) img');

    // The card's own pocket opens it on its Standard printing, its Enchanted behind it.
    await tiles.nth(0).click({position: {x: 10, y: 10}});
    await expect(modal.locator('h1')).toHaveText(card.fullName);
    await expect(inFront).toHaveAttribute('alt', card.fullName);
    await expect(modal.getByRole('button', {name: 'Next printing: Enchanted'})).toHaveCount(1);
    // The dialog moves focus to its × 100ms after opening; a 100ms timer set now runs after it.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);

    // The Enchanted's pocket opens the card itself, on the Enchanted.
    await tiles.nth(1).click({position: {x: 10, y: 10}});
    await expect(modal.locator('h1')).toHaveText(card.fullName);
    await expect(inFront).toHaveAttribute('alt', /, Enchanted printing$/);
  });

  test('after a search in the grid, collection mode loads only sets 9-14, the search having loaded the rest (#911)', async ({
    page,
  }, testInfo) => {
    // One project is enough: this asserts what the network requests.
    if (testInfo.project.name !== 'chromium') test.skip();
    await signInAsCollector(page, ENTRIES);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    const collectionFiles = () => requests.filter((pathname) => pathname.startsWith('/data/collection/'));
    await page.goto('/browse?q=Ariel+On+Human');
    await signedIn(page);
    // A Set 1 card in the grid: the search's files have landed.
    await expect(page.getByRole('button', {name: 'Ariel - On Human Legs', exact: true})).toBeVisible();
    const searchLoaded = collectionFiles().length;

    await page.getByRole('button', {name: 'Show my collection'}).click();

    // The binder's cards, in place of its shimmer once every chunk has landed (it loads all or nothing).
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
    const coreSets = ['9', '10', '11', '12', '13', '14'].map((set) => `/data/collection/${set}.json`);
    expect(collectionFiles().slice(searchLoaded).sort()).toEqual(coreSets.sort());
  });
  test("the first switch draws the binder's frame while its code loads, and the toolbar holds still", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    const {before, release} = await pressCollectionWithBinderHeld(page);
    // The set panel's body, held in its two parts: what the binder shows, then the numbers in
    // the rest of the panel.
    await expect(setPanelParts(page)).toHaveCount(2);
    const [showsHeld, numbersHeld] = [await placeOf(setPanelParts(page).nth(0)), await placeOf(setPanelParts(page).nth(1))];

    release();
    await expect(binder(page)).toBeVisible();
    // The set picker beside Collection, which its placeholder held a place for.
    await expect(page.getByRole('button', {name: /^Binder set/})).toBeVisible();
    await expect(binderLoading(page)).toHaveCount(0);
    expectToolbarHeld(before, await toolbarPlaces(page));
    expectPlacesHeld([
      {name: 'Binder shows', before: showsHeld, after: await placeOf(page.getByRole('group', {name: 'Binder shows'}))},
      {name: 'Collection numbers', before: numbersHeld, after: await placeOf(numbers(page))},
    ]);
  });

  test("a pointer resting on Collection asks for the binder's code before the press", async ({page}, testInfo) => {
    // One project is enough: this asserts when the request goes out.
    if (testInfo.project.name !== 'chromium') test.skip();
    await signInAsCollector(page, ENTRIES);
    const requested: string[] = [];
    page.on('request', (request) => {
      if (isModuleRequest(request.url(), 'CollectionBinderSection')) requested.push(request.url());
    });
    await page.goto('/browse');
    await signedIn(page);
    const toggle = page.getByRole('button', {name: 'Show my collection'});

    await toggle.hover();
    // Asked for on the pointer's arrival, with no press yet.
    await expect.poll(() => requested.length).toBeGreaterThan(0);
    await toggle.click();
    await expect(binder(page)).toBeVisible();
  });

  test("opening the collection's actions menu asks for the import dialog's code before Import collection is chosen", async ({
    page,
  }, testInfo) => {
    // One project is enough: this asserts what the network requests.
    if (testInfo.project.name !== 'chromium') test.skip();
    await signInAsCollector(page, ENTRIES);
    const requested: string[] = [];
    page.on('request', (request) => {
      if (isModuleRequest(request.url(), 'ImportCollectionDialog')) requested.push(request.url());
    });
    await page.goto('/browse');
    await signedIn(page);
    expect(requested).toEqual([]);

    await page.getByRole('button', {name: 'Collection actions'}).click();
    await expect.poll(() => requested.length).toBe(1);
    await page
      .getByRole('menu', {name: 'Collection actions'})
      .getByRole('menuitem', {name: /^Import collection/})
      .click();

    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toBeVisible();
    expect(requested).toHaveLength(1);
  });
});

test.describe('Collection mode, signed in (phone width)', () => {
  // Runs on every project, not just mobile-*: the strip is chosen by width (useResponsive), so a
  // forced phone viewport renders it anywhere, including the chromium-only Windows pre-push.
  test("the set strip reads the set's two percentages and opens its numbers inline", async ({
    page,
  }) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();
    // No gear on phones (owner, 2026-10-20): it wrapped Collection onto a row of its own.
    await expect(page.getByRole('button', {name: 'Collection actions'})).toHaveCount(0);

    // Above the page, in place of the docked panel: the numbers stay folded behind a toggle
    // that reads the two headline percentages, Complete then Master.
    const strip = page.getByRole('region', {name: 'Set', exact: true});
    const show = strip.getByRole('button', {name: 'Show the numbers'});
    await expect(show).toHaveText(`${percentOfSet(HELD)}% · ${percentOfSet(MASTER)}%`);
    await expect(numbers(page)).toHaveCount(0);

    await show.click();
    const hide = strip.getByRole('button', {name: 'Hide the numbers'});
    await expect(hide).toHaveAttribute('aria-expanded', 'true');
    await expect(numbers(page).getByText('Complete set', {exact: true})).toBeVisible();

    await hide.click();
    await expect(numbers(page)).toHaveCount(0);
  });

  test("the first switch draws the binder's frame while its code loads, and the toolbar holds still", async ({
    page,
  }) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInAsCollector(page, ENTRIES);
    const {before, release} = await pressCollectionWithBinderHeld(page);

    release();
    await expect(binder(page)).toBeVisible();
    await expect(binderLoading(page)).toHaveCount(0);
    expectToolbarHeld(before, await toolbarPlaces(page));
  });
});
