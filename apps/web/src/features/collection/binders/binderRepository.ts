import type {TablesInsert} from '../../../shared/lib/database.types';
import type {RepoResult} from '../../../shared/lib/repoResult';
import {reportFailure} from '../../../shared/lib/reportFailure';
import {callSupabase} from '../../../shared/lib/supabaseCall';
import type {Binder} from './binderRules';

/**
 * The `collection_binders` table: one row per binder, which only its owner reads and writes,
 * through RLS and column grants. Every call goes through `callSupabase`, as in
 * `collectionRepository`.
 */

/** A binder's name as the table allows it (`collection_binders_name`): 1 to 30 letters. */
const NAME_LENGTH = {min: 1, max: 30};
/** A cover's id as the table allows it (`collection_binders_cover`). */
const CARD_ID = /^[A-Za-z0-9_-]{1,40}$/;

/** The columns a binder is read back through. */
const COLUMNS = 'id, name, scope, rules, cover_id, place';

const isWords = (value: unknown): value is string => typeof value === 'string';

/** A name the table would take: 1 to 30 letters, counted as the check constraint counts them. */
function isName(value: unknown): value is string {
  if (!isWords(value)) return false;
  const letters = [...value].length;
  return letters >= NAME_LENGTH.min && letters <= NAME_LENGTH.max;
}

/** A cover: no card, or one card id. */
function isCover(value: unknown): value is string | null {
  if (value === null) return true;
  return isWords(value) && CARD_ID.test(value);
}

const isPlace = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/**
 * A row we can safely show, or null. The table's checks hold names, ids and places to their
 * shapes, and this guard holds the client to the same, so a row the app can't read never reaches
 * a render: a name past 30 letters, a cover that names no card id, a place that is no whole number.
 */
function toBinder(row: unknown): Binder | null {
  if (typeof row !== 'object' || row === null) return null;
  return binderOf(row as Record<string, unknown>);
}

function binderOf(fields: Record<string, unknown>): Binder | null {
  const {id, name, scope, rules, cover_id: coverId, place} = fields;
  if (!isWords(id) || !isName(name)) return null;
  if (!isWords(scope) || !isWords(rules)) return null;
  if (!isCover(coverId) || !isPlace(place)) return null;
  return {id, name, scope, rules, coverId, place};
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

/** What the client writes of a binder: its id, place and stamps are the server's. */
export interface BinderInput {
  name: string;
  scope: string;
  rules: string;
  coverId: string | null;
}

/**
 * The shelf's cap, refused: the insert trigger's `check_violation` at 30 binders, answered in
 * place of an error Sentry would hear of. The table's own checks raise the same code, so the cap
 * is told by its message: a name or rules the client let through stay an error that is reported.
 */
export const SHELF_FULL = 'shelf_full';
const isShelfCap = (error: {code?: string; message?: string} | null) =>
  error?.code === '23514' && (error.message ?? '').startsWith('A shelf holds');

/** A binder's fields as the table names them, only those given. */
function columnsOf({coverId, ...fields}: Partial<BinderInput>) {
  return coverId === undefined ? fields : {...fields, cover_id: coverId};
}

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
  const row = {owner_id: ownerId, ...columnsOf(input)} as TablesInsert<'collection_binders'>;
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
    client.from('collection_binders').update(columnsOf(patch)).eq('id', id).select(COLUMNS).maybeSingle(),
  );
  return readBack(result);
}

/*
 * The `collection_shelf` table: My collection's cover, one row per collection, which only its
 * owner reads and writes. No row, or no card, is the rarest card you have.
 */

/** My collection's cover: the card the caller's row names, or null with no row; a cover the guard refuses is none, and reported. */
export function getShelfCover(ownerId: string): Promise<RepoResult<string | null>> {
  return callSupabase({area: 'collection', operation: 'read shelf cover'}, async (client) => {
    const {data, error} = await client.from('collection_shelf').select('cover_id').eq('owner_id', ownerId).maybeSingle();
    if (error) return {data: null, error};
    const cover = data?.cover_id ?? null;
    if (isCover(cover)) return {data: cover, error: null};
    reportUnreadableCover();
    return {data: null, error: null};
  });
}

/** As `reportUnreadable`, for My collection's cover: shown as the rarest, and Sentry hears of it. */
function reportUnreadableCover(): void {
  const failure = new Error('left out an unreadable shelf cover');
  console.warn(`[collection] ${failure.message}`);
  reportFailure({area: 'collection', operation: 'read shelf cover'}, failure);
}

/**
 * Sets My collection's cover, or null to put the rarest back: an upsert of `(owner_id, cover_id)`,
 * the two columns the table grants the client, as the sharing switch writes its own.
 */
export function setShelfCover(ownerId: string, coverId: string | null): Promise<RepoResult<null>> {
  return callSupabase({area: 'collection', operation: 'save shelf cover'}, async (client) => {
    const {error} = await client.from('collection_shelf').upsert({owner_id: ownerId, cover_id: coverId}, {onConflict: 'owner_id'});
    return {data: null, error};
  });
}
