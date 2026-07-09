// The UI guardrail for the deck-builder card pool. The deck STATE layer
// (`useDeck`) is deliberately PERMISSIVE — it will happily add a 5th copy of a
// card or a 3rd ink — so this pure predicate is where the Core hard rules are
// enforced at the point of interaction: it decides how each pool card presents.

import {getInks, type Ink, type LorcanaCard} from 'inkweave-synergy-engine';

/** Core-format hard limits the pool UI enforces (the state layer does not). */
const MAX_COPIES = 4;
const MAX_INKS = 2;

export interface PoolTileState {
  /** Dim the tile: adding this card would push the deck past the 2-ink limit. */
  offInk: boolean;
  /** Disable the + affordance: already at 4 copies, or off-ink. */
  addDisabled: boolean;
  /** Short label for the disabled + (tooltip + aria), or undefined when addable. */
  reason?: string;
}

/**
 * Decide how a pool card should present given the deck's current inks and how
 * many copies it already holds.
 *
 * @param card        the pool card
 * @param deckInks    the deck's current inks (0, 1, or 2; dual-ink counts as both)
 * @param inDeckCount how many copies are already in the deck
 */
export function getPoolTileState(
  card: LorcanaCard,
  deckInks: Ink[],
  inDeckCount: number,
): PoolTileState {
  // A dual-ink card counts toward BOTH of its inks. Project what the deck's ink
  // set would become if this card were added, and compare to the 2-ink cap.
  const projectedInkCount = new Set<Ink>([...deckInks, ...getInks(card)]).size;
  const offInk = projectedInkCount > MAX_INKS;
  const atCopyLimit = inDeckCount >= MAX_COPIES;
  const addDisabled = atCopyLimit || offInk;

  // The message shown on a disabled + (tooltip + aria-label). Off-ink wins when
  // both apply: the tile is already dimmed for being off-ink, so the + should
  // explain that; the 4-copy cap is effectively unreachable off-ink anyway.
  // NOTE: Christopher Robin - Hunny Sage lets Hunny characters of any ink into
  // the deck, exempting them from this 2-ink check. That deck-wide exception is
  // not modeled yet (tracked separately) — this predicate is per-card only.
  const reason = offInk
    ? 'Can\'t have more than two ink colors in your deck'
    : atCopyLimit
      ? 'Max 4 copies'
      : undefined;

  return {offInk, addDisabled, reason};
}
