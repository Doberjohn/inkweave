import {PER_INK} from './setComposition';

/**
 * A deterministic reveal-rank per diamond slot, seeded from the ink key, so an
 * ink's revealed cards scatter across the board instead of filling left-to-right.
 *
 * Returns an array where `rank[slot]` is that slot's reveal order (0 = first); a
 * slot counts as revealed once the ink's revealed total exceeds its rank. The
 * hash (Knuth multiplicative, mod a prime) gives a stable, well-spread shuffle
 * that's identical across renders and sessions.
 */
export function scatterRanks(seedKey: string): number[] {
  let seed = 0;
  for (const ch of seedKey) seed += ch.charCodeAt(0);
  const slots = Array.from({length: PER_INK}, (_, i) => i);
  slots.sort(
    (a, b) => (((a + seed) * 2654435761) % 7919) - (((b + seed) * 2654435761) % 7919),
  );
  const rank = new Array<number>(PER_INK);
  slots.forEach((slot, r) => {
    rank[slot] = r;
  });
  return rank;
}
