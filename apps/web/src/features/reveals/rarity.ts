export interface RarityConfig {
  /** Lowercased match key against `card.rarity` (e.g. "super rare"). */
  key: string;
  name: string;
  /** Per-ink count; the five totals sum to PER_INK (34). */
  total: number;
}

/**
 * The five in-app rarities and their real per-color distribution
 * (12 + 9 + 8 + 3 + 2 = 34). Enchanted and Iconic exist in print but are not in
 * the Inkweave card database, so they are excluded from the board and breakdown.
 * `key` is compared case-insensitively against `card.rarity`. The rarity glyph
 * itself is rendered by RaritySymbol from the vendored SVGs.
 */
export const RARITIES: readonly RarityConfig[] = [
  {key: 'common', name: 'Common', total: 12},
  {key: 'uncommon', name: 'Uncommon', total: 9},
  {key: 'rare', name: 'Rare', total: 8},
  {key: 'super rare', name: 'Super rare', total: 3},
  {key: 'legendary', name: 'Legendary', total: 2},
];

/** Look up a rarity config from a raw `card.rarity` string (case-insensitive). */
export function rarityConfigOf(rarity: string | undefined): RarityConfig | undefined {
  if (!rarity) return undefined;
  const key = rarity.trim().toLowerCase();
  return RARITIES.find((r) => r.key === key);
}
