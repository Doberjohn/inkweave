import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {FRANCHISES, matchesFranchise, type FranchiseId} from './franchise';

export interface RevealTier {
  id: FranchiseId | 'returning';
  label: string;
  logoUrl?: string;
  cards: LorcanaCard[];
}

export interface UseRevealCardsReturn {
  tiers: RevealTier[];
  loading: boolean;
  error: Error | null;
}

const REVEAL_SET_CODE = '12';
const RETURNING_LABEL = 'Returning franchises in Wilds Unknown';

export function useRevealCards(): UseRevealCardsReturn {
  const {cards, isLoading, error} = useCardDataContext();

  const set12 = cards.filter((c) => c.setCode === REVEAL_SET_CODE);
  const newIpMatches = new Set(FRANCHISES.map((f) => f.match));

  const franchiseTiers: RevealTier[] = FRANCHISES.map(({id, label}) => ({
    id,
    label,
    logoUrl: `/art/franchises/${id}.webp`,
    cards: set12.filter((c) => matchesFranchise(c, id)),
  }));

  const returningCards = set12
    .filter((c) => !c.franchise || !newIpMatches.has(c.franchise))
    .slice()
    .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));

  const tiers: RevealTier[] = [
    ...franchiseTiers,
    {id: 'returning', label: RETURNING_LABEL, cards: returningCards},
  ];

  return {tiers, loading: isLoading, error};
}
