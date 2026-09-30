import type {LorcanaCard, VariantRarity} from 'inkweave-synergy-engine';

export interface RarityConfig {
  /** Lowercased match key against `card.rarity` (e.g. "super rare"). */
  key: string;
  name: string;
}

/**
 * The five main-set rarities, in display order. `key` is compared case-insensitively
 * against `card.rarity`; the glyph is rendered by RaritySymbol from the vendored SVGs.
 * The board's breakdown shows actual revealed counts per rarity (the set's real
 * composition differs from the old 12/9/8/3/2 assumption), so no per-rarity total is
 * stored here. Epic, Enchanted and Iconic are printings of these cards rather than
 * cards of their own: see SPECIAL_RARITIES.
 */
export const RARITIES: readonly RarityConfig[] = [
  {key: 'common', name: 'Common'},
  {key: 'uncommon', name: 'Uncommon'},
  {key: 'rare', name: 'Rare'},
  {key: 'super rare', name: 'Super rare'},
  {key: 'legendary', name: 'Legendary'},
];

/**
 * The special printings (#625), shown in their own row under the board's diamond. Keyed by
 * the printing's rarity; `key` is that rarity lowercased, in the same key space as RARITIES,
 * so one highlight state covers both.
 */
export const SPECIAL_RARITIES: Readonly<Record<VariantRarity, RarityConfig>> = {
  Epic: {key: 'epic', name: 'Epic'},
  Enchanted: {key: 'enchanted', name: 'Enchanted'},
  Iconic: {key: 'iconic', name: 'Iconic'},
};

/** Look up a rarity config from a raw `card.rarity` string (case-insensitive). */
export function rarityConfigOf(rarity: string | undefined): RarityConfig | undefined {
  if (!rarity) return undefined;
  const key = rarity.trim().toLowerCase();
  return RARITIES.find((r) => r.key === key);
}

/**
 * Whether a mosaic slot should fade when a rarity is highlighted: true for any slot
 * that isn't a card of the selected rarity. Non-matching revealed cards AND empty
 * slots (no card ⇒ no rarity) both dim, so only the selected rarity stays lit; a
 * null selection never dims. Uses the same `rarityConfigOf` normalizer the chips
 * use, so both sides of the feature compare identical keys.
 */
export function isSlotDimmed(card: LorcanaCard | undefined, selectedRarity: string | null): boolean {
  if (selectedRarity == null) return false;
  return rarityConfigOf(card?.rarity)?.key !== selectedRarity;
}

/** A special printing slot dims unless its own rarity is the highlighted one, revealed or not. */
export function isSpecialSlotDimmed(rarity: VariantRarity, selectedRarity: string | null): boolean {
  return selectedRarity != null && SPECIAL_RARITIES[rarity].key !== selectedRarity;
}
