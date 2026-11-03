import type {Page, Route} from '@playwright/test';
import {E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';

/**
 * Binders of your own (#1074), kept in the test as `helpers/friends.ts` keeps the friends:
 * `serveBinders` answers the `collection_binders` reads from a world of rows and, from PR 3 on,
 * changes it as the database would, so a spec acts on the page and reads the page again.
 *
 * `VITE_SHOW_BINDERS` is pinned on for E2E (`playwright.config.ts`), so every project sees them.
 */

/** A `collection_binders` row as PostgREST hands it back. */
export interface BinderRow {
  id: string;
  name: string;
  /** Its Sets: `all`, `promos` or one set's code. */
  scope: string;
  /** Its filters, as the address writes them: "ink=Amber&rarity=Epic". */
  rules: string;
  cover_id: string | null;
  place: number;
}

/** The binders the signed-in collector holds, in shelf order unless a case says otherwise. */
export interface BindersWorld {
  rows: BinderRow[];
}

const BINDERS_PATH = '/rest/v1/collection_binders';

/** A row with the fields a case doesn't care about filled in. */
export function binderRow(row: Pick<BinderRow, 'id' | 'name'> & Partial<BinderRow>): BinderRow {
  return {scope: 'all', rules: '', cover_id: null, place: 0, ...row};
}

/**
 * Answers the reader's binder reads from `world`, in place order as the query asks. Registered
 * after the fixture's catch-all stub, so it wins for this table; register it before the first
 * navigation.
 */
export async function serveBinders(page: Page, world: BindersWorld): Promise<void> {
  await page.route(
    (url) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === BINDERS_PATH,
    (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([...world.rows].sort((a, b) => a.place - b.place)),
      }),
  );
}

/** Fails every binder read, as a reader offline or a server error does. */
export async function failBinderReads(page: Page): Promise<void> {
  await page.route(
    (url) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === BINDERS_PATH,
    (route: Route) => route.fulfill({status: 500, contentType: 'application/json', body: '{"message":"server error"}'}),
  );
}
