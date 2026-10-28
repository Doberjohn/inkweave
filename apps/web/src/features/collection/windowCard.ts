import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {useCardModal} from '../../shared/contexts/CardModalContext';

/**
 * The card the open window shows, by the window's own lookup: Core first, then the open's
 * resolver (sets 1-8). The copies row (`WindowCopies`) and the friends count (`WindowFriends`)
 * both read it, so both describe the same card.
 */
export function useWindowCard(): LorcanaCard | undefined {
  const {selectedCardId, resolveCard} = useCardModal();
  const {getCardById} = useCardDataContext();
  if (selectedCardId === null) return undefined;
  return getCardById(selectedCardId) ?? resolveCard?.(selectedCardId);
}
