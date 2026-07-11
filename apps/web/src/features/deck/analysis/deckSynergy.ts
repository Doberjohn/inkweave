// Deck-level synergy aggregation (#471, Part B "Live advisor engine").
//
// Rolls the precomputed pairwise synergy scores up to the DECK level: how
// tightly the cards wire together (`overallScore`), which cards are the synergy
// hubs (`keyCards`), and which sit on their own island (`weakLinks`, the cut
// candidates). Pure and side-effect free.
//
// Kept engine-agnostic via an INJECTED pair-score provider. The controller wires
// the real fetch (`pairs[other].aggregateScore` from the precomputed JSON) later;
// tests pass a fixture. See `docs/deck-builder/PLAN.md` Part B.

import type {Deck} from '../types';

/**
 * Aggregate synergy score between two card ids, `0` when they don't synergize.
 * Order-independent: `getPairScore(a, b) === getPairScore(b, a)`.
 */
export type PairScore = (a: string, b: string) => number;

/** Deck-wide synergy rollup (see each field's use in the advisor). */
export interface DeckSynergyResult {
  /** Normalized 0..100 synergy density (mean pair score as a share of the max). */
  overallScore: number;
  /** Above-average connection hubs, strongest first (top 5). */
  keyCards: string[];
  /** Cards with <= 1 connection — cut candidates, weakest first (top 5). */
  weakLinks: string[];
  /** Per-card connection count (distinct deck cards it synergizes with). */
  connectionCounts: Record<string, number>;
}

/** Top of the 1..10 synergy scale; the density denominator per pair. */
const MAX_PAIR_SCORE = 10;
/** A card is a "weak link" (cut candidate) at or below this connection count. */
const WEAK_LINK_MAX_CONNECTIONS = 1;
/** How many key cards / weak links to surface. */
const TOP_N = 5;

/**
 * Aggregate a deck's pairwise synergies.
 *
 * Walks every unordered pair of DISTINCT deck card ids through `getPairScore`.
 * A positive score is one "connection" for each endpoint; the scores also sum
 * into a deck total that normalizes to `overallScore = mean pair score / 10 × 100`
 * (every pair, connected or not, is in the denominator — a deck padded with
 * non-synergistic cards scores lower). `keyCards` are the above-average hubs and
 * `weakLinks` the <=1-connection islands, each capped at the top 5.
 *
 * Pure and deterministic; ties break by card id so the output is stable.
 */
export function aggregateDeckSynergy(deck: Deck, getPairScore: PairScore): DeckSynergyResult {
  const ids = [...new Set(deck.cards.map((c) => c.cardId))];
  const connectionCounts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));

  let total = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const score = getPairScore(ids[i], ids[j]);
      if (score > 0) {
        total += score;
        connectionCounts[ids[i]] += 1;
        connectionCounts[ids[j]] += 1;
      }
    }
  }

  const pairCount = (ids.length * (ids.length - 1)) / 2;
  const overallScore =
    pairCount > 0 ? Math.round((total / (pairCount * MAX_PAIR_SCORE)) * 100) : 0;

  return {
    overallScore,
    keyCards: selectKeyCards(ids, connectionCounts),
    weakLinks: selectWeakLinks(ids, connectionCounts),
    connectionCounts,
  };
}

/** Ids sorted by connection count descending, ties broken by id ascending. */
function byConnectionsDesc(counts: Record<string, number>) {
  return (a: string, b: string) => counts[b] - counts[a] || a.localeCompare(b);
}

/** Above-average connection hubs, strongest first, capped at the top N. */
function selectKeyCards(ids: string[], counts: Record<string, number>): string[] {
  if (ids.length === 0) return [];
  const average = ids.reduce((sum, id) => sum + counts[id], 0) / ids.length;
  return ids
    .filter((id) => counts[id] > average)
    .sort(byConnectionsDesc(counts))
    .slice(0, TOP_N);
}

/** <= 1-connection islands, weakest first, capped at the top N. */
function selectWeakLinks(ids: string[], counts: Record<string, number>): string[] {
  return ids
    .filter((id) => counts[id] <= WEAK_LINK_MAX_CONNECTIONS)
    .sort((a, b) => counts[a] - counts[b] || a.localeCompare(b))
    .slice(0, TOP_N);
}
