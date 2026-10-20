import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';
import {cardFullNameById, newestCoreSet, promoSetWithOpenPocket, setCards, setPrintings} from '../helpers/cardData';

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
    {session: storedSession(), collection: local},
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

const binder = (page: Page) => page.getByRole('region', {name: 'Binder'});
const numbers = (page: Page) => page.getByRole('region', {name: 'Collection numbers'});

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

  test('in Missing, copies added from two pockets keep both cards and the spread, which the card window walks (#826)', async ({
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

    // A first copy of each, from its pocket a mouse points at. The stripe sits under
    // aria-hidden: its group's label speaks for it.
    for (const tile of [tiles.nth(0), tiles.nth(1)]) {
      await tile.hover();
      const stripe = binder(page).getByRole('group', {name: '0 normal, 0 foil', exact: true});
      await stripe.getByRole('button', {name: 'Add one copy of normal', includeHidden: true}).click();
      await expect(
        binder(page).getByRole('group', {name: '1 normal, 0 foil', exact: true}),
      ).toBeVisible();
    }
    // The clicks left the focus where it was, off the hidden + that no Tab reaches.
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(await focused()).not.toBe('Add one copy of normal');

    // The second's card window, whose arrows walk the binder: the first, held now but kept,
    // is the card before it. Clicked near its top, clear of the stripe the mouse opens, which
    // takes every press on the card's foot.
    await page.mouse.move(0, 0);
    await tiles.nth(1).click({position: {x: 10, y: 10}});
    const modal = page.getByTestId('card-overview-modal');
    await expect(modal.locator('h1')).toHaveText(names[1]);
    await page.getByRole('button', {name: 'Previous card'}).click();
    await expect(modal.locator('h1')).toHaveText(names[0]);
    await page.keyboard.press('Escape');

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
    // Complete set alone, counting promos: each pocket is one printing in one finish.
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
    // The one promo held, among every promo set's, and no Master: a promo comes in one finish.
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
});
