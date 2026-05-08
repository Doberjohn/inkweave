import {useEffect, useRef} from 'react';
import {Navigate, useParams} from 'react-router-dom';
import type {LorcanaCard} from '../features/cards';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
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
  const cardA = idA ? getCardById(idA) : undefined;
  const cardB = idB ? getCardById(idB) : undefined;
  const {getPairSynergies, isLoading: synergiesLoading} = usePrecomputedSynergies(cardA ?? null);

  const verdict = classifyComparePage({
    idA,
    idB,
    groupKey,
    cardA,
    cardB,
    cardsLoading,
    synergiesLoading,
    getPairSynergies,
  });

  // Open the modal once per URL combo, not on every re-render. `verdict` is a fresh object each
  // render so a naive `[verdict, openComparison]` dependency re-fires the effect even when route
  // params haven't changed — and on a BACK click that re-firing races against the URL navigation,
  // restoring `comparisonPartnerId` after the user just cleared it. Tracking the last opened
  // signature breaks the race: any re-render whose URL didn't actually change is a no-op.
  const lastOpenedSignatureRef = useRef<string | null>(null);
  const verdictSignature = verdict.kind === 'valid' ? `${verdict.idA}|${verdict.idB}|${verdict.groupKey}` : null;
  useEffect(() => {
    if (verdict.kind !== 'valid') return;
    if (lastOpenedSignatureRef.current === verdictSignature) return;
    lastOpenedSignatureRef.current = verdictSignature;
    openComparison(verdict.idA, verdict.idB, verdict.groupKey);
  }, [verdict, verdictSignature, openComparison]);

  return renderComparePage(verdict);
}

export default ComparePage;

type ComparePageVerdict =
  | {kind: 'same-id'; idA: string}
  | {kind: 'not-found'}
  | {kind: 'loading'}
  | {kind: 'valid'; idA: string; idB: string; groupKey: string};

interface ClassifyInput {
  idA: string | undefined;
  idB: string | undefined;
  groupKey: string | undefined;
  cardA: LorcanaCard | undefined;
  cardB: LorcanaCard | undefined;
  cardsLoading: boolean;
  synergiesLoading: boolean;
  getPairSynergies: (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null;
}

/**
 * Pure derivation: route params + load state → an enum-shaped verdict the component renders
 * via a single dispatch. Keeps `ComparePage` itself declarative; all the validation branches
 * live here.
 */
function classifyComparePage(input: ClassifyInput): ComparePageVerdict {
  const {idA, idB, groupKey, cardA, cardB, cardsLoading, synergiesLoading, getPairSynergies} = input;
  if (isSameIdRoute(idA, idB)) return {kind: 'same-id', idA: idA as string};
  if (!groupKey) return {kind: 'not-found'};
  if (cardsLoading || synergiesLoading) return {kind: 'loading'};
  if (!areIdsAndCardsResolved({idA, idB, cardA, cardB})) return {kind: 'not-found'};
  if (!hasMatchingPair({cardB: cardB as LorcanaCard, groupKey, getPairSynergies})) {
    return {kind: 'not-found'};
  }
  return {kind: 'valid', idA: idA as string, idB: idB as string, groupKey};
}

function isSameIdRoute(idA: string | undefined, idB: string | undefined): boolean {
  if (!idA) return false;
  if (!idB) return false;
  return idA === idB;
}

function areIdsAndCardsResolved({
  idA,
  idB,
  cardA,
  cardB,
}: Pick<ClassifyInput, 'idA' | 'idB' | 'cardA' | 'cardB'>): boolean {
  if (!idA) return false;
  if (!idB) return false;
  if (!cardA) return false;
  if (!cardB) return false;
  return true;
}

function hasMatchingPair({
  cardB,
  groupKey,
  getPairSynergies,
}: {
  cardB: LorcanaCard;
  groupKey: string;
  getPairSynergies: ClassifyInput['getPairSynergies'];
}): boolean {
  const pair = getPairSynergies(cardB, groupKey);
  if (!pair) return false;
  return pair.connections.length > 0;
}

function renderComparePage(verdict: ComparePageVerdict): React.ReactElement | null {
  if (verdict.kind === 'same-id') return <Navigate to={`/card/${verdict.idA}`} replace />;
  if (verdict.kind === 'not-found') return <NotFoundPage />;
  // 'loading' and 'valid' both render null — the modal is mounted globally by CardModalProvider.
  return null;
}
