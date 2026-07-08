// Pure compositional stats for a deck (#459), the Tier-1 layer under the deck
// builder. No React, no opinions: just counts + the three Core hard rules
// (size / copies / inks). Higher tiers (health, score) build on this.

import type {CardType, Deck, DeckStats, Ink, LorcanaCard} from '../types';
import {getInks} from 'inkweave-synergy-engine';

/** Costs at or above this collapse into a single top bucket keyed by this value. */
const COST_CURVE_CAP = 7;

/** Core-format hard rules. */
const MIN_DECK_SIZE = 60;
const MAX_COPIES = 4;
const MAX_INKS = 2;

/** Canonical Lorcana ink order, so the "N inks: ..." message reads consistently. */
const INK_ORDER: readonly Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

/** Mutable running totals folded over the deck's resolvable cards. */
interface Tallies {
  inkDistribution: Partial<Record<Ink, number>>;
  costCurve: Record<number, number>;
  typeDistribution: Partial<Record<CardType, number>>;
  inks: Set<Ink>;
  copiesByFullName: Map<string, number>;
  inkableCount: number;
}

function emptyTallies(): Tallies {
  return {
    inkDistribution: {},
    costCurve: {},
    typeDistribution: {},
    inks: new Set(),
    copiesByFullName: new Map(),
    inkableCount: 0,
  };
}

/** Fold one resolved card (with its copy count) into the running tallies. */
function tallyCard(t: Tallies, card: LorcanaCard, quantity: number): void {
  const bucket = Math.min(card.cost, COST_CURVE_CAP);
  t.costCurve[bucket] = (t.costCurve[bucket] ?? 0) + quantity;

  // A dual-ink card contributes to BOTH of its inks (getInks returns 1 or 2).
  for (const ink of getInks(card)) {
    t.inkDistribution[ink] = (t.inkDistribution[ink] ?? 0) + quantity;
    t.inks.add(ink);
  }

  t.typeDistribution[card.type] = (t.typeDistribution[card.type] ?? 0) + quantity;
  if (card.inkwell) t.inkableCount += quantity;

  const seen = t.copiesByFullName.get(card.fullName) ?? 0;
  t.copiesByFullName.set(card.fullName, seen + quantity);
}

/** Build the human-readable legality reasons (the copy/size/ink hard-rule failures only). */
function buildLegalityErrors(
  totalCards: number,
  copiesByFullName: Map<string, number>,
  inks: Set<Ink>,
): string[] {
  const errors: string[] = [];

  if (totalCards < MIN_DECK_SIZE) {
    errors.push(`Deck has ${totalCards} cards (minimum ${MIN_DECK_SIZE})`);
  }

  for (const [fullName, copies] of copiesByFullName) {
    if (copies > MAX_COPIES) {
      errors.push(`${copies} copies of ${fullName} (max ${MAX_COPIES})`);
    }
  }

  if (inks.size > MAX_INKS) {
    const named = INK_ORDER.filter((ink) => inks.has(ink)).join(', ');
    errors.push(`${inks.size} inks: ${named} (max ${MAX_INKS})`);
  }

  return errors;
}

/** Non-blocking notes that don't bear on legality (e.g. cardIds rotated out of Core). */
function buildWarnings(unresolvedCount: number): string[] {
  if (unresolvedCount === 0) return [];
  const noun = unresolvedCount === 1 ? 'card' : 'cards';
  return [`${unresolvedCount} unresolved ${noun} skipped (rotated out of Core?)`];
}

/**
 * Compute pure compositional stats for a deck. `getCardById` resolves each
 * `DeckCard.cardId` to its `LorcanaCard`; ids that don't resolve (e.g. a card
 * rotated out of Core) still count toward `totalCards`/`uniqueCards` but are
 * skipped for every card-derived stat and surfaced as a `warnings` note (they
 * do not affect `isLegal`).
 *
 * `isLegal` is the three Core hard rules: >= 60 cards, <= 4 copies per unique
 * `fullName`, and <= 2 inks (a dual-ink card counts toward both of its inks).
 */
export function calculateDeckStats(
  deck: Deck,
  getCardById: (id: string) => LorcanaCard | undefined,
): DeckStats {
  const tallies = emptyTallies();
  const uniqueIds = new Set<string>();
  const unresolvedIds = new Set<string>();
  let totalCards = 0;

  for (const {cardId, quantity} of deck.cards) {
    totalCards += quantity;
    uniqueIds.add(cardId);

    const card = getCardById(cardId);
    if (!card) {
      unresolvedIds.add(cardId);
      continue;
    }
    tallyCard(tallies, card, quantity);
  }

  const inkCount = tallies.inks.size;
  const withinCopyLimit = [...tallies.copiesByFullName.values()].every((c) => c <= MAX_COPIES);
  const isLegal = totalCards >= MIN_DECK_SIZE && withinCopyLimit && inkCount <= MAX_INKS;

  return {
    totalCards,
    uniqueCards: uniqueIds.size,
    inkDistribution: tallies.inkDistribution,
    costCurve: tallies.costCurve,
    typeDistribution: tallies.typeDistribution,
    inkCount,
    inkableCount: tallies.inkableCount,
    isLegal,
    legalityErrors: buildLegalityErrors(totalCards, tallies.copiesByFullName, tallies.inks),
    warnings: buildWarnings(unresolvedIds.size),
  };
}
