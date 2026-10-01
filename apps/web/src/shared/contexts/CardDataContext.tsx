import {createContext, useContext, type ReactNode} from 'react';
import type {LorcanaCard} from '../../features/cards';
import {useCardData, type UseCardDataReturn} from '../../features/synergies/hooks/useCardData';

interface CardDataContextValue extends UseCardDataReturn {
  /** O(1) card lookup by string ID */
  getCardById: (id: string) => LorcanaCard | undefined;
}

const CardDataContext = createContext<CardDataContextValue | null>(null);

interface CardDataProviderProps {
  children: ReactNode;
  /** Hold the card list's load on the page the app starts on (#641); see useCardData. */
  deferInitialLoad?: boolean;
}

export function CardDataProvider({children, deferInitialLoad}: CardDataProviderProps) {
  const cardData = useCardData({deferInitialLoad});

  const cardMap = (() => {
    const map = new Map<string, LorcanaCard>();
    for (const card of cardData.cards) {
      map.set(card.id, card);
    }
    return map;
  })();

  const getCardById = (id: string) => cardMap.get(id);

  return (
    <CardDataContext.Provider value={{...cardData, getCardById}}>
      {children}
    </CardDataContext.Provider>
  );
}

export function useCardDataContext(): CardDataContextValue {
  const context = useContext(CardDataContext);
  if (!context) {
    throw new Error('useCardDataContext must be used within a CardDataProvider');
  }
  return context;
}
