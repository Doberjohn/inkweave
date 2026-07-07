import {createContext, useContext, useState, type ReactNode} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {CardOverviewModal} from '../../features/synergies';
import {usePrecomputedSynergies} from '../../features/synergies/hooks';
import {useCardDataContext} from './CardDataContext';
import {useResponsive} from '../hooks';

interface CardModalContextValue {
  selectedCardId: string | null;
  comparisonPartnerId: string | null;
  /** When set, comparison is filtered to this rule (direct ruleId or playstyleId). */
  comparisonGroupKey: string | null;
  /** True once the user has seen the default modal state in this session (click flow). */
  hasUserSeenDefaultState: boolean;
  /** Ordered snapshot of the grid the modal was opened from, for prev/next navigation. */
  siblingCardIds: string[];
  openCardModal: (cardId: string, siblingIds?: string[]) => void;
  /**
   * Open the modal directly in comparison state. Optional `groupKey` filters connections to
   * that rule, mirroring the click-from-group flow (`/compare/A/B/shift-targets`). Omit for the
   * full-analysis view (`/compare/A/B`).
   */
  openComparison: (cardId: string, partnerId: string, groupKey?: string) => void;
  closeCardModal: () => void;
  /** Move to the previous (-1) or next (1) sibling in `siblingCardIds`, wrapping at the ends. */
  goToSibling: (direction: 1 | -1) => void;
}

const CardModalContext = createContext<CardModalContextValue | undefined>(undefined);

/**
 * Card overview modal — global modal manager.
 *
 * Mounts `<CardOverviewModal>` at AppLayout level so any page can open it without route navigation.
 *
 * Two open modes:
 * - default: modal opens for a single card (`selectedCardId`). URL stays put.
 * - comparison: modal opens directly into the focused comparison view between two cards. Driven
 *   by `/compare/:idA/:idB(/:groupKey)?` deep links and by clicking a synergy card while the modal
 *   is open. The optional `groupKey` filters connections to a specific rule or playstyle, mirroring
 *   the click flow which always carries the source group's key.
 *
 * URL sync — gated on whether the user is already on a `/compare/*` route:
 * - In-app flow (modal opened via card click, URL is /browse, /card/:id, etc.):
 *   entering/exiting comparison does NOT navigate. The underlying page stays
 *   mounted in <Outlet />, so the modal backdrop overlays the originating page
 *   and a backdrop click closes the modal back onto that page.
 * - Deep-link flow (URL is /compare/A/B/groupKey from the start):
 *   switching to a different comparison pair pushes a new `/compare/...` URL
 *   (so the share link stays current); pressing BACK navigates to `/card/A`
 *   (which redirects to '/'); backdrop click navigates to '/' so the route
 *   doesn't immediately re-open the modal.
 *
 * Trade-off: in-app comparison views are not URL-shareable mid-session. Adding
 * a deliberate "share this view" affordance is preferable to silently swapping
 * out the visual context users built up via clicks.
 */
export function CardModalProvider({children}: {children: ReactNode}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [comparisonPartnerId, setComparisonPartnerId] = useState<string | null>(null);
  const [comparisonGroupKey, setComparisonGroupKey] = useState<string | null>(null);
  // Sticky flag: did the user ever see the default modal state in this session? Click-flow
  // users start in default state (openCardModal → before any synergy click), so this becomes
  // true. Deep-link users skip default and go straight to comparison, so this stays false.
  // Drives `hideBackButton` — there's no default state to step back to if the user never saw one.
  const [hasUserSeenDefaultState, setHasUserSeenDefaultState] = useState(false);
  const [siblingCardIds, setSiblingCardIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Detect default-state entry via render-time setState (no useEffect lag, matches the
  // pattern used elsewhere in the modal). The `&& !hasUserSeenDefaultState` guard prevents
  // a re-set loop once the flag is already true.
  const isInDefaultState = !!selectedCardId && !comparisonPartnerId;
  if (isInDefaultState && !hasUserSeenDefaultState) {
    setHasUserSeenDefaultState(true);
  }

  const openCardModal = (cardId: string, siblingIds: string[] = []) => {
    setSelectedCardId(cardId);
    setComparisonPartnerId(null);
    setComparisonGroupKey(null);
    setSiblingCardIds(siblingIds);
    // hasUserSeenDefaultState will flip true on the next render via the guard above.
  };

  const openComparison = (cardId: string, partnerId: string, groupKey?: string) => {
    setSelectedCardId(cardId);
    setComparisonPartnerId(partnerId);
    setComparisonGroupKey(groupKey ?? null);
    setSiblingCardIds([]);
    // Don't touch hasUserSeenDefaultState here — its value is determined by whether the user
    // had previously been in default state for this session. Click flow: openCardModal was
    // called first, flag is already true. Deep link: openComparison is the first call, flag
    // stays false.
  };

  const closeCardModal = () => {
    setSelectedCardId(null);
    setComparisonPartnerId(null);
    setComparisonGroupKey(null);
    setHasUserSeenDefaultState(false);
    setSiblingCardIds([]);
    if (location.pathname.startsWith('/compare/')) {
      navigate('/');
    }
  };

  const goToSibling = (direction: 1 | -1) => {
    if (!selectedCardId || siblingCardIds.length < 2) return;
    const index = siblingCardIds.indexOf(selectedCardId);
    if (index === -1) return;
    const n = siblingCardIds.length;
    const nextId = siblingCardIds[(index + direction + n) % n];
    setSelectedCardId(nextId);
    setComparisonPartnerId(null);
    setComparisonGroupKey(null);
  };

  const {enterComparisonRoute, exitComparisonRoute} = useComparisonRouteSync({
    selectedCardId,
    setComparisonPartnerId,
    setComparisonGroupKey,
  });

  const value = {
    selectedCardId,
    comparisonPartnerId,
    comparisonGroupKey,
    hasUserSeenDefaultState,
    siblingCardIds,
    openCardModal,
    openComparison,
    closeCardModal,
    goToSibling,
  };

  return (
    <CardModalContext.Provider value={value}>
      {children}
      <CardModalRoot
        onEnterComparison={enterComparisonRoute}
        onExitComparison={exitComparisonRoute}
      />
    </CardModalContext.Provider>
  );
}

/**
 * Owns the two URL-sync callbacks the modal calls when the user enters or
 * exits comparison state. Lives outside `CardModalProvider` so the provider
 * stays under the React-component CC threshold.
 *
 * Gate: only navigate when the user is already on a `/compare/*` route (deep
 * link, or a switch-pair click from within the comparison view). Without the
 * gate, an in-app click (from /browse, /card/:id, /playstyles/:id, etc.)
 * would push `/compare/A/B/groupKey`, unmount the originating page from
 * <Outlet />, and leave the modal's backdrop floating over nothing — losing
 * the underlying-page context the user expects to return to on backdrop click.
 */
interface ComparisonRouteSyncInputs {
  selectedCardId: string | null;
  setComparisonPartnerId: (id: string | null) => void;
  setComparisonGroupKey: (key: string | null) => void;
}

function useComparisonRouteSync({
  selectedCardId,
  setComparisonPartnerId,
  setComparisonGroupKey,
}: ComparisonRouteSyncInputs) {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnCompareRoute = location.pathname.startsWith('/compare/');

  const enterComparisonRoute = (partnerId: string, groupKey?: string) => {
    if (!selectedCardId) return;
    if (!isOnCompareRoute) return;
    const path = groupKey
      ? `/compare/${selectedCardId}/${partnerId}/${groupKey}`
      : `/compare/${selectedCardId}/${partnerId}`;
    navigate(path);
  };

  const exitComparisonRoute = () => {
    if (!selectedCardId) return;
    setComparisonPartnerId(null);
    setComparisonGroupKey(null);
    if (isOnCompareRoute) navigate(`/card/${selectedCardId}`);
  };

  return {enterComparisonRoute, exitComparisonRoute};
}

interface CardModalRootProps {
  onEnterComparison: (partnerId: string, groupKey?: string) => void;
  onExitComparison: () => void;
}

function CardModalRoot({onEnterComparison, onExitComparison}: CardModalRootProps) {
  const {
    selectedCardId,
    comparisonPartnerId,
    comparisonGroupKey,
    hasUserSeenDefaultState,
    siblingCardIds,
    closeCardModal,
    goToSibling,
  } = useCardModal();
  const {getCardById} = useCardDataContext();
  const {isMobile} = useResponsive();
  const card = selectedCardId ? (getCardById(selectedCardId) ?? null) : null;
  const partnerCard = comparisonPartnerId ? (getCardById(comparisonPartnerId) ?? null) : null;
  const {synergies, getPairSynergies, isLoading: synergiesLoading} = usePrecomputedSynergies(card);

  if (!card) return null;

  // Hide the BACK button only when the user came in via a fresh deep link — there's no default
  // state to step back to. Click-flow comparison (user previously saw the default modal state
  // before clicking a synergy card) keeps the BACK button so they can return there.
  const hideBackButton = !hasUserSeenDefaultState;

  // Build the deep-link comparison pair only AFTER synergies finish loading. Computing it
  // earlier would adopt a null pair that the modal would never re-adopt once the real data
  // arrives (the modal's render-time guard keys on cardB.id).
  // No synthesized fallback for empty pairs: ComparePage 404s on invalid groupKeys (group
  // produces zero connections), so a valid `/compare/*` URL always has at least one
  // connection by the time we get here. If `getPairSynergies` returns null, we leave
  // initialComparison null and the modal stays in default state for cardA — better UX than
  // an empty comparison view.
  const partnerReady = partnerCard && !synergiesLoading;
  const initialComparison: DetailedPairSynergy | null = partnerReady
    ? (getPairSynergies(partnerCard, comparisonGroupKey ?? undefined) ?? null)
    : null;

  return (
    <CardOverviewModal
      isOpen
      card={card}
      synergies={synergies}
      synergiesLoading={synergiesLoading}
      onClose={closeCardModal}
      getPairSynergies={getPairSynergies}
      isMobile={isMobile}
      initialComparison={initialComparison}
      onEnterComparison={onEnterComparison}
      onExitComparison={onExitComparison}
      hideBackButton={hideBackButton}
      siblingCardIds={siblingCardIds}
      onGoToSibling={goToSibling}
    />
  );
}

export function useCardModal(): CardModalContextValue {
  const ctx = useContext(CardModalContext);
  if (!ctx) throw new Error('useCardModal must be used inside CardModalProvider');
  return ctx;
}
