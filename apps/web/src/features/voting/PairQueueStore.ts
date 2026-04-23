import type {PairIndexEntry} from './types';

export const INTERESTING_THRESHOLD = 7;

/** Canonical pair key from two card IDs (sorted). Shared with hook for seen-set keys. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Fisher-Yates in-place shuffle. O(n), unbiased. */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

type Bucket = 'interesting' | 'other';

/**
 * In-memory queue backing the voting flow. Two buckets partitioned by score
 * (interesting ≥ 7, other < 7), drawn alternately so users see a mix. Not
 * React-aware — unit-testable without RTL.
 */
export class PairQueueStore {
  private interesting: PairIndexEntry[] = [];
  private other: PairIndexEntry[] = [];
  private nextBucket: Bucket = 'interesting';

  /** Partition entries by score, skip seen pairs, shuffle each bucket. */
  init(entries: PairIndexEntry[], seen: Set<string>): void {
    const interesting: PairIndexEntry[] = [];
    const other: PairIndexEntry[] = [];
    for (const entry of entries) {
      if (seen.has(pairKey(entry[0], entry[1]))) continue;
      if (entry[2] >= INTERESTING_THRESHOLD) {
        interesting.push(entry);
      } else {
        other.push(entry);
      }
    }
    shuffleArray(interesting);
    shuffleArray(other);
    this.interesting = interesting;
    this.other = other;
    this.nextBucket = 'interesting';
  }

  /** Pop and return the next entry, alternating buckets. Returns null when both empty. */
  drawNext(): PairIndexEntry | null {
    const primary = this.nextBucket === 'interesting' ? this.interesting : this.other;
    const fallback = this.nextBucket === 'interesting' ? this.other : this.interesting;
    const entry = primary.length > 0 ? primary.pop() : fallback.pop();
    this.nextBucket = this.nextBucket === 'interesting' ? 'other' : 'interesting';
    return entry ?? null;
  }

  /** Non-destructive peek at next N entries in draw order. */
  peekNext(count: number): PairIndexEntry[] {
    const readPos: Record<Bucket, number> = {
      interesting: this.interesting.length - 1,
      other: this.other.length - 1,
    };
    let bucket = this.nextBucket;
    const result: PairIndexEntry[] = [];

    while (result.length < count) {
      if (readPos.interesting < 0 && readPos.other < 0) break;
      const alt: Bucket = bucket === 'interesting' ? 'other' : 'interesting';
      let entry: PairIndexEntry | undefined;
      if (readPos[bucket] >= 0) {
        entry = this[bucket][readPos[bucket]--];
      } else if (readPos[alt] >= 0) {
        entry = this[alt][readPos[alt]--];
      }
      if (entry) result.push(entry);
      bucket = alt;
    }
    return result;
  }

  /** Push an entry back into the score-appropriate bucket (for undo). */
  pushBack(entry: PairIndexEntry): void {
    if (entry[2] >= INTERESTING_THRESHOLD) {
      this.interesting.push(entry);
    } else {
      this.other.push(entry);
    }
  }
}
