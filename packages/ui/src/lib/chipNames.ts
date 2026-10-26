import type {LorcanaCard} from 'inkweave-synergy-engine';

/** A chip's card in words: its name, or its full name when both cards share one, so the two stay apart. */
export function chipCardName(card: LorcanaCard, partner: LorcanaCard): string {
  return card.name === partner.name ? card.fullName : card.name;
}

/**
 * A synergy line with its {A}/{B} chip tokens written out as card names, for a place that shows
 * the line as plain text (a tile's tooltip). {A} is the card whose synergies these are, {B} its
 * partner. Two versions of one character go by their full names, so the line tells them apart.
 */
export function fillChipNames(explanation: string, cardA: LorcanaCard, cardB: LorcanaCard): string {
  return explanation.replace(/\{([AB])\}/g, (_token, side: string) =>
    side === 'A' ? chipCardName(cardA, cardB) : chipCardName(cardB, cardA),
  );
}
