import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {SynergyGroup} from './SynergyGroup';
import {EngineColumn} from './EngineColumn';
import {CommunityColumn} from './CommunityColumn';
import {MobileComparisonView, type ComparisonOriginRects} from './MobileComparisonView';
import {CardImage, RenderProfiler} from '../../../shared/components';
import {useDialogFocus} from '../../../shared/hooks/useDialogFocus';
import {useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {getDominantScore, getStrengthTier} from '../utils';
import {COLORS, FONTS, RADIUS, Z_INDEX} from '../../../shared/constants';

const FLIP_DURATION = 480;
const FLIP_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/**
 * Inset (px) each card pulls inward when entering comparison mode so its
 * inner edge touches the PairConnector. Derived from the modal's typical
 * desktop geometry: (rowWidth ~950 - 2*cardWidth 337 - connectorWidth 192) / 2.
 * If the modal width changes, this may need to be recalculated dynamically
 * (ResizeObserver) — for now it's a constant tuned to the current shell width.
 */
const COMPARISON_CARD_INSET = 42;

interface CardOverviewModalProps {
  isOpen: boolean;
  card: LorcanaCard;
  synergies: SynergyGroupData[];
  /** True while the per-card synergy JSON is in flight. When set, the right
   *  column shows a skeleton placeholder instead of the empty-state copy,
   *  which would mislead users on slow connections (3G) into thinking the
   *  card genuinely has zero synergies. See usePrecomputedSynergies for the
   *  fetch lifecycle. */
  synergiesLoading?: boolean;
  onClose: () => void;
  /** Resolves a clicked card into its full pair-synergy data (engine + connection details). */
  getPairSynergies: (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null;
  isMobile?: boolean;
  /**
   * Pre-resolved comparison pair for deep-link entry (e.g. /compare/A/B). When set, the modal
   * opens directly in comparison state without the FLIP animation. Null in regular open flow.
   */
  initialComparison?: DetailedPairSynergy | null;
  /**
   * Called when the user clicks a synergy card to enter comparison — for URL push.
   * `groupKey` mirrors the group the user clicked from (so the URL can encode that filter).
   */
  onEnterComparison?: (partnerId: string, groupKey?: string) => void;
  /** Called when the user exits comparison via the BACK button — for URL push. */
  onExitComparison?: () => void;
  /**
   * Hide the BACK button in comparison state. Useful for deep-linked comparison views
   * where there's no "previous" comparison to back out of — the X close remains the only
   * way out, and clicking it leaves the user wherever closing the modal would normally land.
   */
  hideBackButton?: boolean;
}

interface ModalState {
  modalRef: React.RefObject<HTMLDivElement | null>;
  initialFocusRef: React.RefObject<HTMLElement | null>;
  compareCardRef: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  onTransitionEnd: () => void;
  activeGroupFilter: string | null;
  comparisonPair: DetailedPairSynergy | null;
  /**
   * The pair held during the exit animation (#332 #7). When the user clicks BACK,
   * `comparisonPair` becomes null but `exitingPair` retains the pair so CompareCardOverlay
   * and PairConnector stay mounted long enough to animate out. Cleared after FLIP_DURATION.
   */
  exitingPair: DetailedPairSynergy | null;
  /** Origin rects for the mobile comparison FLIP — see {@link ComparisonOriginRects}. */
  comparisonOrigin: ComparisonOriginRects | null;
  highlightedCard: 'a' | 'b' | null;
  setHighlightedCard: (card: 'a' | 'b' | null) => void;
  visibleGroups: SynergyGroupData[];
  inComparison: boolean;
  handleModalKeyDown: (e: React.KeyboardEvent) => void;
  exitComparison: () => void;
  toggleChip: (key: string) => void;
  handleShowAll: (groupKey: string) => void;
  handleSynergyCardClick: (clickedCard: LorcanaCard, groupKey?: string) => void;
}

/**
 * Owns the modal's local state machine: chip filter, comparison pair, FLIP refs,
 * highlight state, and all derived handlers. Render-time setState patterns (card-id reset,
 * isOpen reset, deep-link adoption) live in {@link useComparisonStateResets} so this hook
 * stays focused on orchestration.
 */
function useCardOverviewModalState(props: CardOverviewModalProps): ModalState {
  const {isOpen, card, onClose, initialComparison = null, hideBackButton = false} = props;

  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLElement>(null);
  const {visible, onTransitionEnd} = useTransitionPresence(isOpen);

  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [comparisonPair, setComparisonPair] = useState<DetailedPairSynergy | null>(null);
  const [highlightedCard, setHighlightedCard] = useState<'a' | 'b' | null>(null);
  // Exit-animation state (#332 #7). When the user clicks BACK, `comparisonPair` becomes null
  // immediately (chrome starts fading back in, Card A drifts back, panel collapses via existing
  // transitions). `exitingPair` retains the pair so CompareCardOverlay + PairConnector stay
  // mounted for the FLIP_DURATION exit window. The destination tile rect is read inside the
  // FLIP layoutEffect at exit time (not captured here) so this callback has no ref access —
  // keeping it analyzable as a pure event handler by React Compiler.
  const [exitingPair, setExitingPair] = useState<DetailedPairSynergy | null>(null);
  // Origin rects (Card A big image + tapped synergy tile) captured at click time, consumed by
  // the mobile MobileComparisonView entry/exit FLIP. Survives the exit window for the FLIP-back.
  const [comparisonOrigin, setComparisonOrigin] = useState<ComparisonOriginRects | null>(null);

  const cancelPendingExit = useCallback(() => {
    setExitingPair(null);
  }, []);

  const onExitComparisonProp = props.onExitComparison;
  const exitComparison = useCallback(() => {
    if (!comparisonPair) return;
    setExitingPair(comparisonPair);
    setComparisonPair(null);
    setHighlightedCard(null);
    onExitComparisonProp?.();
  }, [comparisonPair, onExitComparisonProp]);

  // Schedule the actual unmount of the exit overlays after FLIP_DURATION. Cleanup clears the
  // timeout on re-entry (when `exitingPair` flips to null via cancelPendingExit) so a quick
  // re-click during exit doesn't unmount the overlays mid-FLIP.
  useEffect(() => {
    if (!exitingPair) return;
    const id = setTimeout(() => setExitingPair(null), FLIP_DURATION);
    return () => clearTimeout(id);
  }, [exitingPair]);

  const {handleKeyDown: handleModalKeyDown} = useDialogFocus({
    isOpen,
    containerRef: modalRef,
    initialFocusRef,
    // In deep-link comparison (hideBackButton), Esc closes the whole modal — there's no
    // back-stack to step out into. In normal comparison, Esc exits comparison only.
    onClose: pickEscapeHandler({comparisonPair, hideBackButton, exitComparison, onClose}),
  });

  useComparisonStateResets({
    card,
    isOpen,
    initialComparison,
    setComparisonPair,
    setExitingPair,
    setHighlightedCard,
  });

  const visibleGroups = useMemo(
    () => buildVisibleGroups(props.synergies, activeGroupFilter),
    [props.synergies, activeGroupFilter],
  );

  const {compareCardRef, captureStartRect} = useFLIPAnimation(comparisonPair, exitingPair);
  // Re-entry guard for the 90ms click-ack window (#332 #6 idea B). Holds the setTimeout id while
  // the ack is in flight; null when idle. Doubles as a cancellation handle so the timeout can be
  // cleared if the modal closes mid-ack (otherwise `fireComparison` would fire ~90ms after the
  // user has already dismissed the modal, triggering state updates on a tearing-down component).
  const clickAckTimeoutRef = useRef<number | null>(null);

  // Cancel any in-flight click-ack when the modal closes OR the component unmounts. The body
  // clears on isOpen → false; the returned cleanup clears on every dependency change AND on
  // unmount — covers the case where the component is torn down while isOpen is still true
  // (e.g. Suspense boundary suspends mid-ack), which would otherwise let `fireComparison`
  // run on an unmounted component and trigger a state-update warning.
  useEffect(() => {
    if (!isOpen && clickAckTimeoutRef.current !== null) {
      window.clearTimeout(clickAckTimeoutRef.current);
      clickAckTimeoutRef.current = null;
    }
    return () => {
      if (clickAckTimeoutRef.current !== null) {
        window.clearTimeout(clickAckTimeoutRef.current);
        clickAckTimeoutRef.current = null;
      }
    };
  }, [isOpen]);

  const toggleChip = (key: string) => {
    setActiveGroupFilter((prev) => (prev === key ? null : key));
  };

  const handleShowAll = (groupKey: string) => setActiveGroupFilter(groupKey);

  const handleSynergyCardClick = (clickedCard: LorcanaCard, groupKey?: string) => {
    // If the user re-clicks a tile mid-exit, cancel the pending unmount so the new entry's
    // FLIP doesn't race against the old exit's transform style on the same compareCardRef.
    cancelPendingExit();
    invokeSynergyCardClick({
      clickedCard,
      groupKey,
      modalRef,
      captureStartRect,
      setComparisonPair,
      setComparisonOrigin,
      getPairSynergies: props.getPairSynergies,
      onEnterComparison: props.onEnterComparison,
      clickAckTimeoutRef,
    });
  };

  return {
    modalRef,
    initialFocusRef,
    compareCardRef,
    visible,
    onTransitionEnd,
    activeGroupFilter,
    comparisonPair,
    exitingPair,
    comparisonOrigin,
    highlightedCard,
    setHighlightedCard,
    visibleGroups,
    inComparison: !!comparisonPair,
    handleModalKeyDown,
    exitComparison,
    toggleChip,
    handleShowAll,
    handleSynergyCardClick,
  };
}

/**
 * Card overview modal — replaces the full-page card detail view with a modal-on-top-of-current-page experience.
 *
 * Default mode (matches `apps/web/public/mockups/card-modal-base.html`):
 * - Header: card name (h1) + close button
 * - Chip row: synergy group filters with count badges (tier-colored)
 * - Hero divider (gold gradient line)
 * - Cards row: big card image (left) + group stack (right)
 *
 * Comparison mode — entered when a synergy mini-tile is clicked:
 * - chip-row, hero-divider, info-col fade out (250ms)
 * - compare-card grows from clicked tile rect to 380×530 next to A (FLIP, 480ms cubic-bezier)
 * - pair-connector dashed lines + score badge fade in (250ms, delayed 200ms)
 * - comparison-detail panel (engine + community columns) expands max-height (480ms) + opacity (300ms, delayed 250ms)
 * - compare-back button replaces chip-row visually (top-left)
 *
 * State machine:
 * - default — chip-row inactive, all groups visible with preview-sized mini-grid
 * - focused — chip pressed → only that group visible, expanded mini-grid (up to 11 cards + More tile)
 * - comparison — synergy card clicked → in-place pair detail, both A and B side-by-side
 */
export function CardOverviewModal(props: CardOverviewModalProps) {
  const {isOpen, card, synergies, synergiesLoading = false, onClose, isMobile = false, hideBackButton = false} = props;
  const {
    modalRef,
    compareCardRef,
    visible,
    onTransitionEnd,
    activeGroupFilter,
    comparisonPair,
    exitingPair,
    comparisonOrigin,
    highlightedCard,
    setHighlightedCard,
    visibleGroups,
    inComparison,
    handleModalKeyDown,
    exitComparison,
    toggleChip,
    handleShowAll,
    handleSynergyCardClick,
  } = useCardOverviewModalState(props);
  const {mounted} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);

  if (!mounted) return null;

  // 337px matches the full-size AVIF's intrinsic width (see scripts/download-card-images.mjs).
  // Rendering at native size avoids browser upscaling (was 380 → ~1.13× zoom on the AVIF).
  // The Lorcana card aspect ratio 264:368 is the same as the AVIF's 337:470, so cardHeight
  // resolves to 470 — a clean 1:1 mapping for the LCP image.
  const cardWidth = isMobile ? 240 : 337;
  const cardHeight = Math.round((cardWidth * 368) / 264);
  const dataMode = inComparison ? 'comparison' : 'default';

  return (
    <RenderProfiler id="CardOverviewModal">
      <>
        <ModalBackdrop visible={visible} onClose={onClose} onTransitionEnd={onTransitionEnd} />
        <div style={CENTERING_WRAPPER_STYLE}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog keyboard handling (Escape to close) */}
          <div
            ref={modalRef}
            className={`overlay-transition overlay-scale overlay-enter ${visible ? 'overlay-visible' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${card.fullName} synergies`}
            data-testid="card-overview-modal"
            data-state={activeGroupFilter ? 'focused' : 'default'}
            data-mode={dataMode}
            data-highlighted={highlightedCard ?? undefined}
            onKeyDown={handleModalKeyDown}
            onTransitionEnd={onTransitionEnd}
            style={pickModalShellStyle(isMobile)}>
            <ModalHeader
              card={card}
              isMobile={isMobile}
              inComparison={inComparison}
              hideBackButton={hideBackButton}
              onClose={onClose}
              exitComparison={exitComparison}
            />
            <ChipFilterRow
              synergies={synergies}
              inComparison={inComparison}
              activeGroupFilter={activeGroupFilter}
              toggleChip={toggleChip}
            />
            <HeroDivider hasSynergies={synergies.length > 0} inComparison={inComparison} />
            <ModalBody>
              <MobileOrDesktopBody
                isMobile={isMobile}
                card={card}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                synergies={synergies}
                synergiesLoading={synergiesLoading}
                visibleGroups={visibleGroups}
                activeGroupFilter={activeGroupFilter}
                comparisonPair={comparisonPair}
                exitingPair={exitingPair}
                comparisonOrigin={comparisonOrigin}
                highlightedCard={highlightedCard}
                inComparison={inComparison}
                compareCardRef={compareCardRef}
                onShowAll={handleShowAll}
                onCardClick={handleSynergyCardClick}
                setHighlightedCard={setHighlightedCard}
              />
            </ModalBody>
          </div>
        </div>
      </>
    </RenderProfiler>
  );
}

// ── Sub-hooks and helpers (reduce parent-hook complexity) ──

interface ResetInput {
  card: LorcanaCard;
  isOpen: boolean;
  initialComparison: DetailedPairSynergy | null;
  setComparisonPair: (p: DetailedPairSynergy | null) => void;
  /** Cleared alongside `comparisonPair` so the 480ms exit overlay can't leak across card-change
   *  or modal-close boundaries (would otherwise render stale Card B on top of new state). */
  setExitingPair: (p: DetailedPairSynergy | null) => void;
  setHighlightedCard: (c: 'a' | 'b' | null) => void;
}

/**
 * Render-time setState resets for comparison state. Three independent triggers — card change,
 * deep-link adoption, modal close — each compares previous-vs-current values and writes new
 * state if they differ. Mirrors the cascading-render-warning workaround used elsewhere in the
 * codebase (avoids setState-in-effect).
 */
function useComparisonStateResets({card, isOpen, initialComparison, setComparisonPair, setExitingPair, setHighlightedCard}: ResetInput) {
  const [prevCardId, setPrevCardId] = useState(card.id);
  if (card.id !== prevCardId) {
    setPrevCardId(card.id);
    setComparisonPair(null);
    setExitingPair(null);
    setHighlightedCard(null);
  }

  const [adoptedInitialId, setAdoptedInitialId] = useState<string | null>(null);
  if (initialComparison && initialComparison.cardB.id !== adoptedInitialId) {
    setAdoptedInitialId(initialComparison.cardB.id);
    setComparisonPair(initialComparison);
  } else if (!initialComparison && adoptedInitialId !== null) {
    setAdoptedInitialId(null);
  }

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setComparisonPair(null);
      setExitingPair(null);
      setHighlightedCard(null);
    }
  }
}

interface FLIPAnimationApi {
  compareCardRef: React.RefObject<HTMLDivElement | null>;
  captureStartRect: (rect: DOMRect | null) => void;
}

/**
 * FLIP animation for comparison entry AND exit (#332 #6 entry, #332 #7 exit).
 *
 * Entry: when `comparisonPair` becomes set, animate from the captured source rect (the clicked
 * tile) to the destination ref's current rect (the CompareCardOverlay position). 480ms cubic.
 *
 * Exit: when `comparisonPair` clears AND `exitingPair` is set, animate FROM the overlay position
 * TO the destination tile's rect (`exitDestRect`). Card B fades out near the end of the FLIP so
 * it doesn't visibly land on the tile (the tile is fading IN at the same time via the info-column
 * opacity transition).
 *
 * Refs live inside the hook to keep mutation contained (React Compiler forbids mutation of hook
 * arguments). Source rect is consumed-and-cleared after the entry animation so a stale value
 * can't bleed into a later deep-link entry.
 */
function useFLIPAnimation(
  comparisonPair: DetailedPairSynergy | null,
  exitingPair: DetailedPairSynergy | null,
): FLIPAnimationApi {
  const compareCardRef = useRef<HTMLDivElement>(null);
  const flipStartRectRef = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!comparisonPair) return;
    const el = compareCardRef.current;
    const start = flipStartRectRef.current;
    flipStartRectRef.current = null;
    if (el && start) runEntryFLIP(el, start);
  }, [comparisonPair]);

  useLayoutEffect(() => {
    if (comparisonPair || !exitingPair) return;
    const el = compareCardRef.current;
    if (el) runExitFLIP(el, exitingPair);
  }, [comparisonPair, exitingPair]);

  const captureStartRect = (rect: DOMRect | null) => {
    flipStartRectRef.current = rect;
  };

  return {compareCardRef, captureStartRect};
}

/**
 * Entry FLIP body. Clears any stale inline state from a prior exit FLIP BEFORE reading the end
 * rect — without the reset, a mid-exit re-entry would measure the exit's destination position
 * instead of the overlay position, and the FLIP would start from the wrong place.
 */
function runEntryFLIP(el: HTMLDivElement, start: DOMRect): void {
  el.style.transition = 'none';
  el.style.transform = '';
  el.style.opacity = '';
  if (prefersReducedMotion()) return;
  void el.offsetWidth;
  const end = el.getBoundingClientRect();
  const dx = start.left - end.left;
  const dy = start.top - end.top;
  const sx = start.width / end.width;
  const sy = start.height / end.height;
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  void el.offsetWidth;
  el.style.transition = `transform ${FLIP_DURATION}ms ${FLIP_EASING}`;
  el.style.transform = '';
}

/**
 * Exit FLIP body. Animates Card B back to the originating tile's rect and fades it out near
 * the end of the FLIP. The destination tile is queried from the DOM at exit time (not captured
 * up-front) so the `exitComparison` event handler stays ref-free for React Compiler analysis.
 */
function runExitFLIP(el: HTMLDivElement, exitingPair: DetailedPairSynergy): void {
  if (prefersReducedMotion()) {
    el.style.transition = 'none';
    el.style.opacity = '0';
    return;
  }
  const tileEl = el
    .closest('[data-testid="card-overview-modal"]')
    ?.querySelector(`[data-card-id="${exitingPair.cardB.id}"]`) as HTMLElement | null;
  if (!tileEl) {
    // Fallback: destination tile is no longer in the DOM (e.g. the synergy group it came from
    // was filtered out, or scroll position changed during the focused view). Without this,
    // Card B would stay stuck at the overlay position until the unmount timeout fires (480ms
    // later) — visually it pops out abruptly. Fade it out over 200ms instead.
    el.style.transition = 'opacity 200ms ease-out';
    el.style.opacity = '0';
    return;
  }
  const destRect = tileEl.getBoundingClientRect();
  const currentRect = el.getBoundingClientRect();
  const dx = destRect.left - currentRect.left;
  const dy = destRect.top - currentRect.top;
  const sx = destRect.width / currentRect.width;
  const sy = destRect.height / currentRect.height;
  // Opacity transitions over 200ms with 280ms delay → fully invisible at t=480. By the time
  // Card B reaches the tile rect, it's already gone — the tile beneath is visible (fading in
  // via info-column's 250ms opacity transition).
  el.style.transition = `transform ${FLIP_DURATION}ms ${FLIP_EASING}, opacity 200ms ease-out 280ms`;
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  el.style.opacity = '0';
}

interface EscapeHandlerInput {
  comparisonPair: DetailedPairSynergy | null;
  hideBackButton: boolean;
  exitComparison: () => void;
  onClose: () => void;
}

function pickEscapeHandler({comparisonPair, hideBackButton, exitComparison, onClose}: EscapeHandlerInput): () => void {
  if (comparisonPair && !hideBackButton) return exitComparison;
  return onClose;
}

function buildVisibleGroups(synergies: SynergyGroupData[], activeGroupFilter: string | null): SynergyGroupData[] {
  const base = activeGroupFilter
    ? synergies.filter((g) => g.groupKey === activeGroupFilter)
    : synergies;
  return base.map((g) => ({...g, description: g.tagline}));
}

interface SynergyCardClickInput {
  clickedCard: LorcanaCard;
  groupKey?: string;
  modalRef: React.RefObject<HTMLDivElement | null>;
  captureStartRect: (rect: DOMRect | null) => void;
  setComparisonPair: (p: DetailedPairSynergy | null) => void;
  /** Stores Card A + Card B origin rects for the mobile MobileComparisonView entry/exit FLIP. */
  setComparisonOrigin: (origin: ComparisonOriginRects | null) => void;
  getPairSynergies: (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null;
  onEnterComparison?: (partnerId: string, groupKey?: string) => void;
  /**
   * Re-entry guard for the click-ack beat (#332 #6 idea B). Holds the setTimeout id while the
   * ack is in flight; null when idle. Truthy → ignore subsequent clicks. Also serves as the
   * cancellation handle so the timeout can be cleared if the modal closes mid-ack.
   */
  clickAckTimeoutRef: React.MutableRefObject<number | null>;
}

const CLICK_ACK_DURATION_MS = 90;

/** Whether the user has set OS-level "reduce motion." Returns false in non-browser contexts. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A pair is click-actionable when it exists AND has at least one connection to display. */
function isPairClickActionable(pair: DetailedPairSynergy | null): pair is DetailedPairSynergy {
  return !!pair && pair.connections.length > 0;
}

interface FireComparisonInput {
  pair: DetailedPairSynergy;
  /** The tapped synergy tile (Card B's origin). */
  tileEl: HTMLElement | null;
  /** Card A's big-image element in the default view (Card A's FLIP origin). */
  cardAEl: HTMLElement | null;
  clickedCard: LorcanaCard;
  groupKey: string | undefined;
  captureStartRect: (rect: DOMRect | null) => void;
  setComparisonPair: (p: DetailedPairSynergy | null) => void;
  setComparisonOrigin: (origin: ComparisonOriginRects | null) => void;
  onEnterComparison?: (partnerId: string, groupKey?: string) => void;
  clickAckTimeoutRef: React.MutableRefObject<number | null>;
}

/** FLIP-start side effect: capture both cards' origin rects, set the comparison pair, notify. */
function fireComparison({pair, tileEl, cardAEl, clickedCard, groupKey, captureStartRect, setComparisonPair, setComparisonOrigin, onEnterComparison, clickAckTimeoutRef}: FireComparisonInput): void {
  // Measured here, before setComparisonPair swaps the view away. The Card B (tile) rect also
  // feeds the desktop useFLIPAnimation via captureStartRect.
  const cardBRect = tileEl ? tileEl.getBoundingClientRect() : null;
  const cardARect = cardAEl ? cardAEl.getBoundingClientRect() : null;
  captureStartRect(cardBRect);
  setComparisonOrigin({cardA: cardARect, cardB: cardBRect});
  setComparisonPair(pair);
  onEnterComparison?.(clickedCard.id, groupKey);
  clickAckTimeoutRef.current = null;
}

/**
 * Plays the click-ack scale-bump on the tile, then runs `onComplete`. When reduced-motion is on,
 * the ack is skipped entirely — `onComplete` fires synchronously so the FLIP latency stays at zero.
 * The setTimeout id is stored on `timeoutRef` so the parent can cancel it if the modal closes
 * mid-ack (prevents `onComplete` firing on a tearing-down component).
 */
function triggerClickAck(tileEl: HTMLElement, onComplete: () => void, timeoutRef: React.MutableRefObject<number | null>): void {
  if (prefersReducedMotion()) {
    onComplete();
    return;
  }
  tileEl.classList.add('tile-click-ack');
  timeoutRef.current = window.setTimeout(() => {
    tileEl.classList.remove('tile-click-ack');
    onComplete();
  }, CLICK_ACK_DURATION_MS);
}

function invokeSynergyCardClick({clickedCard, groupKey, modalRef, captureStartRect, setComparisonPair, setComparisonOrigin, getPairSynergies, onEnterComparison, clickAckTimeoutRef}: SynergyCardClickInput) {
  if (clickAckTimeoutRef.current !== null) return;
  const pair = getPairSynergies(clickedCard, groupKey);
  if (!isPairClickActionable(pair)) return;
  const tileEl = modalRef.current?.querySelector(
    `[data-card-id="${clickedCard.id}"]`,
  ) as HTMLElement | null;
  // Card A's big image in the default view — its FLIP origin for the mobile transition.
  const cardAEl = modalRef.current?.querySelector('[data-comparison-card-a]') as HTMLElement | null;
  const fireInput: FireComparisonInput = {
    pair, tileEl, cardAEl, clickedCard, groupKey, captureStartRect, setComparisonPair, setComparisonOrigin, onEnterComparison, clickAckTimeoutRef,
  };
  if (!tileEl) {
    // No tile element to bump (shouldn't happen in practice — every SynergyCard has
    // data-card-id). Fall back to the synchronous fire path so the click still works.
    fireComparison(fireInput);
    return;
  }
  triggerClickAck(tileEl, () => fireComparison(fireInput), clickAckTimeoutRef);
}

// ── Layout config / static styles ──

/** Screen-reader-only utility: keep an element in the a11y tree but visually hide it. */
const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const CENTERING_WRAPPER_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: Z_INDEX.modal,
  pointerEvents: 'none',
  padding: '24px',
};

function pickModalShellStyle(isMobile: boolean): React.CSSProperties {
  return {
    width: isMobile ? '100%' : 1000,
    maxWidth: isMobile ? 580 : 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    background: COLORS.surface,
    borderRadius: `${RADIUS.card}px`,
    border: `1px solid ${COLORS.surfaceBorder}`,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 175, 55, 0.08)',
    position: 'relative',
    pointerEvents: 'auto',
    fontFamily: FONTS.body,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };
}

// ── Sub-components ──

function ModalBackdrop({
  visible,
  onClose,
  onTransitionEnd,
}: {
  visible: boolean;
  onClose: () => void;
  onTransitionEnd: () => void;
}) {
  return (
    <div
      className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
      aria-hidden="true"
      onClick={onClose}
      data-testid="card-overview-backdrop"
      onTransitionEnd={onTransitionEnd}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: Z_INDEX.modalBackdrop,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
      }}
    />
  );
}

interface ModalHeaderProps {
  card: LorcanaCard;
  isMobile: boolean;
  inComparison: boolean;
  hideBackButton: boolean;
  onClose: () => void;
  exitComparison: () => void;
}

function ModalHeader({card, isMobile, inComparison, hideBackButton, onClose, exitComparison}: ModalHeaderProps) {
  const showBack = inComparison && !hideBackButton;
  return (
    <header style={{padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
      {showBack ? <BackButton onClick={exitComparison} /> : <ModalTitle card={card} isMobile={isMobile} />}
      {/* Spacer pushes close button to the right when BACK is in the slot (BACK doesn't have flex:1) */}
      {inComparison && <div style={{flex: 1}} />}
      <CloseButton onClose={onClose} />
    </header>
  );
}

function ModalTitle({card, isMobile}: {card: LorcanaCard; isMobile: boolean}) {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: FONTS.body,
        fontSize: isMobile ? 18 : 22,
        fontWeight: 700,
        color: COLORS.text,
        lineHeight: 1.2,
        flex: 1,
        minWidth: 0,
      }}>
      {card.fullName}
    </h1>
  );
}

interface ChipFilterRowProps {
  synergies: SynergyGroupData[];
  inComparison: boolean;
  activeGroupFilter: string | null;
  toggleChip: (key: string) => void;
}

function ChipFilterRow({synergies, inComparison, activeGroupFilter, toggleChip}: ChipFilterRowProps) {
  // Render even when inComparison so the row can fade smoothly (250ms ease-out) alongside the
  // info-column's existing fade. Returning null on comparison-entry produces a jarring instant pop
  // while the info-column animates next to it — that asymmetry is what this opacity-driven exit
  // closes. The `synergies.length === 0` short-circuit still returns null (no chrome to fade).
  if (synergies.length === 0) return null;
  return (
    <div
      // `inert` removes the row + descendants from focus order + a11y tree while invisible
      // during comparison. opacity:0 + pointer-events:none would still leave the chip buttons
      // tab-reachable, defeating keyboard nav. React 19 honors `inert` as a boolean.
      inert={inComparison}
      style={{
        padding: '14px 24px 0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        opacity: inComparison ? 0 : 1,
        pointerEvents: inComparison ? 'none' : 'auto',
        transition: 'opacity 250ms ease-out',
      }}>
      {synergies.map((group) => (
        <FilterChip
          key={group.groupKey}
          group={group}
          activeGroupFilter={activeGroupFilter}
          toggleChip={toggleChip}
        />
      ))}
    </div>
  );
}

interface FilterChipProps {
  group: SynergyGroupData;
  activeGroupFilter: string | null;
  toggleChip: (key: string) => void;
}

function FilterChip({group, activeGroupFilter, toggleChip}: FilterChipProps) {
  const topScore = getDominantScore(group.synergies);
  const tier = getStrengthTier(topScore);
  const isActive = activeGroupFilter === group.groupKey;
  const isInactive = activeGroupFilter !== null && !isActive;
  return (
    <button
      type="button"
      onClick={() => toggleChip(group.groupKey)}
      aria-pressed={isActive}
      title={`${group.synergies.length} cards · top score ${topScore}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 14px',
        background: isActive ? 'rgba(212, 175, 55, 0.12)' : COLORS.surfaceAlt,
        border: `1px solid ${isActive ? COLORS.primary500 : COLORS.surfaceBorder}`,
        borderRadius: 18,
        fontSize: 13,
        color: isInactive ? COLORS.textMuted : COLORS.text,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: isActive ? 600 : 500,
        opacity: isInactive ? 0.55 : 1,
        transition: 'border-color 0.15s, background 0.15s, color 0.15s, opacity 0.15s',
      }}>
      <span style={{lineHeight: 1}}>{group.label}</span>
      <span
        style={{
          padding: '2px 9px',
          borderRadius: 11,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.3,
          background: tier.bg,
          color: tier.color,
        }}>
        {group.synergies.length}
      </span>
    </button>
  );
}

interface HeroDividerProps {
  hasSynergies: boolean;
  inComparison: boolean;
}

function HeroDivider({hasSynergies, inComparison}: HeroDividerProps) {
  // Render whenever there are synergies; let `inComparison` drive an opacity transition that
  // matches the chip-row + info-column fade (250ms ease-out). Splitting the old `visible` boolean
  // (`synergies.length > 0 && !inComparison`) into two props lets us animate the comparison-mode
  // exit instead of unmounting instantly.
  if (!hasSynergies) return null;
  return (
    <hr
      aria-hidden="true"
      style={{
        height: 1,
        border: 'none',
        background: `linear-gradient(90deg, transparent, ${COLORS.primary500} 50%, transparent)`,
        margin: '16px 0 0',
        opacity: inComparison ? 0 : 1,
        transition: 'opacity 250ms ease-out',
      }}
    />
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
}

/**
 * Non-scrolling positioned frame for the modal's body region. Scrolling + padding live in the
 * default-view ScrollArea inside (see MobileOrDesktopBody). Keeping ModalBody itself
 * non-scrolling is what lets the mobile MobileComparisonView — a `position: absolute` overlay
 * anchored here — stay put: an absolute child of a scroll container would scroll out of view.
 */
function ModalBody({children}: ModalBodyProps) {
  return (
    <div style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative'}}>
      {children}
    </div>
  );
}

interface MobileOrDesktopBodyProps extends CardsRowProps {
  setHighlightedCard: (card: 'a' | 'b' | null) => void;
  /** Card A + Card B origin rects — drive the mobile MobileComparisonView entry/exit FLIP. */
  comparisonOrigin: ComparisonOriginRects | null;
}

/**
 * Default-view exit reveal (#332 #5). On exit the default view fades back IN, but DELAYED — the
 * delay must clear MobileComparisonView's chrome fade (`CHROME_EXIT_FADE_MS`, ~200ms) so the
 * comparison layout and the default layout are never both visible. Overlapping them is what
 * produced the cross-layout ghosting; sequencing the fades removes it.
 */
const DEFAULT_VIEW_FADE_MS = 240;
const DEFAULT_VIEW_FADE_DELAY_MS = 200;

/**
 * Default-view ScrollArea reveal style. Hidden (paint-only, no reflow) while a mobile comparison
 * is active; fades back in — DELAYED past the overlay's chrome fade so the two layouts never
 * overlap — during the exit window; plainly visible otherwise.
 */
function pickScrollAreaRevealStyle(args: {
  isMobile: boolean;
  comparisonActive: boolean;
  isExiting: boolean;
}): React.CSSProperties {
  if (args.isMobile && args.comparisonActive) return {visibility: 'hidden', opacity: 0};
  if (args.isExiting) {
    return {
      opacity: 1,
      transition: `opacity ${DEFAULT_VIEW_FADE_MS}ms ease-out ${DEFAULT_VIEW_FADE_DELAY_MS}ms`,
    };
  }
  return {opacity: 1};
}

/**
 * Dispatch between the tabbed {@link MobileComparisonView} (mobile + comparison) and the
 * default CardsRow + ComparisonDetailPanel layout (everything else).
 *
 * Layout stability is the design rule here (#332 #5): the default view lives in a
 * permanently-mounted ScrollArea whose layout NEVER changes when comparison opens/closes, and
 * MobileComparisonView is ALWAYS an absolute overlay on top of it. Entering/exiting comparison
 * only toggles the ScrollArea's `visibility` (paint-only, zero reflow) and fades the overlay —
 * it never repositions anything. That zero-reflow transition is what makes the mobile animation
 * as smooth as desktop, which has always overlaid stable content.
 */
function MobileOrDesktopBody(props: MobileOrDesktopBodyProps) {
  const {isMobile, comparisonPair, exitingPair, comparisonOrigin, setHighlightedCard, ...cardsRowProps} = props;
  const mobilePair = isMobile ? (comparisonPair ?? exitingPair) : null;
  // isExiting: comparisonPair cleared but exitingPair still set → the BACK-press exit window.
  const isExiting = !!mobilePair && !comparisonPair && !!exitingPair;
  const {inComparison} = cardsRowProps;

  // The default view's ScrollArea is permanently mounted with a layout that NEVER changes when
  // comparison opens/closes — `key` keeps it identity-matched so its CardImages never remount.
  // Hiding it is paint-only (`visibility`/`opacity`) so the subtree stays laid out, lazy
  // CardImages still load, and there is zero reflow. See pickScrollAreaRevealStyle.
  const scrollAreaRevealStyle = pickScrollAreaRevealStyle({
    isMobile,
    comparisonActive: !!comparisonPair,
    isExiting,
  });

  const defaultBody = (
    <div
      key="default-body"
      style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflowY: isMobile || inComparison ? 'auto' : 'hidden',
        padding: '20px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...scrollAreaRevealStyle,
      }}>
      <CardsRow
        {...cardsRowProps}
        isMobile={isMobile}
        comparisonPair={comparisonPair}
        exitingPair={exitingPair}
      />
      <ComparisonDetailPanel
        isMobile={isMobile}
        inComparison={inComparison}
        comparisonPair={comparisonPair}
        exitingPair={exitingPair}
        setHighlightedCard={setHighlightedCard}
      />
    </div>
  );

  if (mobilePair) {
    // Comparison: the ScrollArea stays mounted (visibility:hidden while active, visible during
    // exit); MobileComparisonView is an absolute overlay on top throughout — fading in on entry,
    // fading out on exit. Neither transition repositions anything.
    return (
      <>
        {defaultBody}
        <MobileComparisonView
          key="mobile-comparison-view"
          pair={mobilePair}
          engineScore={mobilePair.aggregateScore}
          originRects={comparisonOrigin}
          isExiting={isExiting}
        />
      </>
    );
  }
  return defaultBody;
}

interface CardsRowProps {
  card: LorcanaCard;
  cardWidth: number;
  synergiesLoading: boolean;
  cardHeight: number;
  isMobile: boolean;
  synergies: SynergyGroupData[];
  visibleGroups: SynergyGroupData[];
  activeGroupFilter: string | null;
  comparisonPair: DetailedPairSynergy | null;
  /** Pair held during exit animation (#332 #7). Keeps CompareCardOverlay + PairConnector mounted
   *  for the FLIP_DURATION exit window after `comparisonPair` becomes null. */
  exitingPair: DetailedPairSynergy | null;
  highlightedCard: 'a' | 'b' | null;
  inComparison: boolean;
  compareCardRef: React.RefObject<HTMLDivElement | null>;
  onShowAll: (groupKey: string) => void;
  onCardClick: (card: LorcanaCard, groupKey?: string) => void;
}

function CardsRow(props: CardsRowProps) {
  const {cardHeight, isMobile, comparisonPair, exitingPair, compareCardRef, highlightedCard} = props;
  // During exit (comparisonPair=null, exitingPair set), keep the overlays mounted using
  // the exitingPair's data so the FLIP-back animation has something to animate.
  const effectivePair = comparisonPair ?? exitingPair;
  return (
    <div style={pickCardsRowStyle({isMobile, cardWidth: props.cardWidth, cardHeight})}>
      <CardImageDisplay
        card={props.card}
        cardWidth={props.cardWidth}
        cardHeight={cardHeight}
        isMobile={isMobile}
        highlightedCard={highlightedCard}
        inComparison={props.inComparison}
      />
      <DefaultInfoColumn
        synergies={props.synergies}
        synergiesLoading={props.synergiesLoading}
        visibleGroups={props.visibleGroups}
        activeGroupFilter={props.activeGroupFilter}
        cardHeight={cardHeight}
        isMobile={isMobile}
        inComparison={props.inComparison}
        onShowAll={props.onShowAll}
        onCardClick={props.onCardClick}
      />
      <ComparisonOverlays
        pair={effectivePair}
        isMobile={isMobile}
        isExiting={!comparisonPair && !!exitingPair}
        cardWidth={props.cardWidth}
        cardHeight={cardHeight}
        highlightedCard={highlightedCard}
        compareCardRef={compareCardRef}
      />
    </div>
  );
}

interface PickCardsRowStyleInput {
  isMobile: boolean;
  cardWidth: number;
  cardHeight: number;
}

function pickCardsRowStyle({isMobile, cardWidth, cardHeight}: PickCardsRowStyleInput): React.CSSProperties {
  return {
    display: isMobile ? 'flex' : 'grid',
    flexDirection: isMobile ? 'column' : undefined,
    gridTemplateColumns: isMobile ? undefined : `${cardWidth}px 1fr`,
    gap: 28,
    alignItems: 'stretch',
    height: isMobile ? undefined : cardHeight,
    flexShrink: 0,
    overflow: 'visible',
    position: 'relative',
  };
}

interface ComparisonOverlaysProps {
  pair: DetailedPairSynergy | null;
  isMobile: boolean;
  isExiting: boolean;
  cardWidth: number;
  cardHeight: number;
  highlightedCard: 'a' | 'b' | null;
  compareCardRef: React.RefObject<HTMLDivElement | null>;
}

/** Compare-card overlay + pair-connector, gated on having a pair and not being mobile. */
function ComparisonOverlays({pair, isMobile, isExiting, cardWidth, cardHeight, highlightedCard, compareCardRef}: ComparisonOverlaysProps) {
  if (!pair || isMobile) return null;
  return (
    <>
      <CompareCardOverlay
        pair={pair}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        highlightedCard={highlightedCard}
        compareCardRef={compareCardRef}
      />
      <PairConnector cardHeight={cardHeight} exiting={isExiting} />
    </>
  );
}

interface CardImageDisplayProps {
  card: LorcanaCard;
  cardWidth: number;
  cardHeight: number;
  isMobile: boolean;
  highlightedCard: 'a' | 'b' | null;
  inComparison: boolean;
}

function CardImageDisplay({card, cardWidth, cardHeight, isMobile, highlightedCard, inComparison}: CardImageDisplayProps) {
  // In comparison mode the wrapper takes the ambient `focused-card-glow` className
  // (#332 #6 idea D). The animation cycles `box-shadow` between a low and high gold-tinted
  // aura around the card. Setting borderRadius=14 on the wrapper makes the shadow follow
  // the card's rounded corners instead of drawing against a rectangular bounding box.
  const useGlow = !isMobile && inComparison;
  return (
    <div
      className={useGlow ? 'focused-card-glow' : undefined}
      style={pickCardWrapperStyle({isMobile, highlightedCard, inComparison})}>
      {/* Shrink-wrap span carrying the `data-comparison-card-a` marker — its rect is exactly
          the card image (not the full-width flex wrapper), so the click handler captures the
          correct FLIP origin for Card A's mobile comparison transition (#332 #5). */}
      <span data-comparison-card-a style={{display: 'inline-block', lineHeight: 0}}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={cardWidth}
          height={cardHeight}
          inkColor={card.ink}
          cost={card.cost}
          borderRadius={14}
          // No style override: CardImage's root container already sets
          // width/height in pixels, which reserves space before the image
          // loads. The previous `style={{height:'auto'}}` collapsed that
          // reservation and produced CLS=0.13 on /card/957 (lighthouserc
          // threshold 0.1) — see commit 8fbe93c.
          priority
          lazy={false}
        />
      </span>
    </div>
  );
}

function pickCardWrapperStyle({isMobile, highlightedCard, inComparison}: {isMobile: boolean; highlightedCard: 'a' | 'b' | null; inComparison: boolean}): React.CSSProperties {
  // In comparison mode, pull Card A inward so its right edge touches the
  // PairConnector's left edge. Match the FLIP timing on Card B so both
  // cards slide into position together.
  const inset = !isMobile && inComparison ? COMPARISON_CARD_INSET : 0;
  return {
    display: 'flex',
    justifyContent: isMobile ? 'center' : 'flex-start',
    alignItems: 'flex-start',
    flexShrink: 0,
    transform: inset ? `translateX(${inset}px)` : undefined,
    transition: `opacity 0.2s ease, filter 0.2s ease, transform ${FLIP_DURATION}ms ${FLIP_EASING}`,
    opacity: highlightedCard === 'b' ? 0.4 : 1,
    filter: highlightedCard === 'a' ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))' : undefined,
    // borderRadius matches CardImage's so the ambient glow's box-shadow follows the rounded
    // card silhouette instead of a rectangular bounding box. Only applied in comparison mode
    // (when the glow class is also active); default state stays as-is.
    borderRadius: inset ? 14 : undefined,
  };
}

interface DefaultInfoColumnProps {
  synergies: SynergyGroupData[];
  synergiesLoading: boolean;
  visibleGroups: SynergyGroupData[];
  activeGroupFilter: string | null;
  cardHeight: number;
  isMobile: boolean;
  inComparison: boolean;
  onShowAll: (groupKey: string) => void;
  onCardClick: (card: LorcanaCard, groupKey?: string) => void;
}

function DefaultInfoColumn({synergies, synergiesLoading, visibleGroups, activeGroupFilter, cardHeight, isMobile, inComparison, onShowAll, onCardClick}: DefaultInfoColumnProps) {
  return (
    <section
      aria-label="Synergies"
      // `inert` removes the synergy tile buttons from focus order + a11y tree during comparison
      // mode — opacity:0 + pointer-events:none would still leave them tab-reachable.
      inert={inComparison}
      style={{
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        maxHeight: isMobile ? undefined : cardHeight,
        overflowY: isMobile ? 'visible' : 'auto',
        padding: isMobile ? 0 : '0 14px',
        opacity: inComparison ? 0 : 1,
        pointerEvents: inComparison ? 'none' : 'auto',
        transition: 'opacity 250ms ease-out',
      }}>
      {/* Visually-hidden heading bridges the heading order: modal h1 (card name) → h2 here →
          h3 from each SynergyGroup. Without this, axe flags `heading-order` because the page
          jumps h1 → h3 directly. */}
      <h2 style={SR_ONLY_STYLE}>Synergies</h2>
      {synergiesLoading ? (
        <SynergiesLoadingSkeleton />
      ) : synergies.length === 0 ? (
        <SynergiesEmptyState />
      ) : (
        visibleGroups.map((group) => (
          <SynergyGroup
            key={group.groupKey}
            group={group}
            isMobile={isMobile}
            maxVisibleCards={activeGroupFilter ? 11 : 3}
            gridColumns={4}
            gridGap={8}
            marginBottom={0}
            showCardCount={false}
            compact
            onShowAll={onShowAll}
            onCardClick={onCardClick}
          />
        ))
      )}
    </section>
  );
}

/**
 * Right-column placeholder shown while the per-card synergy JSON is in flight
 * (usePrecomputedSynergies.isLoading === true). Mirrors the post-load layout:
 * 2 group sections, each with a small label rect + 2-line description rect +
 * 3-tile mini-card grid. Without this, slow connections (3G + Set 12-sized
 * synergy files) made the modal show "No synergies yet" during load — which
 * read as a true empty state and disappeared once data arrived. The skeleton
 * makes the loading transition obvious instead of misleading.
 */
function SynergiesLoadingSkeleton() {
  return (
    <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
      <div
        data-testid="card-overview-loading"
        aria-busy="true"
        aria-label="Loading synergies"
        style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        {Array.from({length: 2}).map((_, groupIdx) => (
          <div key={groupIdx} style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {/* Label tag */}
            <Skeleton width={92} height={20} borderRadius={2} />
            {/* Cream callout description (2 lines suggested) */}
            <Skeleton height={36} borderRadius={4} />
            {/* Mini-card tile grid — matches modal's gridColumns={4}, 3 visible per group */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginTop: 4,
              }}>
              {Array.from({length: 3}).map((_, tileIdx) => (
                <Skeleton key={tileIdx} height={170} borderRadius={5} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

function SynergiesEmptyState() {
  return (
    <div
      data-testid="card-overview-empty"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        gap: 8,
      }}>
      <p style={{margin: 0, color: COLORS.text, fontSize: 14, fontWeight: 600}}>No synergies yet</p>
      <p style={{margin: 0, color: COLORS.textMuted, fontSize: 12, lineHeight: 1.5, maxWidth: 280}}>
        This card may match new rules as the engine evolves.
      </p>
    </div>
  );
}

interface CompareCardOverlayProps {
  pair: DetailedPairSynergy;
  cardWidth: number;
  cardHeight: number;
  highlightedCard: 'a' | 'b' | null;
  compareCardRef: React.RefObject<HTMLDivElement | null>;
}

function CompareCardOverlay({pair, cardWidth, cardHeight, highlightedCard, compareCardRef}: CompareCardOverlayProps) {
  return (
    <div
      ref={compareCardRef}
      aria-hidden="true"
      // `focused-card-glow focused-card-glow-offset` adds the ambient breathing animation
      // (#332 #6 idea D) phased opposite to Card A — when A's glow peaks, B is at its
      // minimum and vice versa. The keyframe bakes in the same 0 8px 24px depth shadow
      // that was previously inline, plus the breathing aura. Reduced-motion override in
      // index.css disables the animation; the previous static shadow is then absent —
      // documented as acceptable since the cards still have CardImage's inner styling.
      className="focused-card-glow focused-card-glow-offset"
      style={{
        position: 'absolute',
        top: 0,
        // Pull Card B inward to touch the PairConnector's right edge.
        // Symmetric with Card A's translateX in pickCardWrapperStyle.
        right: COMPARISON_CARD_INSET,
        width: cardWidth,
        height: cardHeight,
        borderRadius: 14,
        overflow: 'hidden',
        background: COLORS.background,
        transformOrigin: 'top left',
        zIndex: 5,
        // Only set opacity inline when actively dimming via hover. Default case is `undefined`
        // so React doesn't manage the property — that way the exit FLIP's `el.style.opacity = '0'`
        // (#332 #7) persists across re-renders during the 480ms exit window.
        opacity: highlightedCard === 'a' ? 0.4 : undefined,
        filter: highlightedCard === 'b' ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))' : undefined,
        transition: 'opacity 0.2s ease, filter 0.2s ease',
      }}>
      {pair.cardB.imageUrl && (
        <img
          src={pair.cardB.imageUrl}
          alt={pair.cardB.fullName}
          style={{width: '100%', height: '100%', display: 'block', objectFit: 'cover'}}
        />
      )}
    </div>
  );
}

interface ComparisonDetailPanelProps {
  isMobile: boolean;
  inComparison: boolean;
  comparisonPair: DetailedPairSynergy | null;
  /** Held during the 480ms exit window so the inner content stays mounted while the grid row
   *  collapses (#332 #7). Without this, the inner `{comparisonPair && ...}` would unmount the
   *  EngineColumn + CommunityColumn instantly on BACK, leaving the row to collapse around
   *  empty space — which reads as a "pop" instead of a smooth shrink. */
  exitingPair: DetailedPairSynergy | null;
  setHighlightedCard: (card: 'a' | 'b' | null) => void;
}

function ComparisonDetailPanel({isMobile, inComparison, comparisonPair, exitingPair, setHighlightedCard}: ComparisonDetailPanelProps) {
  // grid-template-rows: 0fr ↔ 1fr is the canonical "height: auto" transition. The interpolation
  // covers the panel's *actual* content height (~280px when populated) instead of a synthetic
  // 0 → 1500 max-height range that finished visibly in ~96ms with the cubic-bezier easing. This
  // way the 480ms duration maps to real visible motion across the whole transition.
  // Same pattern MultiRoleAbilityList uses in ConnectionGroup.tsx.
  //
  // effectivePair: keep content mounted during exit. comparisonPair drives entry mounting +
  // open/close state via inComparison; exitingPair keeps the content rendered through the
  // 480ms collapse so the row shrinks around real content (mirrors the expand path).
  const effectivePair = comparisonPair ?? exitingPair;
  return (
    <div
      aria-hidden={!inComparison}
      style={{
        display: 'grid',
        gridTemplateRows: inComparison ? '1fr' : '0fr',
        opacity: inComparison ? 1 : 0,
        flexShrink: 0,
        transition: 'grid-template-rows 480ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 300ms ease-out 250ms',
      }}>
      {/* Inner wrapper holds the actual content. `min-height: 0` lets the grid row collapse
          below content height during the transition; `overflow: hidden` clips so partial content
          doesn't bleed out of the collapsing/expanding bounds. */}
      <div style={{minHeight: 0, overflow: 'hidden'}}>
        {effectivePair && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 20,
              // `stretch` makes both columns fill the row's height (= max of their intrinsic heights).
              // Mobile collapses to single column so the alignment is moot, but `stretch` is still the harmless default.
              alignItems: 'stretch',
            }}>
            <EngineColumn
              pair={effectivePair}
              engineScore={effectivePair.aggregateScore}
              onHighlight={setHighlightedCard}
            />
            <CommunityColumn pair={effectivePair} engineScore={effectivePair.aggregateScore} />
          </div>
        )}
      </div>
    </div>
  );
}

interface PairConnectorProps {
  cardHeight: number;
  /** When true, play the reverse-draw exit animation (clip-path collapses from inset(0) back to
   *  inset(0 50% 0 50%); wrapper fades out). #332 #7 exit choreography. */
  exiting: boolean;
}

/**
 * Pair connector — single gold dashed line between the two cards (mockup phase 2).
 *
 * Entry: The line spans the full info-col gap and reveals from center outward (clip-path
 * inset(0 50% 0 50%) → inset(0)) over 1s with a 200ms delay.
 *
 * Exit (#332 #7): wrapper fades out (200ms), line collapses centre-in (clip-path back to
 * inset(0 50% 0 50%)) over 480ms. Faster than entry's narrative 1000ms reveal — exit doesn't
 * need the dramatic buildup since the user already understands the pair.
 */
function PairConnector({cardHeight, exiting}: PairConnectorProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: cardHeight / 2,
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 192,
        zIndex: 6,
        animation: exiting
          ? 'card-overview-connector-out 200ms ease-out forwards'
          : 'card-overview-connector-in 250ms ease-out 200ms both',
      }}>
      <span
        style={{
          display: 'block',
          width: '100%',
          height: 2,
          backgroundImage: `repeating-linear-gradient(to right, ${COLORS.primary500} 0, ${COLORS.primary500} 6px, transparent 6px, transparent 12px)`,
          backgroundSize: '12px 2px',
          opacity: 0.7,
          animation: exiting
            ? 'card-overview-connector-line-collapse 480ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
            : 'card-overview-connector-line-center 1000ms cubic-bezier(0.2, 0.8, 0.2, 1) 200ms both',
        }}
      />
    </div>
  );
}

/**
 * Close (×) button — circular, gold-accent on hover.
 * Matches mockup `.close-btn:hover { color: var(--text); border-color: var(--muted); background: var(--surface-alt) }`.
 */
function CloseButton({onClose}: {onClose: () => void}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        padding: 0,
        borderRadius: '50%',
        background: hovered ? COLORS.surfaceAlt : 'transparent',
        border: `1px solid ${hovered ? COLORS.textMuted : COLORS.surfaceBorder}`,
        color: hovered ? COLORS.text : COLORS.textMuted,
        fontSize: 18,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'Arial, sans-serif',
        transition: 'color 0.15s ease, border-color 0.15s ease, background 0.15s ease',
      }}>
      ×
    </button>
  );
}

/**
 * BACK button (focused-state nav) — gold-bordered chip.
 * Matches mockup `.compare-back:hover { background: rgba(212,175,55,0.2); color: var(--gold-bright) }`.
 */
function BackButton({onClick}: {onClick: () => void}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label="Back to synergies"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: hovered ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.1)',
        border: `1px solid ${COLORS.primary500}`,
        color: hovered ? COLORS.primary : COLORS.primary500,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        padding: '7px 14px',
        borderRadius: 18,
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        flexShrink: 0,
        transition: 'background 0.15s ease, color 0.15s ease',
      }}>
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
