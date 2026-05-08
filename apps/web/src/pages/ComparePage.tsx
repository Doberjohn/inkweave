import {useEffect} from 'react';
import {Navigate, useParams} from 'react-router-dom';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {usePrecomputedSynergies} from '../features/synergies/hooks';
import {NotFoundPage} from './NotFoundPage';

/**
 * `/compare/:idA/:idB/:groupKey` — public deep link to a focused comparison view between two cards.
 *
 * Resolves both card IDs against the loaded card data, opens the global card modal directly
 * in comparison state via `useCardModal().openComparison`, and renders nothing else. The URL
 * stays at `/compare/A/B/groupKey` so the link remains shareable while the modal is open.
 *
 * Group filtering: required for valid deep links. The URL is a strong contract — a valid one
 * always produces a meaningful comparison view. We 404 on:
 * - Missing groupKey (`/compare/A/B`) — engine score is rule-context-specific; no canonical view.
 * - groupKey that doesn't match any connection between the two cards — empty engine column
 *   would break the height-locking contract and offers no useful information.
 * - Either card ID not in the data set.
 *
 * Edge cases:
 * - Same ID (`idA === idB`) → redirects to `/card/A`.
 */
export function ComparePage() {
  const {idA, idB, groupKey} = useParams<{idA: string; idB: string; groupKey?: string}>();
  const {getCardById, isLoading: cardsLoading} = useCardDataContext();
  const {openComparison} = useCardModal();

  const sameId = !!(idA && idB && idA === idB);
  const cardA = idA ? getCardById(idA) : undefined;
  const cardB = idB ? getCardById(idB) : undefined;

  // usePrecomputedSynergies must be called unconditionally (rules of hooks). It no-ops when
  // passed null. Once the cardA-keyed JSON loads, getPairSynergies can resolve the requested
  // pair+group.
  const {getPairSynergies, isLoading: synergiesLoading} = usePrecomputedSynergies(cardA ?? null);

  // Resolve the pair only when all preconditions are met. Returns null while loading and when
  // the pair has no connections for the requested group.
  const allLoaded = !cardsLoading && !synergiesLoading;
  const canResolve = !sameId && allLoaded && cardA && cardB && groupKey;
  const pair = canResolve ? getPairSynergies(cardB, groupKey) : null;
  const hasValidPair = !!pair && pair.connections.length > 0;

  useEffect(() => {
    if (!hasValidPair) return;
    openComparison(idA!, idB!, groupKey!);
  }, [hasValidPair, idA, idB, groupKey, openComparison]);

  if (sameId) return <Navigate to={`/card/${idA}`} replace />;
  if (!groupKey) return <NotFoundPage />;
  if (!allLoaded) return null; // wait for both cards + synergies to finish loading
  if (!cardA || !cardB) return <NotFoundPage />;
  if (!hasValidPair) return <NotFoundPage />;
  return null;
}

export default ComparePage;
