import {useState, useEffect} from 'react';
import type {PairSynergyConnection} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {fetchCardSynergies} from '../../synergies/hooks/usePrecomputedSynergies';
import type {VotingPair} from '../types';

/**
 * Loads a specific card pair by IDs for the in-depth voting page.
 * Mirrors the resolvePair logic from usePairQueue but for a single known pair.
 */
export function useSpecificPair(
  cardAId: string | undefined,
  cardBId: string | undefined,
): {pair: VotingPair | null; isLoading: boolean; error: string | null} {
  const {getCardById} = useCardDataContext();
  const [pair, setPair] = useState<VotingPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cardAId || !cardBId) {
      setError('Missing card IDs');
      setIsLoading(false);
      return;
    }

    const cardA = getCardById(cardAId);
    const cardB = getCardById(cardBId);

    if (!cardA || !cardB) {
      setError('One or both cards not found');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        // Try cardA's synergy file first, fall back to cardB's
        let data = await fetchCardSynergies(cardAId);
        let pairData = data.pairs[cardBId];
        if (!pairData) {
          data = await fetchCardSynergies(cardBId);
          pairData = data.pairs[cardAId];
        }

        if (cancelled) return;

        const connections: PairSynergyConnection[] = pairData?.connections ?? [];
        const aggregateScore = pairData?.aggregateScore ?? 0;

        setPair({cardA, cardB, aggregateScore, connections});
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[useSpecificPair] Failed to load pair data:', err);
        setError('Failed to load synergy data');
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardAId, cardBId, getCardById]);

  return {pair, isLoading, error};
}
