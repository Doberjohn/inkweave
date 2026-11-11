import type {Page, Route} from '@playwright/test';
import {E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';

/**
 * Binders of your own, kept in the test as `helpers/friends.ts` keeps the friends:
 * `serveBinders` answers the `collection_binders` reads from a world of rows and changes it as
 * the database would, so a spec acts on the page and reads the page again.
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
  /** Its page's side, 2 to 4 pockets across and down. */
  pages: number;
  /** Its cover's design id, or null for the first design. */
  cover: string | null;
  place: number;
}

/** My collection's `collection_shelf` row: its page size and cover. */
interface ShelfRow {
  pages: number;
  cover: string | null;
}

/**
 * A change the page asked the database for: a binder's `DELETE`, `POST` or `PATCH`, a
 * `move_binder` call, or the `POST` that upserts My collection's shelf row.
 */
type BinderCall =
  | {what: 'delete'; id: string}
  | {what: 'move'; id: string; earlier: boolean}
  | {what: 'create'; row: Record<string, unknown>}
  | {what: 'change'; id: string; patch: Record<string, unknown>}
  | {what: 'shelf'; row: Record<string, unknown>; onConflict: string | null};

/** The binders the signed-in collector holds, in shelf order unless a case says otherwise. */
export interface BindersWorld {
  rows: BinderRow[];
  /** My collection's `collection_shelf` row: none unless a case says so. */
  shelf?: ShelfRow;
  /** Each change the page sent, oldest first, filled in by `serveBinders`. */
  calls?: BinderCall[];
}

const BINDERS_PATH = '/rest/v1/collection_binders';
const MOVE_PATH = '/rest/v1/rpc/move_binder';
export const SHELF_PATH = '/rest/v1/collection_shelf';

/** The most binders a shelf holds: the table's trigger refuses another with a check violation. */
const SHELF_MAX = 30;

/** The check violation the cap's trigger raises, as PostgREST hands it back. */
const SHELF_FULL_ERROR = {code: '23514', message: 'A shelf holds 30 binders at most', details: null, hint: null};

const byPlace = (a: BinderRow, b: BinderRow) => a.place - b.place;

/**
 * `move_binder` over the world: swaps the binder's place with its neighbour's, or false when it
 * has none that way. New rows for the two, so a case's own rows, shared across tests, stay as written.
 */
function move(world: BindersWorld, id: string, earlier: boolean): boolean {
  const shelf = [...world.rows].sort(byPlace);
  const at = shelf.findIndex((row) => row.id === id);
  const other = at === -1 ? undefined : shelf[at + (earlier ? -1 : 1)];
  if (other === undefined) return false;
  const places = new Map([
    [id, other.place],
    [other.id, shelf[at].place],
  ]);
  world.rows = world.rows.map((row) => (places.has(row.id) ? {...row, place: places.get(row.id)!} : row));
  return true;
}

/**
 * An `INSERT` over the world, as the table makes the row: a new id, the place after the last,
 * and the columns the page sent. Null at the cap.
 */
function insert(world: BindersWorld, sent: Record<string, unknown>): BinderRow | null {
  if (world.rows.length >= SHELF_MAX) return null;
  const place = Math.max(-1, ...world.rows.map((row) => row.place)) + 1;
  const row: BinderRow = {
    id: `b-made-${place}`,
    name: String(sent.name),
    scope: String(sent.scope),
    rules: String(sent.rules),
    pages: (sent.pages as number | undefined) ?? 4,
    cover: (sent.cover as string | null | undefined) ?? null,
    place,
  };
  world.rows = [...world.rows, row];
  return row;
}

/** An `UPDATE` of one binder's columns over the world: the row as it now reads, or null when it is gone. */
function update(world: BindersWorld, id: string, patch: Record<string, unknown>): BinderRow | null {
  const now = world.rows.find((row) => row.id === id);
  if (now === undefined) return null;
  const changed = {...now, ...patch} as BinderRow;
  world.rows = world.rows.map((row) => (row.id === id ? changed : row));
  return changed;
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

/** The binder a `PATCH` or `DELETE` names, from its `id=eq.…` filter. */
const idOf = (url: string) => (new URL(url).searchParams.get('id') ?? '').replace(/^eq\./, '');

/** A row with the fields a case doesn't care about filled in. */
export function binderRow(row: Pick<BinderRow, 'id' | 'name'> & Partial<BinderRow>): BinderRow {
  return {scope: 'all', rules: '', pages: 4, cover: null, place: 0, ...row};
}

/**
 * Answers the reader's binder reads from `world`, in place order as the query asks, and changes
 * it as the database would: a `DELETE` takes the binder out, a `POST` adds one after the last
 * (or, at 30, answers the cap's check violation), a `PATCH` changes one (and returns no row for
 * one that is gone), and `move_binder` swaps two places. `collection_shelf` reads My
 * collection's row from the world, and its upsert sets the columns it sends. Each change lands in `world.calls`.
 * Registered after the fixture's catch-all stub, so it wins for these paths; register it before
 * the first navigation.
 */
export async function serveBinders(page: Page, world: BindersWorld): Promise<void> {
  const calls = (world.calls ??= []);
  const at = (path: string) => (url: URL) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === path;
  await page.route(at(BINDERS_PATH), (route) => answerBinders(route, world, calls));
  await page.route(at(MOVE_PATH), (route) => {
    const {binder_id: id, earlier} = route.request().postDataJSON() as {binder_id: string; earlier: boolean};
    calls.push({what: 'move', id, earlier});
    return json(route, 200, move(world, id, earlier));
  });
  await page.route(at(SHELF_PATH), (route) => answerShelf(route, world, calls));
}

type BinderWrite = (route: Route, world: BindersWorld, calls: BinderCall[]) => Promise<void>;

/** The writes `collection_binders` takes, by method. */
const BINDER_WRITES: Record<string, BinderWrite> = {
  DELETE: (route, world, calls) => {
    const id = idOf(route.request().url());
    calls.push({what: 'delete', id});
    world.rows = world.rows.filter((row) => row.id !== id);
    return route.fulfill({status: 204, body: ''});
  },
  POST: (route, world, calls) => {
    const row = route.request().postDataJSON() as Record<string, unknown>;
    calls.push({what: 'create', row});
    const made = insert(world, row);
    // `.single()` asks for the one row as an object.
    return made === null ? json(route, 400, SHELF_FULL_ERROR) : json(route, 201, made);
  },
  PATCH: (route, world, calls) => {
    const request = route.request();
    const id = idOf(request.url());
    const patch = request.postDataJSON() as Record<string, unknown>;
    calls.push({what: 'change', id, patch});
    const changed = update(world, id, patch);
    // `.maybeSingle()` asks for an array and reads its first row, or none.
    return json(route, 200, changed === null ? [] : [changed]);
  },
};

/** `collection_binders`: a write by its method, or else the read, in place order. */
function answerBinders(route: Route, world: BindersWorld, calls: BinderCall[]): Promise<void> {
  const write = BINDER_WRITES[route.request().method()];
  return write ? write(route, world, calls) : json(route, 200, [...world.rows].sort(byPlace));
}

/** A shelf row's columns as the table makes them: 4 and no cover. */
const SHELF_DEFAULTS: ShelfRow = {pages: 4, cover: null};

/** `collection_shelf`: the upsert sets the columns it sends over My collection's row, and a read answers the row. */
function answerShelf(route: Route, world: BindersWorld, calls: BinderCall[]): Promise<void> {
  const request = route.request();
  if (request.method() === 'POST') {
    const row = request.postDataJSON() as Record<string, unknown>;
    calls.push({what: 'shelf', row, onConflict: new URL(request.url()).searchParams.get('on_conflict')});
    const {pages, cover} = {...(world.shelf ?? SHELF_DEFAULTS), ...row} as ShelfRow;
    world.shelf = {pages, cover};
    return route.fulfill({status: 201, body: ''});
  }
  // `.maybeSingle()` reads the first row of the set, or none.
  return json(route, 200, world.shelf === undefined ? [] : [world.shelf]);
}

/** Fails every binder read, as a reader offline or a server error does. */
export async function failBinderReads(page: Page): Promise<void> {
  await page.route(
    (url) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === BINDERS_PATH,
    (route: Route) => route.fulfill({status: 500, contentType: 'application/json', body: '{"message":"server error"}'}),
  );
}
