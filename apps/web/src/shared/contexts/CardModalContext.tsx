import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {usePrecomputedSynergies} from '../../features/synergies/hooks';
import {CardOverviewModalFallback} from '../../features/synergies/components/CardOverviewModalFallback';
import {useCardDataContext} from './CardDataContext';
import {useResponsive} from '../hooks';
import {lazyWithRetry} from '../lib/lazyWithRetry';
import {
  getLoadedCardOverviewModal,
  loadCardOverviewModal,
  subscribeToCardOverviewModal,
  warmCardOverviewModalOnFirstInteraction,
} from './cardOverviewModalLoader';
import {CardWindowSlotContext, createCardWindowStores, useCopiesRowHeld} from './cardWindowSlot';

// Loaded on demand (#640): warmed by the first interaction and by card tile hover or focus. An
// open that beats the chunk renders this lazy wrapper and shows CardOverviewModalFallback until
// the chunk arrives; later opens render the loaded component directly (useModalForOpen).
const LazyCardOverviewModal = lazyWithRetry(loadCardOverviewModal, 'CardOverviewModal');

interface OpenCardModalOptions {
  /** Open on this Epic/Enchanted/Iconic printing (a variant id) instead of the Standard art. */
  printingId?: string;
  /**
   * The printing each card starts on, for the opened card and every sibling the
   * arrows step to, by its id and its place in `siblingIds`. Browse opens a card on the
   * printing its tile shows (owner, 2026-10-08), so paging through an Enchanted result
   * stays on Enchanted art. A binder answers by place: it holds a card and its printings
   * as pockets of their own, listed under the card's one id.
   * `printingId`, when also given, wins for the opened card.
   */
  printingFor?: (cardId: string, index: number) => string | undefined;
  /**
   * Where the opened card sits in `siblingIds`, for a list that holds an id more than
   * once (a binder's card and its printings). Defaults to the id's first place.
   */
  siblingIndex?: number;
  /**
   * Resolve an id `CardDataContext` does not hold: the collection's cards from sets
   * 1-8 (#553 Phase C), which are viewable but never enter the Core data on purpose.
   * Consulted only when the Core lookup misses, for the opened card and for every
   * sibling the arrows step to, so a binder's prev/next crosses both kinds. A card
   * resolved here opens with an "outside Core" note in place of synergies.
   */
  resolveCard?: (cardId: string) => LorcanaCard | undefined;
}

interface OpenComparisonOptions {
  /**
   * Open without the window's entrance: a compare link's frame already played it while the pair
   * loaded (#913, `ComparePage`), so the window takes over from it already on screen.
   */
  skipEnter?: boolean;
}

interface CardModalContextValue {
  selectedCardId: string | null;
  comparisonPartnerId: string | null;
  /** When set, comparison is filtered to this rule (direct ruleId or playstyleId). */
  comparisonGroupKey: string | null;
  /** True once the user has seen the default modal state in this session (click flow). */
  hasUserSeenDefaultState: boolean;
  /** Ordered snapshot of the grid the modal was opened from, for prev/next navigation. */
  siblingCardIds: string[];
  /** The printing this open started on (see OpenCardModalOptions), or null for the Standard art. */
  initialPrintingId: string | null;
  /** The open's fallback resolver (see OpenCardModalOptions), or null. */
  resolveCard: ((cardId: string) => LorcanaCard | undefined) | null;
  openCardModal: (cardId: string, siblingIds?: string[], options?: OpenCardModalOptions) => void;
  /**
   * Open the modal directly in comparison state. Optional `groupKey` filters connections to
   * that rule, mirroring the click-from-group flow (`/compare/A/B/shift-targets`). Omit for the
   * full-analysis view (`/compare/A/B`).
   */
  openComparison: (cardId: string, partnerId: string, groupKey?: string, options?: OpenComparisonOptions) => void;
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
  // The open card's place in `siblingCardIds`, kept rather than looked up: a list can hold
  // an id twice, and finding the first copy sent a binder's arrows back to it in a loop.
  const [siblingIndex, setSiblingIndex] = useState(-1);
  const [initialPrintingId, setInitialPrintingId] = useState<string | null>(null);
  // This open takes over from a frame already on screen (OpenComparisonOptions.skipEnter).
  const [skipEnter, setSkipEnter] = useState(false);
  const [windowStores] = useState(createCardWindowStores);
  const [resolveCard, setResolveCard] = useState<((cardId: string) => LorcanaCard | undefined) | null>(null);
  const [printingFor, setPrintingFor] = useState<((cardId: string, index: number) => string | undefined) | null>(
    null,
  );
  const navigate = useNavigate();
  const location = useLocation();

  // The printing each card arrives on, opened or paged to. The window reports any change
  // after that (`useCardWindowSlot`), but a card's first render already names its printing,
  // so whatever fills the window's slot is never drawn for the card it left.
  const startOnPrinting = (printingId: string | null) => {
    setInitialPrintingId(printingId);
    windowStores.shownPrintingId.set(printingId);
  };

  useEffect(() => warmCardOverviewModalOnFirstInteraction(), []);

  // Detect default-state entry via render-time setState (no useEffect lag, matches the
  // pattern used elsewhere in the modal). The `&& !hasUserSeenDefaultState` guard prevents
  // a re-set loop once the flag is already true.
  const isInDefaultState = !!selectedCardId && !comparisonPartnerId;
  if (isInDefaultState && !hasUserSeenDefaultState) {
    setHasUserSeenDefaultState(true);
  }

  const openCardModal = (cardId: string, siblingIds: string[] = [], options: OpenCardModalOptions = {}) => {
    setSelectedCardId(cardId);
    // The window's open flag (`CardWindowStores`), set beside its card in each open and in the close.
    windowStores.open.set(true);
    setComparisonPartnerId(null);
    setComparisonGroupKey(null);
    const index = options.siblingIndex ?? siblingIds.indexOf(cardId);
    setSiblingCardIds(siblingIds);
    setSiblingIndex(index);
    startOnPrinting(options.printingId ?? options.printingFor?.(cardId, index) ?? null);
    // Wrapped: a bare function passed to a state setter is called as an updater.
    setResolveCard(() => options.resolveCard ?? null);
    setPrintingFor(() => options.printingFor ?? null);
    setSkipEnter(false);
    // hasUserSeenDefaultState will flip true on the next render via the guard above.
  };

  const openComparison = (
    cardId: string,
    partnerId: string,
    groupKey?: string,
    {skipEnter: enterOnScreen = false}: OpenComparisonOptions = {},
  ) => {
    setSelectedCardId(cardId);
    windowStores.open.set(true);
    setComparisonPartnerId(partnerId);
    setComparisonGroupKey(groupKey ?? null);
    setSiblingCardIds([]);
    setSiblingIndex(-1);
    startOnPrinting(null);
    setResolveCard(null);
    setPrintingFor(null);
    setSkipEnter(enterOnScreen);
    // Don't touch hasUserSeenDefaultState here — its value is determined by whether the user
    // had previously been in default state for this session. Click flow: openCardModal was
    // called first, flag is already true. Deep link: openComparison is the first call, flag
    // stays false.
  };

  const closeCardModal = () => {
    setSelectedCardId(null);
    windowStores.open.set(false);
    setComparisonPartnerId(null);
    setComparisonGroupKey(null);
    setHasUserSeenDefaultState(false);
    setSiblingCardIds([]);
    setSiblingIndex(-1);
    startOnPrinting(null);
    setPrintingFor(null);
    // The provider outlives collection mode; a kept resolver would hold its pool.
    setResolveCard(null);
    setSkipEnter(false);
    if (location.pathname.startsWith('/compare/')) {
      navigate('/');
    }
  };

  const goToSibling = (direction: 1 | -1) => {
    if (!selectedCardId || siblingCardIds.length < 2 || siblingIndex === -1) return;
    const n = siblingCardIds.length;
    const next = (siblingIndex + direction + n) % n;
    const nextId = siblingCardIds[next];
    setSelectedCardId(nextId);
    setSiblingIndex(next);
    setComparisonPartnerId(null);
    setComparisonGroupKey(null);
    startOnPrinting(printingFor?.(nextId, next) ?? null);
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
    initialPrintingId,
    resolveCard,
    openCardModal,
    openComparison,
    closeCardModal,
    goToSibling,
  };

  return (
    <CardModalContext.Provider value={value}>
      <CardWindowSlotContext.Provider value={windowStores}>
        {children}
        <CardModalRoot
          onEnterComparison={enterComparisonRoute}
          onExitComparison={exitComparisonRoute}
          copiesSlotRef={windowStores.slot.set}
          onShownPrintingChange={windowStores.shownPrintingId.set}
          skipEnter={skipEnter}
        />
      </CardWindowSlotContext.Provider>
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
  /** Takes the window's slot under its card, for `useCardWindowSlot` (#826). */
  copiesSlotRef: (el: HTMLElement | null) => void;
  /** Takes the printing the window shows, for `useCardWindowSlot` (#826). */
  onShownPrintingChange: (printingId: string | null) => void;
  /** The open takes over from a frame already on screen (OpenComparisonOptions.skipEnter). */
  skipEnter: boolean;
}

/**
 * The card to show, and whether it came from outside Core. The open's resolver is
 * asked only when the Core lookup misses: a card from sets 1-8, opened from a
 * collection (#553 Phase C), which never enters CardDataContext on purpose.
 */
function resolveModalCard(
  id: string | null,
  getCardById: (id: string) => LorcanaCard | undefined,
  resolveCard: ((id: string) => LorcanaCard | undefined) | null,
): {card: LorcanaCard | null; outsideCore: boolean} {
  if (id === null) return {card: null, outsideCore: false};
  const core = getCardById(id);
  if (core) return {card: core, outsideCore: false};
  const outside = resolveCard?.(id) ?? null;
  return {card: outside, outsideCore: outside !== null};
}

function CardModalRoot({
  onEnterComparison,
  onExitComparison,
  copiesSlotRef,
  onShownPrintingChange,
  skipEnter,
}: CardModalRootProps) {
  const {
    selectedCardId,
    comparisonPartnerId,
    comparisonGroupKey,
    hasUserSeenDefaultState,
    siblingCardIds,
    initialPrintingId,
    resolveCard,
    closeCardModal,
    goToSibling,
  } = useCardModal();
  const {getCardById} = useCardDataContext();
  const {isMobile} = useResponsive();
  const {card, outsideCore} = resolveModalCard(selectedCardId, getCardById, resolveCard);
  const partnerCard = comparisonPartnerId ? (getCardById(comparisonPartnerId) ?? null) : null;
  const {synergies, getPairSynergies, isLoading: synergiesLoading} = usePrecomputedSynergies(outsideCore ? null : card);
  const {Modal, openedBeforeModalReady} = useModalForOpen(card !== null);
  // Already on screen when it mounts: after the fallback played the entrance, or after a frame did.
  const enterOnScreen = openedBeforeModalReady || skipEnter;
  // The row under the card, for the page's copies, while a page holds it (`useHoldCopiesRow`).
  const copiesRow = useCopiesRowHeld();

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
    <Suspense
      fallback={
        <CardOverviewModalFallback
          card={card}
          isMobile={isMobile}
          printingId={initialPrintingId}
          copiesRow={copiesRow}
          startVisible={skipEnter}
          onClose={closeCardModal}
        />
      }>
      <Modal
        skipEnterTransition={enterOnScreen}
        isOpen
        card={card}
        synergies={synergies}
        synergiesLoading={synergiesLoading}
        outsideCore={outsideCore}
        onClose={closeCardModal}
        getPairSynergies={getPairSynergies}
        isMobile={isMobile}
        initialComparison={initialComparison}
        onEnterComparison={onEnterComparison}
        onExitComparison={onExitComparison}
        hideBackButton={hideBackButton}
        siblingCardIds={siblingCardIds}
        onGoToSibling={goToSibling}
        initialPrintingId={initialPrintingId}
        copiesSlotRef={copiesRow ? copiesSlotRef : undefined}
        onShownPrintingChange={onShownPrintingChange}
      />
    </Suspense>
  );
}

/**
 * Which modal component this open renders, decided once when it opens (#640):
 * - chunk not arrived: the lazy wrapper. It suspends, CardOverviewModalFallback plays the
 *   entrance, and the modal then mounts already visible (`openedBeforeModalReady`).
 * - chunk arrived: the loaded component itself, which renders without suspending and plays its
 *   own entrance. Going through the lazy wrapper would still suspend once and flash the fallback.
 * Held for the whole open: switching components mid-open would remount the modal, losing its
 * state and the element its focus returns to. Render-time setState, like the provider's
 * default-state flag.
 */
function useModalForOpen(isOpen: boolean) {
  const loadedModal = useSyncExternalStore(
    subscribeToCardOverviewModal,
    getLoadedCardOverviewModal,
    () => null,
  );
  const [open, setOpen] = useState({isOpen: false, early: false});
  let {early} = open;
  if (open.isOpen !== isOpen) {
    early = isOpen && loadedModal === null;
    setOpen({isOpen, early});
  }
  const Modal = early || !loadedModal ? LazyCardOverviewModal : loadedModal;
  return {Modal, openedBeforeModalReady: early};
}

export function useCardModal(): CardModalContextValue {
  const ctx = useContext(CardModalContext);
  if (!ctx) throw new Error('useCardModal must be used inside CardModalProvider');
  return ctx;
}
