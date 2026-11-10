import type {TablesInsert} from '../../../shared/lib/database.types';
import type {RepoResult} from '../../../shared/lib/repoResult';
import {reportFailure} from '../../../shared/lib/reportFailure';
import {callSupabase} from '../../../shared/lib/supabaseCall';
import type {PageSide} from '../../cards/components/binderGeometry';
import type {Binder} from './binderRules';
import {DESIGN_ID} from './coverDesigns';

/**
 * The `collection_binders` table: one row per binder, which only its owner reads and writes,
 * through RLS and column grants. Every call goes through `callSupabase`, as in
 * `collectionRepository`.
 */

/** A binder's name as the table allows it (`collection_binders_name`): 1 to 30 letters. */
const NAME_LENGTH = {min: 1, max: 30};

/** The columns a binder is read back through. `cover_id`, the card a cover named before, is never read. */
const COLUMNS = 'id, name, scope, rules, pages, cover, place';

const isWords = (value: unknown): value is string => typeof value === 'string';

/** A name the table would take: 1 to 30 letters, counted as the check constraint counts them. */
function isName(value: unknown): value is string {
  if (!isWords(value)) return false;
  const letters = [...value].length;
  return letters >= NAME_LENGTH.min && letters <= NAME_LENGTH.max;
}

/** A page's side as the table allows it (`collection_binders_pages`). */
const isPageSide = (value: unknown): value is PageSide => value === 2 || value === 3 || value === 4;

/** A row's page side, or 4 for one this build can't draw, as a design it doesn't know draws as the first. */
const pageSideOf = (value: unknown): PageSide => (isPageSide(value) ? value : SHELF_DEFAULT.pages);

/** A cover: none, the first design, or a design's id as the table allows it (`collection_binders_cover_design`). */
function isCover(value: unknown): value is string | null {
  if (value === null) return true;
  return isWords(value) && DESIGN_ID.test(value);
}

const isPlace = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/**
 * A row we can safely show, or null. The table's checks hold names, covers and places to their
 * shapes, and this guard holds the client to the same, so a row the app can't read never reaches a
 * render: a name past 30 letters, a cover that is no design's id, a place that is no whole number.
 * What a newer table might hold passes: a design's id this build doesn't know draws as the first,
 * and a page side it can't draw as 4, so neither hides the binder.
 */
function toBinder(row: unknown): Binder | null {
  if (typeof row !== 'object' || row === null) return null;
  return binderOf(row as Record<string, unknown>);
}

function binderOf(fields: Record<string, unknown>): Binder | null {
  const {id, name, scope, rules, pages, cover, place} = fields;
  if (!isWords(id) || !isName(name)) return null;
  if (!isWords(scope) || !isWords(rules)) return null;
  if (!isCover(cover) || !isPlace(place)) return null;
  return {id, name, scope, rules, pages: pageSideOf(pages), cover, place};
}

/**
 * The caller's binders in shelf order. A row that fails the guard is left out and reported, never
 * an error: one bad row must not hide every other binder, and Sentry hears of the table and the
 * guard drifting apart.
 */
export function listBinders(ownerId: string): Promise<RepoResult<Binder[]>> {
  return callSupabase({area: 'collection', operation: 'read binders'}, async (client) => {
    const {data, error} = await client.from('collection_binders').select(COLUMNS).eq('owner_id', ownerId).order('place');
    if (error || data === null) return {data: null, error};
    const binders = data.map(toBinder).filter((binder): binder is Binder => binder !== null);
    if (binders.length < data.length) reportUnreadable(data.length - binders.length);
    return {data: binders, error: null};
  });
}

function reportUnreadable(count: number): void {
  const failure = new Error(`left out ${count} unreadable binder row(s)`);
  console.warn(`[collection] ${failure.message}`);
  reportFailure({area: 'collection', operation: 'read binder rows'}, failure);
}

/** Deletes one of the caller's binders. Another player's id deletes nothing: the delete policy sees only the caller's rows. */
export function deleteBinderRow(id: string): Promise<RepoResult<null>> {
  return callSupabase({area: 'collection', operation: 'delete binder'}, (client) =>
    client.from('collection_binders').delete().eq('id', id),
  );
}

/**
 * Swaps a binder with its neighbour, the one before it (`earlier`) or after it: the server alone
 * writes places (`move_binder`). True once they swapped, false when it had no neighbour that way.
 */
export function moveBinderRow(id: string, earlier: boolean): Promise<RepoResult<boolean>> {
  return callSupabase({area: 'collection', operation: 'move binder'}, (client) =>
    client.rpc('move_binder', {binder_id: id, earlier}),
  );
}

/** What the client writes of a binder, each field its column's: its id, place and stamps are the server's. */
export interface BinderInput {
  name: string;
  scope: string;
  rules: string;
  cover: string | null;
}

/**
 * The shelf's cap, refused: the insert trigger's `check_violation` at 30 binders, answered in
 * place of an error Sentry would hear of. The table's own checks raise the same code, so the cap
 * is told by its message: a name or rules the client let through stay an error that is reported.
 */
export const SHELF_FULL = 'shelf_full';
const isShelfCap = (error: {code?: string; message?: string} | null) =>
  error?.code === '23514' && (error.message ?? '').startsWith('A shelf holds');

/** The row the server sent back, as a binder; one the guard refuses is reported, never shown. */
function readBack(result: RepoResult<unknown>): RepoResult<Binder> {
  if (result.error !== null) return {data: null, error: result.error};
  if (result.data === SHELF_FULL) return {data: null, error: SHELF_FULL};
  if (result.data === null) return {data: null, error: null};
  const binder = toBinder(result.data);
  if (binder !== null) return {data: binder, error: null};
  reportUnreadable(1);
  return {data: null, error: 'Unreadable binder row'};
}

/**
 * Makes a binder, and answers it as the server stored it, with its id and its place at the
 * shelf's end, or `SHELF_FULL`. A plain insert, never an upsert: the client can't send an id, and
 * Postgres takes no deferrable unique as a conflict target.
 */
export async function insertBinderRow(ownerId: string, input: BinderInput): Promise<RepoResult<Binder>> {
  // The trigger sets place, which the generated type requires and no client may write.
  const row = {owner_id: ownerId, ...input} as TablesInsert<'collection_binders'>;
  const result = await callSupabase<unknown>({area: 'collection', operation: 'create binder'}, async (client) => {
    const {data, error} = await client.from('collection_binders').insert(row).select(COLUMNS).single();
    if (isShelfCap(error)) return {data: SHELF_FULL, error: null};
    return {data, error};
  });
  return readBack(result);
}

/**
 * Changes one of the caller's binders, and answers it as the server stored it, or no binder and no
 * error when it is gone: deleted on another device, or never the caller's.
 */
export async function updateBinderRow(id: string, patch: Partial<BinderInput>): Promise<RepoResult<Binder>> {
  const result = await callSupabase({area: 'collection', operation: 'change binder'}, (client) =>
    client.from('collection_binders').update(patch).eq('id', id).select(COLUMNS).maybeSingle(),
  );
  return readBack(result);
}

/*
 * The `collection_shelf` table: My collection's page size and cover, one row per collection,
 * which only its owner reads and writes. No row is the defaults: 4 pockets a side, the first design.
 */

/** My collection's page size and cover, as its row keeps them. */
export interface ShelfLook {
  pages: PageSide;
  cover: string | null;
}

/** My collection's with no row: a binder's own defaults. */
export const SHELF_DEFAULT: ShelfLook = {pages: 4, cover: null};

/**
 * My collection's page size and cover: the caller's row, or the defaults with no row. A field the
 * guard refuses takes its default, and Sentry hears of it, so the other still shows.
 */
export function getShelf(ownerId: string): Promise<RepoResult<ShelfLook>> {
  return callSupabase({area: 'collection', operation: 'read shelf'}, async (client) => {
    const {data, error} = await client.from('collection_shelf').select('pages, cover').eq('owner_id', ownerId).maybeSingle();
    if (error) return {data: null, error};
    if (data === null) return {data: SHELF_DEFAULT, error: null};
    return {data: shelfOf(data), error: null};
  });
}

function shelfOf({pages, cover}: {pages: unknown; cover: unknown}): ShelfLook {
  const look = {pages: pageSideOf(pages), cover: isCover(cover) ? cover : SHELF_DEFAULT.cover};
  if (look.pages !== pages || look.cover !== cover) reportUnreadableShelf();
  return look;
}

/** As `reportUnreadable`, for My collection's row: shown at its defaults, and Sentry hears of it. */
function reportUnreadableShelf(): void {
  const failure = new Error('left out an unreadable shelf field');
  console.warn(`[collection] ${failure.message}`);
  reportFailure({area: 'collection', operation: 'read shelf'}, failure);
}

/**
 * Changes My collection's page size or cover: an upsert of `owner_id` and the fields given alone,
 * so a cover's change never writes the page size, the columns the table grants the client.
 */
export function setShelf(ownerId: string, patch: Partial<ShelfLook>): Promise<RepoResult<null>> {
  return callSupabase({area: 'collection', operation: 'save shelf'}, async (client) => {
    const {error} = await client.from('collection_shelf').upsert({owner_id: ownerId, ...patch}, {onConflict: 'owner_id'});
    return {data: null, error};
  });
}
