export interface RarityConfig {
  /** Lowercased match key against `card.rarity` (e.g. "super rare"). */
  key: string;
  name: string;
}

/**
 * The five in-app rarities, in display order. Enchanted and Iconic exist in print
 * but are not in the Inkweave card database, so they are excluded from the board
 * and breakdown. `key` is compared case-insensitively against `card.rarity`; the
 * glyph is rendered by RaritySymbol from the vendored SVGs. The board's breakdown
 * shows actual revealed counts per rarity (the set's real composition differs
 * from the old 12/9/8/3/2 assumption), so no per-rarity total is stored here.
 */
export const RARITIES: readonly RarityConfig[] = [
  {key: 'common', name: 'Common'},
  {key: 'uncommon', name: 'Uncommon'},
  {key: 'rare', name: 'Rare'},
  {key: 'super rare', name: 'Super rare'},
  {key: 'legendary', name: 'Legendary'},
];

/** Look up a rarity config from a raw `card.rarity` string (case-insensitive). */
export function rarityConfigOf(rarity: string | undefined): RarityConfig | undefined {
  if (!rarity) return undefined;
  const key = rarity.trim().toLowerCase();
  return RARITIES.find((r) => r.key === key);
}
