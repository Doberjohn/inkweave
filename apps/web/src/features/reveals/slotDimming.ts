// The reveal board's highlight: which of its slots fade while a rarity is picked. The rarity
// lookups it compares with live in inkweave-ui beside the symbols they draw.
import type {LorcanaCard, VariantRarity} from 'inkweave-synergy-engine';
import {SPECIAL_RARITIES, rarityConfigOf} from 'inkweave-ui/lib/rarity';

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
