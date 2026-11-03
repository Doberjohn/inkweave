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
