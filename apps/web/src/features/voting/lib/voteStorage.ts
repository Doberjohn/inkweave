import type {Accuracy, Score} from '../../../shared/lib/supabase';

const QUICK_PREFIX = 'inkweave:vote';
const DETAIL_PREFIX = 'inkweave:vote-detail';
const VALID_ACCURACIES: Accuracy[] = [-1, 0, 1];

function pairKey(prefix: string, cardA: string, cardB: string): string {
  const [a, b] = [cardA, cardB].sort();
  return `${prefix}:${a}:${b}`;
}

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('[voteStorage] localStorage read denied:', e);
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('[voteStorage] localStorage write failed:', e);
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[voteStorage] localStorage cleanup failed:', e);
  }
}

// ── Quick vote storage ──

interface StoredQuickVote {
  accuracy: Accuracy;
  timestamp: number;
}

export function readQuickVote(cardA: string, cardB: string): Accuracy | null {
  const key = pairKey(QUICK_PREFIX, cardA, cardB);
  const raw = safeRead(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredQuickVote>;
    if (parsed?.accuracy != null && VALID_ACCURACIES.includes(parsed.accuracy)) {
      return parsed.accuracy;
    }
    console.error('[readQuickVote] Unexpected shape, clearing:', parsed);
  } catch (e) {
    console.error('[readQuickVote] Corrupted JSON, clearing key:', key, e);
  }
  safeRemove(key);
  return null;
}

export function writeQuickVote(cardA: string, cardB: string, accuracy: Accuracy): void {
  const payload: StoredQuickVote = {accuracy, timestamp: Date.now()};
  safeWrite(pairKey(QUICK_PREFIX, cardA, cardB), JSON.stringify(payload));
}

// ── In-depth vote storage ──

export interface StoredInDepthVote {
  accuracy?: Accuracy;
  score?: Score;
  timestamp: number;
}

export function hasInDepthVote(cardA: string, cardB: string): boolean {
  return safeRead(pairKey(DETAIL_PREFIX, cardA, cardB)) !== null;
}

export function readInDepthVote(cardA: string, cardB: string): StoredInDepthVote | null {
  const key = pairKey(DETAIL_PREFIX, cardA, cardB);
  const raw = safeRead(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredInDepthVote;
  } catch (e) {
    console.error('[readInDepthVote] Corrupted JSON, clearing key:', key, e);
    safeRemove(key);
    return null;
  }
}

export function writeInDepthVote(
  cardA: string,
  cardB: string,
  payload: Pick<StoredInDepthVote, 'accuracy' | 'score'>,
): void {
  const stored: StoredInDepthVote = {...payload, timestamp: Date.now()};
  safeWrite(pairKey(DETAIL_PREFIX, cardA, cardB), JSON.stringify(stored));
  // Sync the quick-vote marker so the modal's quick-vote control reflects the
  // user's most recent answer if they updated accuracy via the in-depth flow.
  if (payload.accuracy != null) {
    writeQuickVote(cardA, cardB, payload.accuracy);
  }
}
