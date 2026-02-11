import {createContext, useContext, useMemo, type ReactNode} from 'react';
import type {LorcanaCard} from '../../features/cards';
import {useCardData, type UseCardDataReturn} from '../../features/synergies/hooks/useSynergyFinder';

interface CardDataContextValue extends UseCardDataReturn {
  /** O(1) card lookup by numeric ID */
  getCardById: (id: string) => LorcanaCard | undefined;
}

const CardDataContext = createContext<CardDataContextValue | null>(null);

export function CardDataProvider({children}: {children: ReactNode}) {
  const {cards, isLoading, error, totalCards, uniqueKeywords, uniqueClassifications, uniqueSets, sets, retryLoad} =
    useCardData();

  const cardMap = useMemo(() => {
    const map = new Map<string, LorcanaCard>();
    for (const card of cards) {
      map.set(card.id, card);
    }
    return map;
  }, [cards]);

  const value = useMemo(
    () => ({
      cards,
      isLoading,
      error,
      totalCards,
      uniqueKeywords,
      uniqueClassifications,
      uniqueSets,
      sets,
      retryLoad,
      getCardById: (id: string) => cardMap.get(id),
    }),
    [cards, isLoading, error, totalCards, uniqueKeywords, uniqueClassifications, uniqueSets, sets, retryLoad, cardMap],
  );

  return <CardDataContext.Provider value={value}>{children}</CardDataContext.Provider>;
}

export function useCardDataContext(): CardDataContextValue {
  const context = useContext(CardDataContext);
  if (!context) {
    throw new Error('useCardDataContext must be used within a CardDataProvider');
  }
  return context;
}
