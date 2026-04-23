import {describe, expect, it} from 'vitest';
import {PairQueueStore, pairKey, INTERESTING_THRESHOLD} from '../PairQueueStore';
import type {PairIndexEntry} from '../types';

const mk = (a: string, b: string, score: number): PairIndexEntry => [a, b, score];

describe('PairQueueStore', () => {
  it('init partitions entries into interesting (score ≥ threshold) and other', () => {
    const store = new PairQueueStore();
    store.init(
      [mk('a', 'b', 8), mk('c', 'd', 5), mk('e', 'f', INTERESTING_THRESHOLD), mk('g', 'h', 3)],
      new Set(),
    );

    // Two from each bucket should be drawable before both run out.
    const drawn = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const entry = store.drawNext();
      if (entry) drawn.add(`${entry[0]}:${entry[1]}`);
    }
    expect(drawn.size).toBe(4);
  });

  it('init filters out already-seen pairs', () => {
    const store = new PairQueueStore();
    const seen = new Set([pairKey('a', 'b')]);
    store.init([mk('a', 'b', 8), mk('c', 'd', 8)], seen);

    const first = store.drawNext();
    expect(first?.[0]).toBe('c');
    expect(store.drawNext()).toBeNull();
  });

  it('drawNext alternates between buckets when both have entries', () => {
    const store = new PairQueueStore();
    store.init([mk('a', 'b', 8), mk('c', 'd', 3)], new Set());

    const first = store.drawNext();
    const second = store.drawNext();

    // First from interesting (score 8), second from other (score 3).
    expect(first?.[2]).toBe(8);
    expect(second?.[2]).toBe(3);
  });

  it('drawNext falls back to the other bucket when the primary is empty', () => {
    const store = new PairQueueStore();
    // Only interesting bucket populated — the second draw should fall back from empty 'other'.
    store.init([mk('a', 'b', 8), mk('c', 'd', 9)], new Set());

    const scores = [store.drawNext()?.[2], store.drawNext()?.[2]].sort();
    expect(scores).toEqual([8, 9]);
    expect(store.drawNext()).toBeNull();
  });

  it('drawNext returns null when both buckets are empty', () => {
    const store = new PairQueueStore();
    store.init([], new Set());
    expect(store.drawNext()).toBeNull();
  });

  it('peekNext is non-destructive — entries remain drawable after peeking', () => {
    const store = new PairQueueStore();
    store.init([mk('a', 'b', 8), mk('c', 'd', 3)], new Set());

    const peeked = store.peekNext(2);
    expect(peeked).toHaveLength(2);

    // Both entries still drawable in the same order.
    expect(store.drawNext()?.[2]).toBe(peeked[0][2]);
    expect(store.drawNext()?.[2]).toBe(peeked[1][2]);
  });

  it('peekNext returns fewer than requested when buckets run out', () => {
    const store = new PairQueueStore();
    store.init([mk('a', 'b', 8)], new Set());
    expect(store.peekNext(5)).toHaveLength(1);
  });

  it('pushBack routes entries to the score-appropriate bucket', () => {
    const store = new PairQueueStore();
    store.init([], new Set());

    // After init, both buckets empty. Push one interesting + one other, then drain.
    store.pushBack(mk('a', 'b', 9));
    store.pushBack(mk('c', 'd', 4));

    // nextBucket starts 'interesting' so the 9-scored one comes first.
    expect(store.drawNext()?.[2]).toBe(9);
    expect(store.drawNext()?.[2]).toBe(4);
  });
});

describe('pairKey', () => {
  it('sorts IDs so (a, b) and (b, a) produce the same key', () => {
    expect(pairKey('x', 'y')).toBe(pairKey('y', 'x'));
  });
});
