/**
 * The place the card window's arrows step to from `index` in `ids`, wrapping at the ends, or -1
 * where they step nowhere: a list of one card, or an index that isn't a place in it (-1 for a
 * card not in it). The arrows (`goToSibling`) and the synergy prefetch
 * (`usePreloadSiblingSynergies`) share it, so the prefetch always fetches the cards the arrows
 * reach.
 */
export function siblingStep(ids: readonly string[], index: number, direction: 1 | -1): number {
  if (ids.length < 2 || index < 0 || index >= ids.length) return -1;
  return (index + direction + ids.length) % ids.length;
}
