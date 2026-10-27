import type {Locator, Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {test, expect} from '../fixtures';
import {
  cardFullNameById,
  newestCoreSet,
  preCoreCardWithEnchanted,
  promoSetWithOpenPocket,
  setCards,
  setPrintings,
} from '../helpers/cardData';
import {
  artFilter,
  binder,
  board,
  BOARD,
  COLLECTIONS_PATH,
  type Entries,
  hasStyleFor,
  MISSING_GREY,
  openPromoBinder,
  signInAsCollector,
  stubCardArt,
  teethIn,
} from '../helpers/collector';
import {holdLazyModule} from '../helpers/lazyModule';
import {colourOf, contrast, edges, lightestIn, middle, type Place, placeOf, type Rgb} from '../helpers/screen';

/**
 * Collection mode (#553 Phase C), behind `VITE_SHOW_COLLECTION` and pinned on in
 * `playwright.config.ts` together with the accounts flag it requires.
 *
 * Signed in without signing in: `signInAsCollector` (`helpers/collector.ts`) restores a stored
 * session and the collector's collection. The binder's look (#941), its pages, pockets and
 * motion, has its own spec, `collection-binder.spec.ts`.
 *
 * The collection is drawn from the card data, not hardcoded: the newest set's first three
 * cards and its first alt-art printing, so the suite follows the data when a set graduates.
 */

const SET = newestCoreSet();
const BASE = setCards(SET);
const PRINTINGS = setPrintings(SET);
/** The binder's pockets for the set: every card, and every alt-art printing as one of its own. */
const SET_TOTAL = BASE.length + PRINTINGS.length;
const HELD_BASE = BASE.slice(0, 3);
const HELD_ALT = PRINTINGS[0];

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

/** Waits for the restored session: the header's control turns from "Sign in" to "Account". */
async function signedIn(page: Page): Promise<void> {
  await expect(
    page.getByTestId('compact-header').getByRole('button', {name: 'Account', exact: true}),
  ).toBeVisible();
}

const numbers = (page: Page) => page.getByRole('region', {name: 'Collection numbers'});

/** What collection mode draws while the binder's code downloads (#913). */
const binderLoading = (page: Page) => page.getByRole('region', {name: 'Loading your binder'});

/** A lazy module's request, on the dev server or in a production build (see helpers/lazyModule.ts). */
const isModuleRequest = (url: string, name: string) => new RegExp(`/${name}(\\.tsx|-[\\w-]+\\.js)(\\?|$)`).test(url);

/** Browse's toolbar, and the row a phone draws in its place in collection mode (#969). */
const TOOLBAR = 'browse-toolbar';
const PHONE_ROW = 'phone-binder-row';

const phoneRow = (page: Page) => page.getByTestId(PHONE_ROW);

/**
 * The open page's mini in a phone's page map (#969), named like "Page 5 of 27: 4 missing". Found
 * by CSS, so it reads under the Binder sheet too, where the page behind is hidden from the
 * accessibility tree.
 */
const shownPage = (page: Page) => page.locator('nav[aria-label="Binder pages"] [aria-current="true"]');

/** The Binder sheet, which the row's Filters opens on a phone: not the "Binder set" list. */
const binderSheet = (page: Page) => page.getByRole('dialog', {name: 'Binder', exact: true});

/**
 * Opens a phone's binder at `url`, and waits for its page map: the binder's own, which is named,
 * not the one it draws while its cards load, hidden since it holds none.
 */
async function openPhoneBinder(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(binder(page).getByRole('navigation', {name: 'Binder pages'})).toBeVisible();
}

type UrlWrites = Window & {urlWrites?: string[]};

/** Records the page's URL writes (`history.replaceState`), from before its first navigation. */
async function countUrlWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const writes: string[] = [];
    (window as UrlWrites).urlWrites = writes;
    const replace = history.replaceState.bind(history);
    history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
      writes.push(String(url));
      replace(state, unused, url);
    };
  });
}

/** The URL writes since the last clear. */
const urlWrites = (page: Page) => page.evaluate(() => (window as UrlWrites).urlWrites ?? []);
const clearUrlWrites = (page: Page) => page.evaluate(() => (window as UrlWrites).urlWrites?.splice(0));

/**
 * Where each of Browse's toolbar controls stands, by name, once the page's fonts are in: its
 * layout box, which the hover's brief scale on a button (CtaButton's boop) leaves alone, where
 * getBoundingClientRect would catch the button mid-scale under the pointer that pressed it.
 * `testId` names the toolbar, or a phone's row.
 */
async function toolbarPlaces(page: Page, testId = TOOLBAR): Promise<Record<string, Place>> {
  // A late font changes the labels' widths, and with them where the controls after them stand.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page
    .getByTestId(testId)
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

/** The room a toolbar (`testId`, or a phone's row) keeps above its first control and below it, to the pixel. */
const roomRound = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((toolbar) => {
    const box = toolbar.getBoundingClientRect();
    const control = toolbar.querySelector('button')!.getBoundingClientRect();
    return {
      above: Math.round(control.top - box.top),
      below: Math.round(box.bottom - control.bottom),
    };
  });

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
 * an empty area. Returns the toolbar (`testId`, or a phone's row) as it stood then, and the
 * release.
 */
async function pressCollectionWithBinderHeld(
  page: Page,
  testId = TOOLBAR,
): Promise<{before: Record<string, Place>; release: () => void}> {
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
  return {before: await toolbarPlaces(page, testId), release: binderCode.release};
}

/**
 * An element's width once its transitions have run, or -1 while one runs. An edge disc grows
 * with a bounce that overshoots, and its button's boop scales it 3% on the way, so its width
 * says how big it is only once both have settled.
 */
async function settledWidth(locator: Locator): Promise<number> {
  return locator.evaluate((el) => (el.getAnimations().length > 0 ? -1 : el.getBoundingClientRect().width));
}

/**
 * Moves the pointer straight to the element's centre. A hover first waits for its target to
 * hold still, which took CI's WebKit up to 5.6s for an edge disc beside the binder's pockets.
 */
async function pointAt(locator: Locator): Promise<void> {
  const {x, y, width, height} = await placeOf(locator);
  await locator.page().mouse.move(x + width / 2, y + height / 2);
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
 * height gives them. Since #941 those edges are the board's, the pages 14px inside it. Returns
 * the right page's margin beside its pockets.
 */
async function checkSpreadAt(page: Page, size: {width: number; height: number}): Promise<number> {
  await page.setViewportSize(size);
  await signInAsCollector(page, ENTRIES);
  await page.goto(`/browse?binder=${SET}`);
  await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();

  const search = await edges(page.getByRole('textbox', {name: 'Search cards'}));
  const frame = await edges(board(page));
  const cover = await edges(binder(page).getByRole('group', {name: 'Front cover'}));
  const rightPage = binder(page).getByRole('group', {name: 'Right page'});
  const right = await edges(rightPage);
  expect(Math.abs(frame.left - search.left), 'the starts apart').toBeLessThanOrEqual(1);
  expect(Math.abs(frame.right - search.right), 'the ends apart').toBeLessThanOrEqual(1);
  expect(Math.abs(cover.left - frame.left - BOARD), 'the board beside the front cover').toBeLessThanOrEqual(1);
  expect(Math.abs(frame.right - right.right - BOARD), 'the board beside the right page').toBeLessThanOrEqual(1);
  expect(Math.abs(right.top - frame.top - BOARD), 'the board above the pages').toBeLessThanOrEqual(1);
  expect(Math.abs(frame.bottom - right.bottom - BOARD), 'the board below the pages').toBeLessThanOrEqual(1);
  // Each disc's centre sits 2px past the board's outer edge (`edgeArrowPlace`).
  const previous = await edges(binder(page).getByRole('button', {name: 'Previous spread'}));
  const next = await edges(binder(page).getByRole('button', {name: 'Next spread'}));
  expect(Math.abs(middle(previous) - frame.left), 'the Previous disc off the start').toBeLessThanOrEqual(4);
  expect(Math.abs(middle(next) - frame.right), 'the Next disc off the end').toBeLessThanOrEqual(4);

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

/** How gold a colour leans: its red over its blue. The board and the pages lean a little blue. */
const goldOf = ([r, , b]: Rgb) => r - b;

/** The standard card glow (`--tile-glow`, owner 2026-10-21), as a computed box-shadow lists it. */
const STANDARD_GLOW = /rgba\(255, 185, 0, 0\.42\) 0px 0px 22px 3px/;

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

    // Neither the 14 non-Core chunks nor the binder's lazy component, nor its stylesheet (#941).
    expect(requests.filter((url) => url.includes('/data/collection/'))).toEqual([]);
    expect(requests.filter((url) => url.includes('CollectionBinderSection'))).toEqual([]);
    expect(await hasStyleFor(page, '.binder-board')).toBe(false);
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
    // The docked collection and Filters panels are the desktop layout. Phones get the binder's
    // row (tested at phone width below) and the filter drawer, which these locators miss.
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

    // A disc grows from 28px to 40px about its centre (`NavArrowButton`), still 2px past the
    // board's edge (the page's, before #941), so it reaches 22px into the spread's 32px gutter
    // (`BROWSE_GUTTER`).
    const next = binder(page).getByRole('button', {name: 'Next spread'});
    await expect.poll(() => settledWidth(next), {message: 'the Next disc at rest'}).toBeCloseTo(28, 0);
    await pointAt(next);
    await expect.poll(() => settledWidth(next), {message: 'the Next disc grown'}).toBeCloseTo(40, 0);
    const frame = await edges(board(page));
    const grownNext = await edges(next);
    const setPanel = await edges(page.getByRole('complementary', {name: 'Set'}));
    expect(Math.abs(middle(grownNext) - frame.right), 'the grown Next disc off the end').toBeLessThanOrEqual(4);
    expect(setPanel.left - grownNext.right, 'the grown Next disc into the Set panel').toBeGreaterThan(0);
    expect(await shownSideToSide(next), 'the grown Next disc cut off or covered').toBe(true);

    // Previous on the second spread: on the first it is dimmed, and stays small.
    await next.click();
    const leftPage = binder(page).getByRole('group', {name: 'Left page'});
    await expect(leftPage).toBeVisible();
    const previous = binder(page).getByRole('button', {name: 'Previous spread'});
    await expect.poll(() => settledWidth(previous), {message: 'the Previous disc at rest'}).toBeCloseTo(28, 0);
    await pointAt(previous);
    await expect.poll(() => settledWidth(previous), {message: 'the Previous disc grown'}).toBeCloseTo(40, 0);
    const grownPrevious = await edges(previous);
    const filters = await edges(page.getByRole('complementary', {name: 'Filters'}));
    expect(Math.abs(middle(grownPrevious) - frame.left), 'the grown Previous disc off the start').toBeLessThanOrEqual(4);
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

    await openPromoBinder(page, promoSet.code);
    // Complete set alone, counting promos: a promo set's numbers show no Master (#805).
    await expect(numbers(page)).toContainText(`1 of ${promoSet.promos.length} promos`);
    await expect(numbers(page).getByRole('button', {name: /^Master/})).toHaveCount(0);
    // The promo set's binder is on show, so the turns go to it. It opens on the front cover
    // (#806), so the open pocket can be a spread or more in. The turns go under reduced motion,
    // which swaps the spread at once (#942): the page turn isn't what this test measures.
    await page.emulateMedia({reducedMotion: 'reduce'});
    for (let spread = 1; spread < promoSet.openSpread; spread++) {
      await page.getByRole('button', {name: 'Next spread'}).last().click();
    }
    await expect(binder(page).locator('.binder-turn')).toHaveCount(0);
    await page.emulateMedia({reducedMotion: 'no-preference'});
    // A number with no promo is an open pocket, which shows the number's code (owner, 2026-10-17,
    // layout 1): why it is open (not listed, not released) is the promo set's to say.
    const code = binder(page).getByText(promoSet.openPocket, {exact: true});
    await expect(code).toBeVisible();
    // Readable on the black page (#941): the heart of the code's strokes against its pocket's own
    // ground, beside the code in the pocket's padding on either side, both as the page draws them,
    // under the pocket's front sheet, by WCAG's measure. Both sides, since the page's shade by the
    // spine shows through the sleeve and darkens a pocket's padding there. Never above the code:
    // there a code broken over two lines read the pocket above's card as it faded in (#973).
    const pocket = binder(page)
      .locator('.binder-pocket')
      .filter({has: page.getByText(promoSet.openPocket, {exact: true})});
    const room = await edges(pocket);
    const place = await placeOf(code);
    const y = place.y + place.height / 2 - 2;
    const left = {x: room.left + 1, y, width: 4, height: 4};
    const right = {x: room.right - 5, y, width: 4, height: 4};
    expect(left.x + left.width, 'the ground left of the code is clear of it').toBeLessThanOrEqual(place.x);
    expect(right.x, 'the ground right of the code is clear of it').toBeGreaterThanOrEqual(place.x + place.width);
    const ink = await lightestIn(page, place);
    for (const beside of [left, right]) {
      const ground = await colourOf(page, beside);
      expect(contrast(ink, ground), `the open pocket's code, ${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
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

  test('a card glows gold when pointed at or focused, in the grid and in the binder alike (owner, 2026-10-21, #941)', async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);

    // The grid: the glow over the tile's resting shadow, lifted a layer, and no gold ring.
    await page.goto(`/browse?set=${SET}`);
    const tile = page.getByTestId('card-tile').first();
    await tile.hover();
    await expect(tile).toHaveCSS('box-shadow', STANDARD_GLOW);
    await expect(tile).toHaveCSS('z-index', '1');
    expect(await tile.evaluate((t) => getComputedStyle(t, '::after').content)).toBe('none');
    // The first row's glow fits inside the grid's scroller, which clips it: 24px above the
    // tile, past its 3px spread and 22px blur, nothing of it shows any more.
    const roomAbove = await tile.evaluate(
      (t) => t.getBoundingClientRect().top - t.closest('[data-testid="browse-grid-scroller"]')!.getBoundingClientRect().top,
    );
    expect(roomAbove).toBeGreaterThanOrEqual(24);

    // A binder pocket: the same glow, which shows on the black pages as on any grid (#941),
    // and the card stays where it settled.
    await page.goto(`/browse?binder=${SET}`);
    const pocket = binder(page).getByRole('button', {name: HELD_BASE[0].fullName, exact: true});
    await expect(pocket).toBeVisible();
    const resting = await pocket.boundingBox();
    await pocket.hover();
    await expect(pocket).toHaveCSS('box-shadow', STANDARD_GLOW);
    expect(await pocket.boundingBox(), 'the pointed-at card moved').toEqual(resting);
    // The binder's stronger glow is gone, from its tiles and from every stylesheet.
    expect(await pocket.evaluate((t) => getComputedStyle(t).getPropertyValue('--tile-glow-strong'))).toBe('');
    expect(await hasStyleFor(page, '--tile-glow-strong')).toBe(false);

    // A missing card glows as gold: the grey is on its art alone. Measured on the page's margin
    // beside it, past its front sheet's edge.
    const missing = binder(page).getByTestId('card-tile').nth(HELD_BASE.length);
    await page.mouse.move(0, 0);
    const box = await edges(missing);
    const beside = {x: box.right + 7, y: (box.top + box.bottom) / 2 - 2, width: 3, height: 4};
    const dark = await colourOf(page, beside);
    await missing.hover();
    await expect(missing).toHaveCSS('box-shadow', STANDARD_GLOW);
    const lit = await colourOf(page, beside);
    expect(goldOf(lit) - goldOf(dark), `the missing card's glow beside it: ${dark} to ${lit}`).toBeGreaterThan(15);

    // Focused from the keyboard, with the mouse away: the glow and the gold focus ring, the
    // missing card's too. The pockets are one Tab stop, the arrows move between them (#790).
    await page.mouse.move(0, 0);
    await binder(page).getByRole('button', {name: 'Previous spread'}).focus();
    await page.keyboard.press('Tab');
    for (let step = 0; step < HELD_BASE.length; step++) await page.keyboard.press('ArrowRight');
    await expect(missing).toBeFocused();
    await expect(missing).toHaveCSS('box-shadow', STANDARD_GLOW);
    await expect(missing).toHaveCSS('outline-color', 'rgb(212, 175, 55)');
    expect(await artFilter(missing)).toBe(MISSING_GREY);
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

/**
 * Phones' screens in CSS pixels, with the browser's bars showing, as #969 measured them, and the
 * rows their page has: four where they keep the cards at 90% or more of the 3-row page's
 * width, as the owner's iPhone on iOS 26 does.
 */
const PHONES = [
  {width: 393, height: 659, rows: 3}, // iPhone 15, Safari
  {width: 375, height: 629, rows: 3}, // iPhone 13 mini, Safari
  {width: 430, height: 739, rows: 3}, // iPhone 15 Pro Max, Safari
  {width: 360, height: 732, rows: 4}, // a 360px Android (Galaxy S24 class), Chrome
  {width: 412, height: 839, rows: 4}, // a Pixel 7 class Android, Chrome
  {width: 393, height: 815, rows: 4}, // an iPhone on iOS 26, Safari
];

/** How far under a 4-row page's map `<main>` may end: an iOS 26 iPhone's page, as wide as its screen lets it be, leaves 18px. */
const FOUR_ROWS_ROOM_LEFT = 24;

type Span = {top: number; bottom: number};

/**
 * How a phone's binder sits on its screen: `<main>`, the board and the page map, the open page's
 * pockets and columns, how far the box round the binder that scrolls (the section's) has to
 * scroll, and the page sideways. `scrollToEnd` scrolls that box to its end first.
 */
async function phoneBinderFit(page: Page, {scrollToEnd = false} = {}) {
  const pockets = binder(page).getByRole('group', {name: 'Page', exact: true}).locator('.binder-pocket');
  const lefts = await pockets.evaluateAll((all) => all.map((pocket) => Math.round(pocket.getBoundingClientRect().left)));
  const boxes = await binder(page).evaluate((section, toEnd) => {
    let scroller = section.parentElement;
    while (scroller && !['auto', 'scroll'].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (!scroller) throw new Error('nothing round the binder scrolls');
    if (toEnd) scroller.scrollTop = scroller.scrollHeight;
    const span = (element: Element | null): Span => {
      if (!element) throw new Error('a part of the page is missing');
      const {top, bottom} = element.getBoundingClientRect();
      return {top, bottom};
    };
    return {
      main: span(document.querySelector('main')),
      board: span(section.querySelector('.binder-board')),
      map: span(section.querySelector('nav[aria-label="Binder pages"]')),
      overflow: scroller.scrollHeight - scroller.clientHeight,
      sideways: document.documentElement.scrollWidth - window.innerWidth,
    };
  }, scrollToEnd);
  return {...boxes, pockets: lefts.length, columns: new Set(lefts).size};
}

/** A phone binder's inside front cover (owner, 2026-10-27), and its mini, first in the page map. */
const COVER_MINI = 'Front cover: collection numbers';
const phoneCover = (page: Page) => binder(page).getByRole('group', {name: 'Front cover', exact: true});
const lonePage = (page: Page) => binder(page).getByRole('group', {name: 'Page', exact: true});

/** Turns a phone's binder to its inside cover from the page map, and waits for the turn to land. */
async function toPhoneCover(page: Page): Promise<Locator> {
  await binder(page).getByRole('button', {name: COVER_MINI, exact: true}).click();
  await expect(binder(page).locator('.binder-turn')).toHaveCount(0);
  await expect(shownPage(page)).toHaveAttribute('aria-label', COVER_MINI);
  return phoneCover(page);
}

/**
 * What scrolls round the cover's numbers: the box they scroll in on the cover, past its end, and
 * the binder's section and the document, which should not.
 */
async function coverScrolls(page: Page) {
  const cover = await numbers(page).evaluate((region) => {
    const box = region.parentElement!;
    return {cover: box.scrollHeight - box.clientHeight, overflowY: getComputedStyle(box).overflowY};
  });
  const fit = await phoneBinderFit(page);
  const document = await page.evaluate(() => window.document.documentElement.scrollHeight - window.innerHeight);
  return {...cover, section: fit.overflow, document, sideways: fit.sideways};
}

test.describe('Collection mode, signed in (phone width)', () => {
  // Runs on every project, not just mobile-*: the row is chosen by width (useResponsive), so a
  // forced phone viewport renders it anywhere, including the chromium-only Windows pre-push.
  test("the set button reads the set's two percentages, in words too, and opens the set list", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();
    // No gear on phones (owner, 2026-10-20): it wrapped Collection onto a row of its own.
    await expect(page.getByRole('button', {name: 'Collection actions'})).toHaveCount(0);

    // At the head of the row over the binder (#969): the set's name over its two headline
    // percentages, Complete then Master. Its name, a line only screen readers get, says what it
    // draws and then the figures in words.
    const [complete, master] = [percentOfSet(HELD), percentOfSet(MASTER)];
    const button = phoneRow(page).getByRole('button', {name: /^Binder set: /});
    const drawn = button.locator(':scope > span[aria-hidden="true"]');
    await expect(drawn).toContainText(`${complete}% · ${master}%`);
    const setName = (await drawn.locator('span').first().innerText()).trim();
    await expect(button).toHaveAccessibleName(
      `Binder set: ${setName}, ${complete}% · ${master}%: ${complete}% complete, ${master}% master`,
    );

    await button.click();
    const set = page.getByRole('dialog', {name: 'Binder set'}).getByRole('option', {name: new RegExp(`^Set ${SET},`)});
    await expect(set).toHaveAttribute('aria-selected', 'true');
  });

  test('the binder opens whole on a phone: the row, a page of the rows that fit and its map on screen, nothing to scroll', async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    for (const {rows, ...size} of PHONES) {
      await page.setViewportSize(size);
      await page.goto(`/browse?binder=${SET}`);
      await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
      const at = `at ${size.width}x${size.height}`;
      const fit = await phoneBinderFit(page);
      expect(fit.pockets, `the page's pockets ${at}`).toBe(3 * rows);
      expect(fit.columns, `their columns ${at}`).toBe(3);
      expect(fit.board.top, `the board's top ${at}`).toBeGreaterThanOrEqual(fit.main.top);
      expect(fit.map.bottom, `the map's foot ${at}`).toBeLessThanOrEqual(fit.main.bottom);
      // Four rows fill the screen (owner, 2026-10-26): the page grows to the room under it.
      if (rows === 4)
        expect(
          fit.main.bottom - fit.map.bottom,
          `the room under the map ${at}`,
        ).toBeLessThanOrEqual(FOUR_ROWS_ROOM_LEFT);
      expect(fit.overflow, `what the binder section scrolls ${at}`).toBeLessThanOrEqual(0);
      expect(fit.sideways, `what the page scrolls sideways ${at}`).toBeLessThanOrEqual(0);
      await expect(page.getByTestId('browse-toolbar')).toHaveCount(0);
      await expect(page.getByRole('heading', {level: 1, name: 'Browse Cards'})).toBeAttached();
    }

    // A shorter screen than any of them: the section scrolls, and at its end shows the map whole.
    await page.setViewportSize({width: 375, height: 548});
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
    expect((await phoneBinderFit(page)).overflow, 'what the binder section scrolls at 375x548').toBeGreaterThan(0);
    const end = await phoneBinderFit(page, {scrollToEnd: true});
    expect(end.map.top, "the map's top, scrolled to the end").toBeGreaterThanOrEqual(end.main.top);
    expect(end.map.bottom, "the map's foot, scrolled to the end").toBeLessThanOrEqual(end.main.bottom);
  });

  test("the row is grid mode's: Filters, the set button where the sort sits, then Collection, and the map pages alone (#1000)", async ({
    page,
  }) => {
    await page.setViewportSize({width: 393, height: 659});
    await signInAsCollector(page, ENTRIES);
    await page.goto('/browse');
    await expect(page.getByTestId(TOOLBAR)).toBeVisible();
    const grid = await toolbarPlaces(page);
    const gridRoom = await roomRound(page, TOOLBAR);
    const sort = await placeOf(
      page.getByTestId(TOOLBAR).getByRole('combobox', {name: 'Sort cards'}),
    );
    await page.getByRole('button', {name: 'Show my collection'}).click();
    await expect(binder(page).getByRole('navigation', {name: 'Binder pages'})).toBeVisible();
    const row = await toolbarPlaces(page, PHONE_ROW);

    // In order, the set button named by its words: the scope's name over its figures.
    const [filters, setButton, collection] = Object.keys(row);
    expect([filters, collection]).toEqual(['Filters', 'Show my collection']);
    // Across, each where grid mode draws it, within 1 px; the row stands where the title was.
    for (const name of [filters, collection]) {
      for (const key of ['x', 'width', 'height'] as const) {
        expect(Math.abs(row[name][key] - grid[name][key]), `${name} ${key}`).toBeLessThanOrEqual(1);
      }
    }
    expect(
      Math.abs(row[setButton].x - sort.x),
      "the set button's left, at the sort's",
    ).toBeLessThanOrEqual(1);
    // All three 34px tall, the set button's two lines inside it, with grid mode's room above
    // them and below (#998: 12px and 8px).
    for (const [name, place] of Object.entries(row)) {
      expect(place.height, `${name}'s height`).toBeCloseTo(34, 1);
    }
    expect(await roomRound(page, PHONE_ROW)).toEqual(gridRoom);

    // The map's minis alone, with no "5 / 27" after them.
    const map = binder(page).getByRole('navigation', {name: 'Binder pages'});
    await expect(map.locator('..')).not.toContainText(/\d+ \/ \d+/);
  });

  test('the lone page sits in its board, one zip round its outer edge, with no scroll sideways (#941)', async ({
    page,
  }) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
    await expect(board(page)).toHaveClass(/\bbinder-board-single\b/);
    const lone = await edges(binder(page).getByRole('group', {name: 'Page', exact: true}));
    const frame = await edges(board(page));
    expect(Math.abs(frame.right - lone.right - BOARD), 'the board beside the page').toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      'the page scrolls sideways by',
    ).toBeLessThanOrEqual(0);

    // One zip, as a cover's on a desktop spread: along the top from end to end, over the spine
    // too, and down the outer side, but not down the spine's side, where the binder bends.
    const strip = {y: frame.top + 40, width: 4, height: 120};
    const third = (frame.right - frame.left - 48) / 3;
    for (const [i, end] of ['the spine end', 'the middle', 'the outer end'].entries()) {
      const top = {x: frame.left + 24 + i * third, y: frame.top + 3, width: third, height: 4};
      expect(await teethIn(page, top), `teeth along the top, ${end}`).toBeGreaterThan(0.25);
    }
    expect(await teethIn(page, {...strip, x: frame.right - 7}), 'teeth down the outer side').toBeGreaterThan(0.25);
    expect(await teethIn(page, {...strip, x: frame.left + 3}), "teeth down the spine's side").toBe(0);
  });

  test("the first switch draws the binder's frame while its code loads, and the row holds still", async ({
    page,
  }) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInAsCollector(page, ENTRIES);
    const {before, release} = await pressCollectionWithBinderHeld(page, PHONE_ROW);
    const placeholder = await placeOf(phoneRow(page).locator('.react-loading-skeleton'));

    release();
    await expect(binder(page)).toBeVisible();
    await expect(binderLoading(page)).toHaveCount(0);
    expectToolbarHeld(before, await toolbarPlaces(page, PHONE_ROW));
    // The set button lands in its placeholder's box.
    const button = await placeOf(phoneRow(page).getByRole('button', {name: /^Binder set: /}));
    expectPlacesHeld([{name: 'the set button', before: placeholder, after: button}]);
  });

  test("a phone's binder opens on page 1, its inside cover a page before it: page 1's size and place, holding the numbers, its mini first in the map (owner, 2026-10-27)", async ({
    page,
  }) => {
    await page.setViewportSize({width: 393, height: 815});
    await signInAsCollector(page, ENTRIES);
    await openPhoneBinder(page, `/browse?binder=${SET}`);
    await expect(shownPage(page)).toHaveAttribute('aria-label', /^Page 1 of /);
    const minis = binder(page).getByRole('navigation', {name: 'Binder pages'}).getByRole('button');
    await expect(minis.first()).toHaveAccessibleName(COVER_MINI);
    await expect(numbers(page), 'no numbers on page 1').toHaveCount(0);
    const pageOne = await edges(lonePage(page));

    const cover = await toPhoneCover(page);
    const drawn = await edges(cover);
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      expect(Math.abs(drawn[side] - pageOne[side]), `the cover's ${side}, at page 1's`).toBeLessThanOrEqual(1);
    }
    await expect(cover.getByRole('region', {name: 'Collection numbers'})).toContainText(`${HELD} of ${SET_TOTAL} cards`);
    await expect(cover.getByTestId('card-tile')).toHaveCount(0);
    await expect(lonePage(page)).toHaveCount(0);
  });

  test("the cover's numbers fit it whole on a 4-row phone, for a set, the whole collection and the promos, and scroll inside it on a 3-row one, alone (owner, 2026-10-27)", async ({
    page,
  }) => {
    // Seven binders, each opened and turned to its cover.
    test.slow();
    await signInAsCollector(page, ENTRIES);
    for (const size of [
      {width: 393, height: 815},
      {width: 412, height: 839},
    ]) {
      await page.setViewportSize(size);
      for (const scope of [SET, 'all', 'promos']) {
        await openPhoneBinder(page, `/browse?binder=${scope}`);
        await toPhoneCover(page);
        const at = `at ${size.width}x${size.height}, binder=${scope}`;
        const scrolls = await coverScrolls(page);
        expect(scrolls.cover, `what the cover's numbers scroll ${at}`).toBeLessThanOrEqual(0);
        expect(Math.max(scrolls.section, scrolls.document, scrolls.sideways), `what else scrolls ${at}`).toBeLessThanOrEqual(0);
      }
    }

    // An iPhone 15 with Safari's bars: three rows, a cover too short for the whole collection's
    // numbers, which scroll inside it while the section and the page stay put.
    await page.setViewportSize({width: 393, height: 659});
    await openPhoneBinder(page, '/browse?binder=all');
    await toPhoneCover(page);
    const scrolls = await coverScrolls(page);
    expect(scrolls.overflowY).toBe('auto');
    expect(scrolls.cover, "what the cover's numbers scroll at 393x659").toBeGreaterThan(0);
    expect(Math.max(scrolls.section, scrolls.document, scrolls.sideways), 'what else scrolls at 393x659').toBeLessThanOrEqual(0);
  });

  test('Master on the cover keeps the cover, the focus on it, while Owned drops the cards it no longer holds (owner, 2026-10-27)', async ({
    page,
  }) => {
    // A printing held in its one finish, so Master leaves Owned a card and the binder stays.
    expect(MASTER, 'the cards held toward Master').toBe(1);
    await page.setViewportSize({width: 393, height: 815});
    await signInAsCollector(page, ENTRIES);
    await openPhoneBinder(page, `/browse?binder=${SET}&owned=owned`);
    await expect(binder(page).getByTestId('card-tile')).toHaveCount(HELD);
    const cover = await toPhoneCover(page);

    await cover.getByRole('button', {name: /^Master set/}).click();
    const master = cover.getByRole('button', {name: /^Master set/});
    await expect(master).toHaveAttribute('aria-pressed', 'true');
    await expect(master).toBeFocused();
    await expect(shownPage(page)).toHaveAttribute('aria-label', COVER_MINI);
    await binder(page).getByRole('button', {name: /^Page 1 of /}).click();
    await expect(binder(page).getByTestId('card-tile')).toHaveCount(MASTER);
  });

  test('the Binder sheet applies Show, the sort and the filters together, in one write', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await countUrlWrites(page);
    await signInAsCollector(page, ENTRIES);
    await openPhoneBinder(page, `/browse?binder=${SET}`);
    const before = {url: page.url(), page: await shownPage(page).getAttribute('aria-label')};
    const filters = phoneRow(page).getByRole('button', {name: /^Filters/});
    await expect(filters, 'no count with nothing on').toHaveAccessibleName('Filters');
    await clearUrlWrites(page);

    await filters.click();
    const sheet = binderSheet(page);
    // The numbers are on the binder's inside cover (owner, 2026-10-27), not under Progress here.
    await expect(sheet.getByRole('region', {name: 'Collection numbers'})).toHaveCount(0);
    await expect(sheet.getByText('Progress', {exact: true})).toHaveCount(0);
    await sheet.getByRole('group', {name: 'Binder shows'}).getByRole('button', {name: 'Missing', exact: true}).click();
    await sheet.getByRole('combobox', {name: 'Sort cards'}).selectOption('name-asc');
    await sheet.getByRole('button', {name: 'Filter by Amber'}).click();
    // Picked, not applied: the link and the binder behind the sheet are as they were.
    expect(await urlWrites(page)).toEqual([]);
    expect(page.url()).toBe(before.url);
    await expect(shownPage(page)).toHaveAttribute('aria-label', before.page!);

    await sheet.getByRole('button', {name: 'Apply', exact: true}).click();
    await expect(sheet).toHaveCount(0);
    // The badge counts what the link holds, so once it reads 2 every write Apply makes is in.
    await expect(filters, 'Amber, and Missing').toHaveAccessibleName('Filters, 2 on');
    const params = new URL(page.url()).searchParams;
    expect([params.get('owned'), params.get('sort'), params.get('ink')]).toEqual(['missing', 'name-asc', 'Amber']);
    expect(await urlWrites(page), 'Apply writes the link once').toHaveLength(1);
    await expect(shownPage(page)).not.toHaveAttribute('aria-label', before.page!);
  });

  test('closing the Binder sheet keeps Show, the sort and the filters as they were', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await signInAsCollector(page, ENTRIES);
    await openPhoneBinder(page, `/browse?binder=${SET}&owned=missing&sort=name-asc&ink=Amber`);
    const before = page.url();
    const filters = phoneRow(page).getByRole('button', {name: /^Filters/});
    await expect(filters).toHaveAccessibleName('Filters, 2 on');

    await filters.click();
    const sheet = binderSheet(page);
    const shows = sheet.getByRole('group', {name: 'Binder shows'});
    await shows.getByRole('button', {name: 'All', exact: true}).click();
    await sheet.getByRole('combobox', {name: 'Sort cards'}).selectOption('cost-desc');
    await sheet.getByRole('button', {name: 'Filter by Amber'}).click();
    // A press on the backdrop, above the sheet, closes it without Apply.
    await page.getByTestId('filter-drawer-backdrop').click({position: {x: 195, y: 40}});
    await expect(sheet).toHaveCount(0);
    expect(page.url()).toBe(before);
    await expect(filters).toHaveAccessibleName('Filters, 2 on');

    // Opened again, it starts from what the binder shows.
    await filters.click();
    await expect(shows.getByRole('button', {name: 'Missing', exact: true})).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.getByRole('combobox', {name: 'Sort cards'})).toHaveValue('name-asc');
    await expect(sheet.getByRole('button', {name: 'Filter by Amber'})).toHaveAttribute('aria-pressed', 'true');
  });

  test('the phone binder has no axe violations, on a page and on its cover, and with the Binder sheet open', async ({page}, testInfo) => {
    // Desktop only, as accessibility.spec.ts's audits are: a phone's size draws the phone binder.
    test.skip(testInfo.project.name.startsWith('mobile-'), 'axe audits run on the desktop projects');
    // A pocket whose art fails to load shows the card's cost, which its name lacks (axe's
    // label-content-name-mismatch): any art at all keeps each pocket a card, as CI's real art does.
    await stubCardArt(page);
    await page.setViewportSize({width: 390, height: 844});
    await signInAsCollector(page, ENTRIES);
    await openPhoneBinder(page, `/browse?binder=${SET}`);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    await toPhoneCover(page);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);

    await phoneRow(page).getByRole('button', {name: /^Filters/}).click();
    await expect(binderSheet(page)).toBeVisible();
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  });
});
