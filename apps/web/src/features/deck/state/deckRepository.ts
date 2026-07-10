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
type DeckUpdate = Database['public']['Tables']['decks']['Update'];

/** Uniform read/write result. `data` is null on any failure or empty read. */
export interface RepoResult<T> {
  data: T | null;
  error: string | null;
}

const NOT_CONFIGURED = 'Supabase not configured';
const SCHEMA_VERSION = 1 as const;

const VALID_ARCHETYPES = new Set<Archetype>(['aggro', 'tempo', 'midrange', 'control', 'combo', 'ramp']);
const VALID_INKS = new Set<Ink>(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']);

// -------------------------------------------------------------------
// Row <-> domain mapping (defensive: never trusts jsonb / text[] blindly)
// -------------------------------------------------------------------

function parseArchetype(value: string | null): Archetype | undefined {
  if (value !== null && VALID_ARCHETYPES.has(value as Archetype)) return value as Archetype;
  return undefined;
}

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

/** timestamptz string -> epoch millis, matching the Deck domain's numeric clocks. */
function toMillis(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.now() : t;
}

/** Supabase row -> domain Deck. */
function rowToDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    cards: parseCards(row.cards),
    gameplan: parseArchetype(row.gameplan),
    inks: parseInks(row.inks),
    isPublic: row.is_public,
    ownerId: row.owner_id,
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at),
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * Full column set for insert/upsert. owner_id is set explicitly so the RLS
 * WITH CHECK (owner_id = auth.uid()) passes. created_at is carried from the draft
 * so an aged local draft keeps its age; updated_at is omitted and left to the
 * column default plus the touch trigger. DeckCard[] is JSON-serializable.
 */
function deckToInsert(deck: Deck, ownerId: string): DeckInsert {
  return {
    id: deck.id,
    owner_id: ownerId,
    name: deck.name,
    gameplan: deck.gameplan ?? null,
    inks: deck.inks,
    cards: deck.cards as unknown as Json,
    is_public: deck.isPublic ?? false,
    created_at: new Date(deck.createdAt).toISOString(),
  };
}

/** Mutable columns for update. id / owner_id / created_at are immutable post-create. */
function deckToUpdate(deck: Deck): DeckUpdate {
  return {
    name: deck.name,
    gameplan: deck.gameplan ?? null,
    inks: deck.inks,
    cards: deck.cards as unknown as Json,
    is_public: deck.isPublic ?? false,
  };
}

// -------------------------------------------------------------------
// CRUD
// -------------------------------------------------------------------

/** All of the caller's own decks, newest-touched first. RLS scopes to owner. */
export async function listDecks(ownerId: string): Promise<RepoResult<Deck[]>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {data, error} = await supabase
      .from('decks')
      .select('*')
      .eq('owner_id', ownerId)
      .order('updated_at', {ascending: false});
    if (error) {
      console.error('[deckRepository.listDecks] query failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data: (data ?? []).map(rowToDeck), error: null};
  } catch (e) {
    console.error('[deckRepository.listDecks] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

/** One deck by id. RLS returns it when it is the caller's own or is_public. */
export async function getDeck(id: string): Promise<RepoResult<Deck>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {data, error} = await supabase
      .from('decks')
      .select('*')
      .eq('id', id)
      // maybeSingle(): a missing or RLS-hidden row is {data:null, error:null}, not
      // the PGRST116 the Sentry Supabase integration flags as unhandled.
      .maybeSingle();
    if (error) {
      console.error('[deckRepository.getDeck] query failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data: data ? rowToDeck(data) : null, error: null};
  } catch (e) {
    console.error('[deckRepository.getDeck] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

export async function createDeck(deck: Deck, ownerId: string): Promise<RepoResult<Deck>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {data, error} = await supabase
      .from('decks')
      .insert(deckToInsert(deck, ownerId))
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('[deckRepository.createDeck] insert failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data: data ? rowToDeck(data) : null, error: null};
  } catch (e) {
    console.error('[deckRepository.createDeck] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

export async function updateDeck(deck: Deck): Promise<RepoResult<Deck>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {data, error} = await supabase
      .from('decks')
      .update(deckToUpdate(deck))
      .eq('id', deck.id)
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('[deckRepository.updateDeck] update failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data: data ? rowToDeck(data) : null, error: null};
  } catch (e) {
    console.error('[deckRepository.updateDeck] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

export async function deleteDeck(id: string): Promise<RepoResult<null>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {error} = await supabase.from('decks').delete().eq('id', id);
    if (error) {
      console.error('[deckRepository.deleteDeck] delete failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data: null, error: null};
  } catch (e) {
    console.error('[deckRepository.deleteDeck] network error:', e);
    return {data: null, error: 'Network error'};
  }
}

/**
 * Insert-or-update by primary key. The workhorse for the first-sign-in draft
 * migration: idempotent on `deck.id`, so replaying it never creates a duplicate.
 * RLS still blocks writing a row owned by anyone else. PostgREST upsert compiles
 * to INSERT ... ON CONFLICT DO UPDATE, so the decks table defines BOTH an
 * owner-scoped INSERT policy (WITH CHECK) and an owner-scoped UPDATE policy.
 */
export async function upsertDeck(deck: Deck, ownerId: string): Promise<RepoResult<Deck>> {
  const supabase = getSupabase();
  if (!supabase) return {data: null, error: NOT_CONFIGURED};
  try {
    const {data, error} = await supabase
      .from('decks')
      .upsert(deckToInsert(deck, ownerId), {onConflict: 'id'})
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('[deckRepository.upsertDeck] upsert failed:', error.message);
      return {data: null, error: error.message};
    }
    return {data: data ? rowToDeck(data) : null, error: null};
  } catch (e) {
    console.error('[deckRepository.upsertDeck] network error:', e);
    return {data: null, error: 'Network error'};
  }
}
