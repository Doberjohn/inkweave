// The UI guardrail for the deck-builder card pool. The deck STATE layer
// (`useDeck`) is deliberately PERMISSIVE — it will happily add a 5th copy — so
// this pure predicate enforces the one Core hard rule the pool blocks at the
// point of interaction: the 4-copy limit.
//
// The 2-ink limit is NOT blocked here — any ink is freely addable. Going over two
// inks surfaces as a deck legality error (see calculateDeckStats) rather than a
// disabled/dimmed pool tile, so the builder stays freeform + advisory.

/** Core-format copy limit the pool UI enforces (the state layer does not). */
const MAX_COPIES = 4;

export interface PoolTileState {
  /** Disable the + affordance: already at 4 copies. */
  addDisabled: boolean;
  /** Short label for the disabled + (tooltip + aria), or undefined when addable. */
  reason?: string;
}

/**
 * Decide how a pool card should present given how many copies it already holds.
 * (Ink legality is deliberately not enforced here — see the module comment.)
 *
 * @param inDeckCount how many copies are already in the deck
 */
export function getPoolTileState(inDeckCount: number): PoolTileState {
  const addDisabled = inDeckCount >= MAX_COPIES;
  return {addDisabled, reason: addDisabled ? 'Max 4 copies' : undefined};
}
