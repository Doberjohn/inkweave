/** Gem silhouette per rarity (clip-path shapes, except 'circle'/'square' which use border-radius). */
export type RarityClip = 'circle' | 'square' | 'triangle' | 'diamond' | 'pentagon';

export interface RarityConfig {
  /** Lowercased match key against `card.rarity` (e.g. "super rare"). */
  key: string;
  name: string;
  /** Per-ink count; the five totals sum to PER_INK (34). */
  total: number;
  /** Gem fill colour. */
  color: string;
  clip: RarityClip;
}

/**
 * The five in-app rarities and their real per-color distribution
 * (12 + 9 + 8 + 3 + 2 = 34). Enchanted and Iconic exist in print but are not in
 * the Inkweave card database, so they are excluded from the board and breakdown.
 * `key` is compared case-insensitively against `card.rarity`.
 */
export const RARITIES: readonly RarityConfig[] = [
  {key: 'common', name: 'Common', total: 12, color: '#9aa3b2', clip: 'circle'},
  {key: 'uncommon', name: 'Uncommon', total: 9, color: '#6ee7a0', clip: 'square'},
  {key: 'rare', name: 'Rare', total: 8, color: '#7db5f5', clip: 'triangle'},
  {key: 'super rare', name: 'Super rare', total: 3, color: '#c4a5f5', clip: 'diamond'},
  {key: 'legendary', name: 'Legendary', total: 2, color: '#f5c542', clip: 'pentagon'},
];

/** Look up a rarity config from a raw `card.rarity` string (case-insensitive). */
export function rarityConfigOf(rarity: string | undefined): RarityConfig | undefined {
  if (!rarity) return undefined;
  const key = rarity.trim().toLowerCase();
  return RARITIES.find((r) => r.key === key);
}
