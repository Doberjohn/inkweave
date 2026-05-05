import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {CardOverviewModal, SynergyDetailModal} from '../../features/synergies';
import {usePrecomputedSynergies} from '../../features/synergies/hooks';
import {useCardDataContext} from './CardDataContext';
import {useResponsive} from '../hooks';

interface CardModalContextValue {
  selectedCardId: string | null;
  openCardModal: (cardId: string) => void;
  closeCardModal: () => void;
}

const CardModalContext = createContext<CardModalContextValue | undefined>(undefined);

/**
 * Card overview modal — global modal manager.
 *
 * Mounts the `<CardOverviewModal>` (and nested `<SynergyDetailModal>` for pair detail)
 * at AppLayout level so any page can open them without route navigation. URL stays put
 * when a card is opened — closing returns the user to the page they were on.
 */
export function CardModalProvider({children}: {children: ReactNode}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const openCardModal = useCallback((cardId: string) => setSelectedCardId(cardId), []);
  const closeCardModal = useCallback(() => setSelectedCardId(null), []);

  const value = useMemo(
    () => ({selectedCardId, openCardModal, closeCardModal}),
    [selectedCardId, openCardModal, closeCardModal],
  );

  return (
    <CardModalContext.Provider value={value}>
      {children}
      <CardModalRoot />
    </CardModalContext.Provider>
  );
}

function CardModalRoot() {
  const {selectedCardId, closeCardModal} = useCardModal();
  const {getCardById} = useCardDataContext();
  const {isMobile} = useResponsive();
  const card = selectedCardId ? (getCardById(selectedCardId) ?? null) : null;
  const {synergies, getPairSynergies} = usePrecomputedSynergies(card);

  const [detailPair, setDetailPair] = useState<DetailedPairSynergy | null>(null);
  const [lastPair, setLastPair] = useState<DetailedPairSynergy | null>(null);
  const [prevCardId, setPrevCardId] = useState(selectedCardId);

  // Reset detail pair when the focused card changes (prev pair refers to a different card)
  if (selectedCardId !== prevCardId) {
    setPrevCardId(selectedCardId);
    setDetailPair(null);
    setLastPair(null);
  }

  const handleSynergyCardClick = (clickedCard: LorcanaCard, groupKey?: string) => {
    const pair = getPairSynergies(clickedCard, groupKey);
    if (!pair || pair.connections.length === 0) return;
    setDetailPair(pair);
    setLastPair(pair);
  };

  const closeDetail = () => setDetailPair(null);

  if (!card) return null;

  return (
    <>
      <CardOverviewModal
        isOpen
        card={card}
        synergies={synergies}
        onClose={closeCardModal}
        onSynergyCardClick={handleSynergyCardClick}
        isMobile={isMobile}
      />
      {lastPair && (
        <SynergyDetailModal
          isOpen={!!detailPair}
          onClose={closeDetail}
          pair={lastPair}
        />
      )}
    </>
  );
}

export function useCardModal(): CardModalContextValue {
  const ctx = useContext(CardModalContext);
  if (!ctx) throw new Error('useCardModal must be used inside CardModalProvider');
  return ctx;
}
