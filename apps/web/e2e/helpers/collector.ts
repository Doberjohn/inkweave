import type {Locator, Page} from '@playwright/test';
import {expect} from '../fixtures';
import {E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';
import {luminance, pixelsIn, type Place} from './screen';
import {storedSession} from './session';

/**
 * A collector and their binder, for collection mode's specs (`collection-mode.spec.ts`,
 * `collection-binder.spec.ts`).
 *
 * SIGNED IN WITHOUT SIGNING IN: an OAuth round-trip is out of E2E's reach, but a session
 * the Supabase SDK RESTORES needs none. `signInAsCollector` stores an unexpired session,
 * which `getSession()` hands back without a network check, and the collector's collection, both
 * locally and as the server row the sync adopts on every load (`resolveCollectionSync`).
 * Everything else the placeholder project is asked answers empty (`supabaseStub`).
 */

/** The collector's uid: the session's user, and the owner stamped on the local copy. */
const COLLECTOR_ID = 'e2e-collector';
const IMPORTED_AT = Date.parse('2026-10-12T10:00:00Z');

export type Entries = Record<string, {normal: number; foil: number}>;

export const COLLECTIONS_PATH = '/rest/v1/collections';

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
export async function signInAsCollector(
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

// Exact: the frame drawn while the binder's code loads is named "Loading your binder" (#913).
export const binder = (page: Page) => page.getByRole('region', {name: 'Binder', exact: true});

/** The board the binder's pages sit in (#941), whose zip runs round its outer edge. */
export const board = (page: Page) => binder(page).locator('.binder-board');

/** The board's padding round the pages (`BOARD` in BinderSpread.tsx). */
export const BOARD = 14;

/** Opens promo set `code`'s binder from the Binder set menu's Promo tab (#805). */
export async function openPromoBinder(page: Page, code: string): Promise<void> {
  await page.getByRole('button', {name: /^Binder set/}).click();
  await page.getByRole('dialog', {name: 'Binder set'}).getByRole('button', {name: 'Promo', exact: true}).click();
  await page
    .getByRole('listbox', {name: 'Promo sets'})
    .getByRole('option', {name: new RegExp(`^Promo set ${code},`)})
    .click();
  await expect(page).toHaveURL(new RegExp(`[?&]binder=${code}(&|$)`));
}

/** A pixel lighter than this is a zip's metal tooth (#8a8a9c, about 139): its tape and the board are under 30. */
const TOOTH_LIGHT = 90;

/** The share of `clip`'s pixels lit like a zip's teeth (#941): about half along a run of teeth, none off it. */
export async function teethIn(page: Page, clip: Place): Promise<number> {
  const pixels = (await pixelsIn(page, clip)).flat();
  return pixels.filter((pixel) => luminance(pixel) > TOOTH_LIGHT).length / pixels.length;
}

/** Whether any stylesheet on the page holds a rule naming `name`. */
export function hasStyleFor(page: Page, name: string): Promise<boolean> {
  return page.evaluate((text) =>
    [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) => rule.cssText.includes(text));
      } catch {
        // Another origin's stylesheet (the fonts') keeps its rules to itself.
        return false;
      }
    }),
  name);
}

/** The grey a missing card's art is drawn in (`.binder-unowned`). */
export const MISSING_GREY = 'grayscale(1) brightness(0.45)';

/** The filter on a card tile's art: its first child, which the grey and the colour animations reach. */
export const artFilter = (tile: Locator) => tile.evaluate((t) => getComputedStyle(t.firstElementChild!).filter);

/** A 1x1 PNG: any card art at all. */
const ART = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/**
 * Answers every card art request with any art at all, at once. Call before the first navigation.
 *
 * In dev and CI the art is proxied to Ravensburger's CDN through the dev server, whose HTTP/1.1
 * gives the page six connections to it. Art that hangs there, with the binder's loads of the
 * pages either side of the one in view (#997), can hold all six, and a card window's code then
 * waits behind them past a test's timeout (#1022). Art that fails instead shows the card's cost,
 * which a pocket's name lacks.
 */
export async function stubCardArt(page: Page): Promise<void> {
  await page.route('**/card-images/**', (route) =>
    route.request().resourceType() === 'image'
      ? route.fulfill({contentType: 'image/png', body: ART})
      : route.fallback(),
  );
}
