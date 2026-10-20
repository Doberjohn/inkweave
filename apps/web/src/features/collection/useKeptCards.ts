import {useState} from 'react';

const NONE: ReadonlySet<string> = new Set();

interface KeptCards {
  kept: ReadonlySet<string>;
  keep: (cardId: string) => void;
}

/**
 * The cards changed by hand in the binder's current view (#826, owner 2026-10-20). Its Owned
 * and Missing views keep them, with their new counts, until `view` changes (the mode, the
 * set, the view itself, the headline it asks of, or the sort) or Browse closes. In the
 * Missing view a first copy would otherwise take the card out of the binder, and the spread
 * you were on with it, since the binder reopens at its first spread whenever what it holds
 * changes.
 *
 * Held while Browse is open, not past it: leaving the page reopens the binder at its first
 * spread anyway (the spread is the binder's own state), so there is no place left to keep,
 * and Owned or Missing on the way back shows each card as it now stands.
 *
 * Kept in Browse's listing (`byOwnership`), which the binder and the card window's arrows both
 * walk, so the two never disagree about a kept card.
 *
 * `keep` hears of each card whose count is set, from a pocket or the card window. Counted from
 * those edits, not from counts changing: an import or the account's copy arriving changes counts
 * too, and the views must still drop the cards those move.
 */
export function useKeptCards(view: string): KeptCards {
  const [state, setState] = useState({view, kept: NONE});
  if (state.view !== view) setState({view, kept: NONE});
  const keep = (cardId: string) =>
    setState((current) =>
      current.kept.has(cardId) ? current : {...current, kept: new Set(current.kept).add(cardId)},
    );
  return {kept: state.view === view ? state.kept : NONE, keep};
}
