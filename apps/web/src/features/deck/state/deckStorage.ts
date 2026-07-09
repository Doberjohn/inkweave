// localStorage persistence for the working deck draft (#465), cloned from the
// voting feature's `voteStorage.ts` pattern: every access is wrapped so a denied
// or corrupt store can never wedge the builder — a bad entry silently clears and
// the caller falls back to a fresh draft.
//
// SCOPE: local drafts only. The debounced Supabase *sync* and the actual
// draft->cloud *copy* (issue #465 parts b/c) wait on auth (#463) + the decks
// repository (#464). The migration GUARD below is pure localStorage, so it ships
// now — the first-sign-in flow that consumes it lands with the repo.

import type {Deck} from '../types';

/** Single active local draft. The `*` in the issue's `inkweave:deck:*` namespace
 *  is realized as this draft key plus the per-user migration-guard keys below. */
export const DRAFT_KEY = 'inkweave:deck:draft';
const MIGRATED_PREFIX = 'inkweave:deck:migrated';

/** Persisted-shape version; a stored draft whose `schemaVersion` differs is
 *  discarded rather than trusted (no upgrade path defined yet). */
const DRAFT_SCHEMA_VERSION = 1;

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('[deckStorage] localStorage read denied:', e);
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('[deckStorage] localStorage write failed:', e);
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[deckStorage] localStorage cleanup failed:', e);
  }
}

/** True when `value` looks like a current-schema {@link Deck}. Keeps the parse in
 *  {@link readDraft} honest without pulling in a schema library. */
function isDraftShape(value: unknown): value is Deck {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Partial<Deck>;
  return (
    d.schemaVersion === DRAFT_SCHEMA_VERSION &&
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    Array.isArray(d.cards)
  );
}

/**
 * Read the stored draft, or `null` if none. A corrupt entry (bad JSON, wrong
 * shape, or a stale `schemaVersion`) is removed and treated as absent so the
 * builder starts clean instead of throwing.
 */
export function readDraft(): Deck | null {
  const raw = safeRead(DRAFT_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isDraftShape(parsed)) return parsed;
    console.error('[deckStorage] Unexpected draft shape, clearing:', parsed);
  } catch (e) {
    console.error('[deckStorage] Corrupted draft JSON, clearing key:', DRAFT_KEY, e);
  }
  safeRemove(DRAFT_KEY);
  return null;
}

/** Persist the working draft (last write wins). */
export function writeDraft(deck: Deck): void {
  safeWrite(DRAFT_KEY, JSON.stringify(deck));
}

/** Drop the working draft entirely (e.g. after it migrates to the cloud). */
export function clearDraft(): void {
  safeRemove(DRAFT_KEY);
}

// ── First-sign-in draft->cloud migration guard ──
// The migration COPY (draft -> Supabase `decks`) is deferred with the repository
// (#464); these idempotency helpers are auth-independent and ship now so that
// flow is a one-line addition once the repo exists.

function migratedKey(uid: string): string {
  return `${MIGRATED_PREFIX}:${uid}`;
}

/** Has this user's local draft already been migrated to the cloud? */
export function hasMigratedDraft(uid: string): boolean {
  return safeRead(migratedKey(uid)) === '1';
}

/** Mark this user's draft migrated so a repeat sign-in doesn't re-copy it. */
export function markDraftMigrated(uid: string): void {
  safeWrite(migratedKey(uid), '1');
}
