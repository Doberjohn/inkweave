import type {Accuracy, Score} from '../../../shared/lib/supabase';

/** A pair of card ids, in arbitrary order. Storage-layer functions sort them internally so the
 *  same key is produced regardless of which card was passed first. */
export interface CardPair {
  readonly cardA: string;
  readonly cardB: string;
}

/** Wraps a localStorage key so primitive-obsession analysis sees a domain object rather than a
 *  raw string. Construction goes through {@link buildStorageKey} which sorts the pair canonically. */
interface StorageKey {
  readonly value: string;
}

const QUICK_PREFIX = 'inkweave:vote';
const DETAIL_PREFIX = 'inkweave:vote-detail';
const VALID_ACCURACIES: Accuracy[] = [-1, 0, 1];

function buildStorageKey(prefix: string, pair: CardPair): StorageKey {
  const [a, b] = [pair.cardA, pair.cardB].sort();
  return {value: `${prefix}:${a}:${b}`};
}

function safeRead(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key.value);
  } catch (e) {
    console.warn('[voteStorage] localStorage read denied:', e);
    return null;
  }
}

function safeWrite(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(key.value, value);
  } catch (e) {
    console.error('[voteStorage] localStorage write failed:', e);
  }
}

function safeRemove(key: StorageKey): void {
  try {
    localStorage.removeItem(key.value);
  } catch (e) {
    console.warn('[voteStorage] localStorage cleanup failed:', e);
  }
}

// ── Quick vote storage ──

interface StoredQuickVote {
  accuracy: Accuracy;
  timestamp: number;
}

export function readQuickVote(pair: CardPair): Accuracy | null {
  const key = buildStorageKey(QUICK_PREFIX, pair);
  const raw = safeRead(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredQuickVote>;
    if (parsed?.accuracy != null && VALID_ACCURACIES.includes(parsed.accuracy)) {
      return parsed.accuracy;
    }
    console.error('[readQuickVote] Unexpected shape, clearing:', parsed);
  } catch (e) {
    console.error('[readQuickVote] Corrupted JSON, clearing key:', key.value, e);
  }
  safeRemove(key);
  return null;
}

export function writeQuickVote(pair: CardPair, accuracy: Accuracy): void {
  const payload: StoredQuickVote = {accuracy, timestamp: Date.now()};
  safeWrite(buildStorageKey(QUICK_PREFIX, pair), JSON.stringify(payload));
}

// ── In-depth vote storage ──

export interface StoredInDepthVote {
  accuracy?: Accuracy;
  score?: Score;
  timestamp: number;
}

export function hasInDepthVote(pair: CardPair): boolean {
  return safeRead(buildStorageKey(DETAIL_PREFIX, pair)) !== null;
}

export function readInDepthVote(pair: CardPair): StoredInDepthVote | null {
  const key = buildStorageKey(DETAIL_PREFIX, pair);
  const raw = safeRead(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredInDepthVote;
  } catch (e) {
    console.error('[readInDepthVote] Corrupted JSON, clearing key:', key.value, e);
    safeRemove(key);
    return null;
  }
}

export function writeInDepthVote(
  pair: CardPair,
  payload: Pick<StoredInDepthVote, 'accuracy' | 'score'>,
): void {
  const stored: StoredInDepthVote = {...payload, timestamp: Date.now()};
  safeWrite(buildStorageKey(DETAIL_PREFIX, pair), JSON.stringify(stored));
  // Sync the quick-vote marker so the modal's quick-vote control reflects the
  // user's most recent answer if they updated accuracy via the in-depth flow.
  if (payload.accuracy != null) {
    writeQuickVote(pair, payload.accuracy);
  }
}
