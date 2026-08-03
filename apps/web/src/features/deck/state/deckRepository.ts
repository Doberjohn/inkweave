// Cloud persistence for saved decks (#464), the Supabase-backed sibling of
// deckStorage.ts's local drafts. Mirrors the voting layer's conventions in
// shared/lib/supabase.ts: every call is env-gated (getSupabase() may be null),
// wrapped in try/catch so a network failure degrades instead of throwing, and
// uses .maybeSingle() for optional single-row reads so a row hidden by RLS or one
// that does not exist yet returns {data:null} instead of the PGRST116 error the
// Sentry Supabase integration reports as unhandled (see #442, getPairScore).
//
// Owner scoping is enforced by RLS in the database, not here: reads return only
// the caller's own rows (plus is_public rows for getDeck), and writes are rejected
// unless owner_id = auth.uid(). This module still sets owner_id explicitly on
// writes so the WITH CHECK passes and the domain<->row mapping stays unit-testable.

import type {Database, Json} from '../../../shared/lib/database.types';
import {getSupabase} from '../../../shared/lib/supabase';
import type {Archetype, Deck, DeckCard, Ink} from '../types';

// These aliases resolve only AFTER the decks migration lands and database.types.ts
// is regenerated (#464). Until then this import errors, the intended build-time
// coupling between the schema and this repository.
type DeckRow = Database['public']['Tables']['decks']['Row'];
type DeckInsert = Database['public']['Tables']['decks']['Insert'];
type DecksClient = NonNullable<ReturnType<typeof getSupabase>>;

/** Uniform read/write result. `data` is null on any failure or empty read. */
export interface RepoResult<T> {
  data: T | null;
  error: string | null;
}

const NOT_CONFIGURED = 'Supabase not configured';
const SCHEMA_VERSION = 1 as const;

const VALID_ARCHETYPES = new Set<Archetype>(['aggro', 'tempo', 'midrange', 'control', 'combo', 'ramp']);
const VALID_INKS = new Set<Ink>(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']);

/**
 * The shared shell every CRUD call runs inside: env-gate the client, await the
 * caller's already-mapped query, and normalize errors to a {@link RepoResult}.
 * `op` returns domain data (mapping happens inside it) so this stays generic and
 * the six operations below carry no duplicated null-check / try-catch / logging.
 */
async function run<T>(
  op: (client: DecksClient) => PromiseLike<{data: T | null; error: {message: string} | null}>,
): Promise<RepoResult<T>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {data, error} = await op(supabase);
    if (error) {
      console.error('[deckRepository] query failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data, error: null};
  } catch (e) {
    console.error('[deckRepository] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

// -------------------------------------------------------------------
// Row <-> domain mapping (defensive: never trusts jsonb / text[] blindly)
// -------------------------------------------------------------------

function parseInks(value: unknown): Ink[] {
  if (!Array.isArray(value)) return [];
  return value.filter((ink): ink is Ink => typeof ink === 'string' && VALID_INKS.has(ink as Ink));
}

function parseCards(value: Json): DeckCard[] {
  if (!Array.isArray(value)) return [];
  const cards: DeckCard[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const c = entry as Record<string, unknown>;
    if (typeof c.cardId !== 'string' || typeof c.quantity !== 'number') continue;
    const card: DeckCard = {cardId: c.cardId, quantity: c.quantity};
    if (typeof c.isCore === 'boolean') card.isCore = c.isCore;
    cards.push(card);
  }
  return cards;
}

/** Supabase row -> domain Deck. */
function rowToDeck(row: DeckRow): Deck {
  // gameplan is a loose text column; keep it only when it's a known archetype.
  const gameplan =
    row.gameplan !== null && VALID_ARCHETYPES.has(row.gameplan as Archetype)
      ? (row.gameplan as Archetype)
      : undefined;
  // timestamptz strings -> epoch millis, matching the Deck domain's numeric clocks.
  const created = Date.parse(row.created_at);
  const updated = Date.parse(row.updated_at);
  return {
    id: row.id,
    name: row.name,
    cards: parseCards(row.cards),
    gameplan,
    inks: parseInks(row.inks),
    isPublic: row.is_public,
    ownerId: row.owner_id,
    createdAt: Number.isNaN(created) ? Date.now() : created,
    updatedAt: Number.isNaN(updated) ? Date.now() : updated,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** The columns a client may freely rewrite on every save (no id / owner / clocks). */
function writableColumns(deck: Deck) {
  return {
    name: deck.name,
    gameplan: deck.gameplan ?? null,
    inks: deck.inks,
    cards: deck.cards as unknown as Json,
    is_public: deck.isPublic ?? false,
  };
}

/**
 * Full column payload for insert/upsert, minus owner_id (the caller sets that from
 * the authenticated id so the RLS WITH CHECK passes). created_at is carried from
 * the draft so an aged local draft keeps its age; updated_at is left to the column
 * default plus the touch trigger.
 */
function deckToInsert(deck: Deck): Omit<DeckInsert, 'owner_id'> {
  return {id: deck.id, ...writableColumns(deck), created_at: new Date(deck.createdAt).toISOString()};
}

// -------------------------------------------------------------------
// CRUD (each is a single mapped query inside the shared `run` shell)
// -------------------------------------------------------------------

/** All of the caller's own decks, newest-touched first. RLS scopes to owner. */
export function listDecks(ownerId: string): Promise<RepoResult<Deck[]>> {
  return run(async (c) => {
    const {data, error} = await c
      .from('decks')
      .select('*')
      .eq('owner_id', ownerId)
      .order('updated_at', {ascending: false});
    return {data: data ? data.map(rowToDeck) : null, error};
  });
}

/**
 * Up to `limit` public decks, newest-touched first. Ordered to match the partial
 * index `decks_public_updated_idx on (updated_at desc) where is_public`, so this
 * stays on the index rather than falling back to a heap sort.
 *
 * RLS already permits anon reads of is_public rows, so this works signed out and
 * is the community list's data source. Legality filtering is deliberately NOT
 * done here: it needs per-card ink data that lives in allCards.json, not in the
 * row, which stores only {cardId, quantity}.
 */
export function listPublicDecks(limit = 50): Promise<RepoResult<Deck[]>> {
  return run(async (c) => {
    const {data, error} = await c
      .from('decks')
      .select('*')
      .eq('is_public', true)
      .order('updated_at', {ascending: false})
      .limit(limit);
    return {data: data ? data.map(rowToDeck) : null, error};
  });
}

/** One deck by id. RLS returns it when it is the caller's own or is_public. */
export function getDeck(id: string): Promise<RepoResult<Deck>> {
  return run(async (c) => {
    const {data, error} = await c.from('decks').select('*').eq('id', id).maybeSingle();
    return {data: data ? rowToDeck(data) : null, error};
  });
}

/**
 * Run a single-row write (insert / update / upsert) that already appends
 * `.select('*').maybeSingle()`, and map the returned row to a domain Deck. The
 * three write ops differ only in `build`, so their env-gate + await + map shell
 * lives here once.
 */
function writeOne(
  build: (client: DecksClient) => PromiseLike<{data: DeckRow | null; error: {message: string} | null}>,
): Promise<RepoResult<Deck>> {
  return run(async (c) => {
    const {data, error} = await build(c);
    return {data: data ? rowToDeck(data) : null, error};
  });
}

export function createDeck(deck: Deck, ownerId: string): Promise<RepoResult<Deck>> {
  return writeOne((c) => c.from('decks').insert({...deckToInsert(deck), owner_id: ownerId}).select('*').maybeSingle());
}

/** Update the writable columns; id / owner_id / created_at stay immutable. */
export function updateDeck(deck: Deck): Promise<RepoResult<Deck>> {
  return writeOne((c) => c.from('decks').update(writableColumns(deck)).eq('id', deck.id).select('*').maybeSingle());
}

export function deleteDeck(id: string): Promise<RepoResult<null>> {
  return run(async (c) => {
    const {error} = await c.from('decks').delete().eq('id', id);
    return {data: null, error};
  });
}

/**
 * Insert-or-update by primary key. The workhorse for the first-sign-in draft
 * migration: idempotent on `deck.id`, so replaying it never creates a duplicate.
 * RLS still blocks writing a row owned by anyone else. PostgREST upsert compiles
 * to INSERT ... ON CONFLICT DO UPDATE, so the decks table defines BOTH an
 * owner-scoped INSERT policy (WITH CHECK) and an owner-scoped UPDATE policy.
 */
export function upsertDeck(deck: Deck, ownerId: string): Promise<RepoResult<Deck>> {
  return writeOne((c) =>
    c.from('decks').upsert({...deckToInsert(deck), owner_id: ownerId}, {onConflict: 'id'}).select('*').maybeSingle(),
  );
}
