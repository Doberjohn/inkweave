import type {CardPrinting, Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {ALL_INKS, REVEAL_SET_CODE, specialSlotsFor, type SpecialSlotSpec} from '../../shared/constants';
import {PER_INK, SET_TOTAL} from './setComposition';
import {rarityConfigOf, SPECIAL_RARITIES} from './rarity';

/** One special printing slot on an ink board, filled once that printing is revealed. */
export interface SpecialSlot extends SpecialSlotSpec {
  /** The printing's base card, once revealed. */
  card?: LorcanaCard;
  /** The revealed printing itself. */
  printing?: CardPrinting;
}

export interface InkProgress {
  ink: Ink;
  /** Revealed cards counting toward this ink board, capped at PER_INK. */
  count: number;
  /** The revealed cards bucketed to this ink (uncapped; drives the mosaic slots). */
  cards: LorcanaCard[];
  /**
   * Revealed count per rarity key (see rarity.ts): each card's real rarity, plus each revealed
   * special printing under its own rarity.
   */
  rarityCounts: Record<string, number>;
  /** The ink's Epic, Enchanted and Iconic slots in collector order (see specialSlotsFor). */
  specials: SpecialSlot[];
}

export interface RevealProgress {
  byInk: Record<Ink, InkProgress>;
  /** ALL_INKS order, for rendering the six trackers/segments deterministically. */
  inks: InkProgress[];
  /** Unique revealed cards in the set (drives the hero "cards revealed" stat). */
  totalRevealed: number;
  /** round(totalRevealed / SET_TOTAL * 100). */
  overallPct: number;
  loading: boolean;
}

/**
 * Which ink board(s) a card counts toward.
 *
 * Primary-ink only: a dual-ink card (e.g. "Amber-Emerald") counts toward its
 * first ink alone. This keeps the six per-ink boards summing cleanly to SET_TOTAL
 * and each revealed card in exactly one board, and it matches how a set is
 * numbered (a dual-ink card sits in its first ink's collector-number block, see
 * `inkBlock`). To instead show dual-ink cards in both
 * boards, return `card.ink2 ? [card.ink, card.ink2] : [card.ink]` — but note that
 * breaks the per-ink denominators and double-counts in per-ink sums.
 */
function cardInks(card: LorcanaCard): Ink[] {
  return [card.ink];
}

/**
 * An ink's special printing slots, each filled with its revealed printing. A printing is
 * alternate art of a card, so it sits on its base card's board. One numbered outside the ink's
 * lineup is appended rather than dropped, so a data slip never hides art.
 */
function placeSpecials(ink: Ink, cards: LorcanaCard[]): SpecialSlot[] {
  const slots: SpecialSlot[] = specialSlotsFor(ink).map((spec) => ({...spec}));
  const revealed = cards.flatMap((card) => (card.variants ?? []).map((printing) => ({card, printing})));
  for (const {card, printing} of revealed) {
    const slot = slots.find((s) => s.number === printing.number && !s.printing);
    if (slot) Object.assign(slot, {card, printing});
    else slots.push({number: printing.number, rarity: printing.rarity, card, printing});
  }
  return slots;
}

/** Add an ink's revealed special printings to its rarity tally, keyed like the main-set rarities. */
function tallySpecials(bucket: InkProgress): void {
  for (const slot of bucket.specials) {
    if (!slot.printing) continue;
    const {key} = SPECIAL_RARITIES[slot.rarity];
    bucket.rarityCounts[key] = (bucket.rarityCounts[key] ?? 0) + 1;
  }
}

/**
 * Per-ink reveal progress for the season's set, derived from the real card data. Replaces the
 * prototype's synthetic `revealPct`. Drives the rings, the diamond mosaic fill,
 * the rarity breakdown, the hero stat, and the overall progress bar — all from
 * one source so they never disagree.
 */
export function useRevealProgress(): RevealProgress {
  const {cards, isLoading} = useCardDataContext();

  const revealed = cards.filter((c) => c.setCode === REVEAL_SET_CODE);

  const byInk = {} as Record<Ink, InkProgress>;
  for (const ink of ALL_INKS) {
    byInk[ink] = {ink, count: 0, cards: [], rarityCounts: {}, specials: []};
  }

  for (const card of revealed) {
    for (const ink of cardInks(card)) {
      const bucket = byInk[ink];
      if (!bucket) continue;
      bucket.cards.push(card);
      const rarity = rarityConfigOf(card.rarity);
      if (rarity) {
        bucket.rarityCounts[rarity.key] = (bucket.rarityCounts[rarity.key] ?? 0) + 1;
      }
    }
  }
  for (const ink of ALL_INKS) {
    const bucket = byInk[ink];
    bucket.count = Math.min(bucket.cards.length, PER_INK[ink]);
    bucket.specials = placeSpecials(ink, bucket.cards);
    tallySpecials(bucket);
  }

  const inks = ALL_INKS.map((ink) => byInk[ink]);
  const totalRevealed = revealed.length;
  const overallPct = Math.round((totalRevealed / SET_TOTAL) * 100);

  return {byInk, inks, totalRevealed, overallPct, loading: isLoading};
}
