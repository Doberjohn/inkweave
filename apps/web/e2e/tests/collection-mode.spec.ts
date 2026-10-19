import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';
import {cardFullNameById, newestCoreSet, setCards, setPrintings} from '../helpers/cardData';

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
 * Held in both finishes. The base cards are held in one, so only the printing counts: a held
 * printing's one finish counts as both (`collectionStats.ts`).
 */
const MASTER = HELD_ALT ? 1 : 0;

/** A share of the set as the panel writes it: a whole percent, rounded down (`percentOf`). */
const percentOfSet = (count: number) => Math.floor((count / SET_TOTAL) * 100);

/** base64url, for the session's token. */
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * A session supabase-js restores from storage as it stands: unexpired (a day out, far past
 * its refresh margin), with the user the app reads `user` from. The token is shaped like a
 * JWT; nothing in the browser verifies its signature.
 */
function storedSession() {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 24 * 60 * 60;
  const user = {
    id: COLLECTOR_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'collector@example.test',
    app_metadata: {provider: 'discord', providers: ['discord']},
    user_metadata: {},
    created_at: '2026-10-01T00:00:00Z',
  };
  const payload = {
    sub: COLLECTOR_ID,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: expiresAt,
  };
  return {
    access_token: `${base64url({alg: 'HS256', typ: 'JWT'})}.${base64url(payload)}.e2e`,
    token_type: 'bearer',
    expires_in: expiresAt - now,
    expires_at: expiresAt,
    refresh_token: 'e2e-refresh-token',
    user,
  };
}

const COLLECTIONS_PATH = '/rest/v1/collections';

interface CollectorOptions {
  /** Also store the local copy. False is a new browser: the collection is the server row alone. */
  local?: boolean;
  /** The server holds its answer until this settles, so a test can act before the sync hears. */
  answered?: Promise<void>;
}

/**
 * Signs the page in as a collector holding `entries`, or holding nothing for `null`: the
 * stored session, the local copy (stamped as the server's, so it is never uploaded back),
 * and the server row. Call before the first navigation.
 */
async function signInAsCollector(
  page: Page,
  entries: Entries | null,
  {local: storeLocal = true, answered}: CollectorOptions = {},
): Promise<void> {
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
    {session: storedSession(), collection: local},
  );
  // Registered after the fixture's catch-all stub, so it wins for this table.
  const rows = entries
    ? [{entries, imported_at: new Date(IMPORTED_AT).toISOString(), schema_version: 1}]
    : [];
  await page.route(
    (url) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === COLLECTIONS_PATH,
    async (route) => {
      await answered;
      await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(rows)});
    },
  );
}

/** Waits for the restored session: the header's control turns from "Sign in" to "Account". */
async function signedIn(page: Page): Promise<void> {
  await expect(
    page.getByTestId('compact-header').getByRole('button', {name: 'Account', exact: true}),
  ).toBeVisible();
}

const binder = (page: Page) => page.getByRole('region', {name: 'Binder'});
const numbers = (page: Page) => page.getByRole('region', {name: 'Collection numbers'});

test.describe('Collection mode', () => {
  test('the Collection button asks a signed-out visitor to sign in', async ({page}) => {
    await page.goto('/browse');
    const toggle = page.getByRole('button', {name: 'Show my collection'});
    await expect(toggle).toBeVisible();

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

  test("the Collection button opens a collector's binder, with the set panel's numbers", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto('/browse');
    await signedIn(page);

    await page.getByRole('button', {name: 'Show my collection'}).click();

    // Which set it opens on is the newest one's, which a reveal season can move ahead of the
    // card data; the tests below open the collection's set by its URL instead.
    await expect(page).toHaveURL(/[?&]binder=\d+(&|$)/);
    await expect(binder(page)).toBeVisible();
    await expect(numbers(page).getByText('Complete set', {exact: true})).toBeVisible();
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
    // its numbers show only once loaded (the click opens the newest set, as the test above notes).
    await expect(numbers(page).getByText('Complete set', {exact: true})).toBeVisible();
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

  test('the set picker opens the whole collection in the binder', async ({page}) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    await page.getByRole('button', {name: /^Binder set/}).click();
    await page.getByRole('option', {name: /^Whole collection/}).click();

    await expect(page).toHaveURL(/[?&]binder=all(&|$)/);
    await expect(page.getByRole('button', {name: 'Binder set: Whole collection'})).toBeVisible();
    // The binder and its numbers follow, not only the URL and the picker's label.
    await expect(numbers(page).getByText('Complete collection', {exact: true})).toBeVisible();
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
  });

  test("the set picker's arrow keys never park a set under its pinned row", async ({page}) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page)).toBeVisible();

    await page.getByRole('button', {name: /^Binder set/}).click();
    const list = page.getByRole('listbox', {name: 'Binder set'});
    const options = list.getByRole('option');
    const count = await options.count();
    // Every set the pool holds is listed, more than the list shows at once; a list that
    // stopped scrolling would pass this test without testing anything.
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    // Up from the last set, every row focus scrolls into view clears the pinned Whole
    // collection strip, which covers the list's top edge (WCAG 2.4.11).
    await page.keyboard.press('End');
    for (let i = count - 2; i >= 1; i--) {
      await page.keyboard.press('ArrowUp');
      await expect(options.nth(i)).toBeFocused();
      const {top, stripBottom} = await list.evaluate((el) => ({
        top: document.activeElement?.getBoundingClientRect().top ?? NaN,
        stripBottom:
          el.querySelector('[role="presentation"]')?.getBoundingClientRect().bottom ?? NaN,
      }));
      expect(top, `option ${i}'s top`).toBeGreaterThanOrEqual(stripBottom - 0.5);
    }
  });

  test('the keyboard pages the binder end to end without losing the focus', async ({page}) => {
    // #790: the pockets are one Tab stop, and the map's arrows stay focused, dimmed, at either end.
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByTestId('card-tile');
    await expect(tiles.first()).toBeVisible();

    await tiles.first().focus();
    await page.keyboard.press('Tab');
    const previous = binder(page).getByRole('button', {name: 'Previous spread'});
    await expect(previous).toBeFocused();
    await expect(previous).toHaveAttribute('aria-disabled', 'true');

    // Enter on Next, through to the last spread.
    const shown = binder(page).getByRole('navigation', {name: 'Binder pages'}).locator('[aria-current="true"]');
    const spreads = Number(/ of (\d+)/.exec((await shown.getAttribute('aria-label')) ?? '')?.[1]);
    expect(spreads, 'spreads in the set').toBeGreaterThan(1);
    const next = binder(page).getByRole('button', {name: 'Next spread'});
    await next.focus();
    for (let turn = 1; turn < spreads; turn++) await page.keyboard.press('Enter');
    await expect(shown).toHaveAccessibleName(new RegExp(`^Spread ${spreads} of ${spreads}:`));
    await expect(next).toBeFocused();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
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
    expect(new URL(page.url()).searchParams.get('rarity')?.split(',').sort()).toEqual([
      'Enchanted',
      'Epic',
      'Iconic',
    ]);
    await expect(numbers(page)).toContainText(`1 of ${PRINTINGS.length} cards`);
  });

  test('a signed-in visitor without a collection is asked to import one', async ({page}) => {
    await signInAsCollector(page, null);
    await page.goto('/browse');
    await signedIn(page);

    await page.getByRole('button', {name: 'Show my collection'}).click();

    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toBeVisible();
    await expect(binder(page)).toHaveCount(0);
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
});
