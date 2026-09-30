import {useState} from 'react';
import type {LorcanaCard, VariantRarity} from 'inkweave-synergy-engine';

/** One printing of a card: its Standard art, or an Epic/Enchanted/Iconic variant (#625). */
export interface Printing {
  /** 'standard', or the variant's id. */
  key: string;
  /** What the printing switcher shows: "Standard", or the variant's rarity. */
  label: string;
  /** Absent for the Standard printing. */
  rarity?: VariantRarity;
  imageUrl?: string;
}

/** Accessible name for a printing's image: the card name, plus the rarity for a variant. */
export function printingAlt(card: LorcanaCard, printing: Printing): string {
  return printing.rarity ? `${card.fullName}, ${printing.rarity} printing` : card.fullName;
}

function printingsOf(card: LorcanaCard): Printing[] {
  const standard: Printing = {key: 'standard', label: 'Standard', imageUrl: card.imageUrl};
  const variants = (card.variants ?? []).map((v): Printing => ({
    key: v.id,
    label: v.rarity,
    rarity: v.rarity,
    imageUrl: v.imageUrl,
  }));
  return [standard, ...variants];
}

/**
 * Which printing of `card` is shown. A card starts on its Standard printing, or on the one
 * `initialKey` names (a variant's id: the reveals board opens its special slots that way), read
 * once on mount. Paging to another card drops the selection, and so does `resetWhen` (the modal
 * closing, or entering a comparison, which always shows base art), so the Standard printing is
 * back once it clears. The render-time reset is the same pattern as the modal's
 * `useCardTranslation`.
 */
export function usePrintingSelection(
  card: LorcanaCard,
  {resetWhen = false, initialKey = null}: {resetWhen?: boolean; initialKey?: string | null} = {},
) {
  const printings = printingsOf(card);
  const [selected, setSelected] = useState<{cardId: string; index: number} | null>(() => {
    const index = printings.findIndex((printing) => printing.key === initialKey);
    return index > 0 ? {cardId: card.id, index} : null;
  });
  const keep = !resetWhen && selected?.cardId === card.id;
  if (selected && !keep) setSelected(null);

  const index = keep && selected.index < printings.length ? selected.index : 0;
  const select = (next: number) => setSelected(next === 0 ? null : {cardId: card.id, index: next});
  return {printings, index, select, current: printings[index]};
}
