import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {ALL_INKS} from '../../shared/constants';
import {PER_INK, SET_TOTAL} from './setComposition';
import {rarityConfigOf} from './rarity';

const REVEAL_SET_CODE = '13';

export interface InkProgress {
  ink: Ink;
  /** Revealed cards counting toward this ink board, capped at PER_INK. */
  count: number;
  /** The revealed cards bucketed to this ink (uncapped; drives the mosaic slots). */
  cards: LorcanaCard[];
  /** Revealed count per rarity key (see rarity.ts), from each card's real rarity. */
  rarityCounts: Record<string, number>;
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
 * Primary-ink only: a dual-ink card (e.g. the Set 13 Team cards "Amber-Emerald")
 * counts toward its first ink alone. This keeps the six per-ink boards summing
 * cleanly to SET_TOTAL (the per-ink totals in setComposition add to 207) and each
 * revealed card in exactly one board. To instead show dual-ink cards in both
 * boards, return `card.ink2 ? [card.ink, card.ink2] : [card.ink]` — but note that
 * breaks the per-ink denominators and double-counts in per-ink sums.
 */
function cardInks(card: LorcanaCard): Ink[] {
  return [card.ink];
}

/**
 * Per-ink Set 13 reveal progress derived from the real card data. Replaces the
 * prototype's synthetic `revealPct`. Drives the rings, the diamond mosaic fill,
 * the rarity breakdown, the hero stat, and the overall progress bar — all from
 * one source so they never disagree.
 */
export function useRevealProgress(): RevealProgress {
  const {cards, isLoading} = useCardDataContext();

  const revealed = cards.filter((c) => c.setCode === REVEAL_SET_CODE);

  const byInk = {} as Record<Ink, InkProgress>;
  for (const ink of ALL_INKS) {
    byInk[ink] = {ink, count: 0, cards: [], rarityCounts: {}};
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
    byInk[ink].count = Math.min(byInk[ink].cards.length, PER_INK[ink]);
  }

  const inks = ALL_INKS.map((ink) => byInk[ink]);
  const totalRevealed = revealed.length;
  const overallPct = Math.round((totalRevealed / SET_TOTAL) * 100);

  return {byInk, inks, totalRevealed, overallPct, loading: isLoading};
}
