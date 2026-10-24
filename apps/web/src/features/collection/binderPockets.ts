/** How a card sits in its pocket (#941): off centre across and down, in px, and off straight, in degrees. */
export interface Settle {
  sx: number;
  sy: number;
  sr: number;
}

/**
 * A number in [-1, 1) from the id, its own for each `salt`: FNV-1a over the id's characters, then
 * murmur3's final mix, so ids a character apart settle nothing alike.
 */
function unitOf(id: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 31 - 1;
}

const toHundredths = (n: number) => Math.round(n * 100) / 100;

/**
 * How a card settles in its pocket (owner, 2026-10-24, #941): it sinks to the pocket's foot and
 * sits a hair off straight, as real cards never line up perfectly. Within a pixel either way
 * across, 0.4 to 1.6px down and 0.8 of a degree either way round, the same card always the same
 * way, from its id.
 */
export function settleOf(id: string): Settle {
  return {
    sx: toHundredths(unitOf(id, 1)),
    sy: toHundredths(1 + 0.6 * unitOf(id, 2)),
    sr: toHundredths(0.8 * unitOf(id, 3)),
  };
}
