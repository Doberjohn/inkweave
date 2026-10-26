import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONTS, INK_COLORS, VISUALLY_HIDDEN} from '../../../shared/constants';
import {usePairScore} from '../../voting/hooks/usePairScore';
import {formatScore} from '../../../shared/utils/scoreFormatting';
import {prefersReducedMotion} from 'inkweave-ui/utils/prefersReducedMotion';
import {useScrollSnapIndex} from '../../../shared/hooks';
import {EngineColumn} from './EngineColumn';
import {CommunityColumn} from './CommunityColumn';
import {ComparisonCardTile} from './ComparisonCardTile';
import {MobileLightbox} from './MobileLightbox';
import {ScoreChevronsTab} from './ScoreChevronsTab';

type TabName = 'engine' | 'community';
/** The tabs in strip order: each is one full-width panel of the scroll-snap strip. */
const TABS: readonly TabName[] = ['engine', 'community'];

/** FLIP timings for the comparison entry/exit. Exit is shorter than the modal's 480ms
 *  `exitingPair` unmount window so the card lands before the view is torn down. */
const ENTRY_FLIP_MS = 420;
const EXIT_FLIP_MS = 360;
const FLIP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const CONTENT_FADE_MS = 260;
/**
 * Exit choreography (#332 #5). A uniform whole-overlay crossfade ghosted the comparison chrome
 * over the default view underneath. Instead, each piece exits by its relationship to that view:
 *  - Chrome (glow orbs, tab bar, panels) has no counterpart there — fade it out fast.
 *  - The cards DO have counterparts (the big image + the synergy tile), so they stay opaque
 *    through the FLIP — the travel home is visible — then a short delayed tail-fade hands them
 *    off to the real cards showing through underneath.
 */
const CHROME_EXIT_FADE_MS = 200;
const CARDS_TAIL_FADE_MS = 140;
const CARDS_TAIL_FADE_DELAY_MS = 300;

/** Translate + uniform-scale deltas to FLIP a card between an origin rect and its slot. */
function flipDeltas(origin: DOMRect, dest: DOMRect): {dx: number; dy: number; scale: number} {
  return {
    dx: origin.left - dest.left,
    dy: origin.top - dest.top,
    scale: origin.width / dest.width,
  };
}

/**
 * FLIP-runner for one card tile. `entry` keyframes go origin→slot; `exit` go slot→origin.
 * Returns the Animation handle (for cancel-on-cleanup) or null when the FLIP is skipped
 * (no element, no origin rect, reduced motion, or a zero-size measurement).
 */
function runCardFlip(
  el: HTMLElement | null,
  origin: DOMRect | null | undefined,
  mode: 'entry' | 'exit',
): Animation | null {
  if (!el || !origin || prefersReducedMotion()) return null;
  const dest = el.getBoundingClientRect();
  if (dest.width === 0) return null;
  const {dx, dy, scale} = flipDeltas(origin, dest);
  el.style.transformOrigin = 'top left';
  const atOrigin = {transform: `translate(${dx}px, ${dy}px) scale(${scale})`};
  const atSlot = {transform: 'translate(0px, 0px) scale(1)'};
  return el.animate(
    mode === 'entry' ? [atOrigin, atSlot] : [atSlot, atOrigin],
    {
      duration: mode === 'entry' ? ENTRY_FLIP_MS : EXIT_FLIP_MS,
      easing: FLIP_EASING,
      // exit: hold at the origin rect until the parent unmounts the view.
      ...(mode === 'exit' ? {fill: 'forwards' as const} : {}),
    },
  );
}

/** Origin rects for the entry/exit FLIP — Card A's big-image rect + Card B's synergy-tile rect. */
export interface ComparisonOriginRects {
  cardA: DOMRect | null;
  cardB: DOMRect | null;
}

interface MobileComparisonViewProps {
  pair: DetailedPairSynergy;
  engineScore: number;
  /**
   * Card A + Card B origin rects (captured at click time). Both card tiles FLIP FROM these
   * rects into their side-by-side slots on entry, and back TO them on exit. Card A shrinks
   * (big image → small tile); Card B grows (synergy mini-tile → tile). Null skips the FLIP.
   */
  originRects?: ComparisonOriginRects | null;
  /**
   * True during the BACK-press exit window — `comparisonPair` cleared but the parent keeps this
   * view mounted via `exitingPair`. Triggers the reverse FLIP + choreographed fade-out.
   */
  isExiting?: boolean;
}

/** Cancel an in-flight FLIP animation if one is present. */
function cancelAnim(anim: Animation | null): void {
  if (anim) anim.cancel();
}

/** The card backing the open lightbox preview, or null when no preview is open. */
function pickPreviewCard(
  preview: PreviewState | null,
  cardA: LorcanaCard,
  cardB: LorcanaCard,
): LorcanaCard | null {
  if (!preview) return null;
  return preview.which === 'a' ? cardA : cardB;
}

/**
 * Owns the entry + exit FLIP for both card tiles, plus their refs. Entry: the cards converge on
 * their side-by-side slots. Exit (`isExiting`): they reverse to their origin rects. Each effect
 * cancels the prior in-flight animation so StrictMode's double-invoke can't stack competing
 * transforms.
 */
function useComparisonFlip(originRects: ComparisonOriginRects | null, isExiting: boolean) {
  const cardARef = useRef<HTMLButtonElement>(null);
  const cardBRef = useRef<HTMLButtonElement>(null);
  const flipA = useRef<Animation | null>(null);
  const flipB = useRef<Animation | null>(null);
  const rectA = originRects ? originRects.cardA : null;
  const rectB = originRects ? originRects.cardB : null;

  useLayoutEffect(() => {
    flipA.current = runCardFlip(cardARef.current, rectA, 'entry');
    flipB.current = runCardFlip(cardBRef.current, rectB, 'entry');
    const a = flipA.current;
    const b = flipB.current;
    return () => {
      cancelAnim(a);
      cancelAnim(b);
    };
  }, [rectA, rectB]);

  useEffect(() => {
    if (!isExiting) return;
    cancelAnim(flipA.current);
    cancelAnim(flipB.current);
    flipA.current = runCardFlip(cardARef.current, rectA, 'exit');
    flipB.current = runCardFlip(cardBRef.current, rectB, 'exit');
    const a = flipA.current;
    const b = flipB.current;
    return () => {
      cancelAnim(a);
      cancelAnim(b);
    };
  }, [isExiting, rectA, rectB]);

  return {cardARef, cardBRef};
}

/** Entry fade-in driver: false on mount, flips true after the first frame. */
function useRevealedAfterMount(): boolean {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return revealed;
}

/**
 * Mobile comparison view — replaces the desktop two-column layout with a tabbed swipe-deck
 * (#332 #5). Top: cards side-by-side with cost/ink/magnify overlays. Middle: Score Chevrons
 * tab pills carrying the title + big score number. Bottom: horizontal scroll-snap strip with
 * the engine + community panels.
 *
 * Tabs are an *indicator* over the scroll position, not a switch — tap a pill OR swipe the
 * strip; both paths converge on the same active-tab state (useScrollSnapIndex, which scrolls
 * only the strip, never the modal or the page around it). Tapping a card opens a lightbox
 * inside the modal (NOT a portal-to-body) so the modal frame stays visible.
 *
 * Sister components: {@link ComparisonCardTile}, {@link ScoreChevronsTab}, {@link MobileLightbox},
 * {@link DeltaPanel}, and the `compact` mode on {@link EngineColumn} + {@link CommunityColumn}.
 */
interface PreviewState {
  which: 'a' | 'b';
  /** Rect of the tapped tile — drives the lightbox's FLIP reveal. */
  originRect: DOMRect;
}

export function MobileComparisonView({pair, engineScore, originRects = null, isExiting = false}: MobileComparisonViewProps) {
  const {cardA, cardB} = pair;
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const {cardARef, cardBRef} = useComparisonFlip(originRects, isExiting);
  const {viewportRef, activeIndex, scrollToIndex} = useScrollSnapIndex();
  const activeTab = TABS[activeIndex];
  const scrollToTab = (name: TabName) => scrollToIndex(TABS.indexOf(name));
  const revealed = useRevealedAfterMount();

  // pair-score is shared with CommunityColumn's call via the module-level cache — duplicate
  // calls dedupe. The Community tab pill shows this score (or `—` when below threshold).
  const {score} = usePairScore(cardA.id, cardB.id);
  const communityScore = score && (score.score_votes ?? 0) >= 5 ? Number(score.avg_score) : null;

  // Root fades IN on mount; it does NOT fade out as a whole on exit (that uniform crossfade
  // ghosted the chrome over the default view). Exit is choreographed per-element below.
  const rootOpacity = revealed ? 1 : 0;
  // Chrome (glow orbs, tab bar, panels) fades out fast — nothing in the default view replaces it.
  const chromeExitStyle: React.CSSProperties = {
    opacity: isExiting ? 0 : 1,
    transition: `opacity ${CHROME_EXIT_FADE_MS}ms ${EASING.smooth}`,
  };
  // Cards stay fully opaque through the FLIP, then a short delayed tail-fade dissolves them
  // into the real cards showing through underneath.
  const cardsExitStyle: React.CSSProperties = isExiting
    ? {opacity: 0, transition: `opacity ${CARDS_TAIL_FADE_MS}ms ${EASING.smooth} ${CARDS_TAIL_FADE_DELAY_MS}ms`}
    : {opacity: 1};

  const onCardTap = (which: 'a' | 'b', tileEl: HTMLElement) => {
    setPreview({which, originRect: tileEl.getBoundingClientRect()});
  };

  const previewCard = pickPreviewCard(preview, cardA, cardB);

  return (
    <div
      style={{
        ...ROOT_STYLE,
        opacity: rootOpacity,
        transition: `opacity ${CONTENT_FADE_MS}ms ${EASING.smooth}`,
      }}>
      <GlowOrbs style={chromeExitStyle} />

      <div style={CONTENT_STYLE}>
        <CardsRow cardA={cardA} cardB={cardB} cardARef={cardARef} cardBRef={cardBRef} onCardTap={onCardTap} style={cardsExitStyle} />
        {/* Between the card's h1 and the panels' headings, so they step down one level at a time. */}
        <h2 style={VISUALLY_HIDDEN}>Synergy scores</h2>
        <TabBar activeTab={activeTab} onChange={scrollToTab} engineScore={engineScore} communityScore={communityScore} style={chromeExitStyle} />

        <div ref={viewportRef} role="presentation" style={{...VIEWPORT_STYLE, ...chromeExitStyle}} className="mobile-tab-viewport">
          <div style={PANEL_STRIP_STYLE}>
            <div style={PANEL_WRAP_STYLE} className="mobile-tab-panel-wrap">
              <EngineColumn pair={pair} engineScore={engineScore} compact />
            </div>
            <div style={PANEL_WRAP_STYLE} className="mobile-tab-panel-wrap">
              <CommunityColumn pair={pair} engineScore={engineScore} compact />
            </div>
          </div>
        </div>
      </div>

      {previewCard && previewCard.imageUrl && preview && (
        <MobileLightbox
          imageUrl={previewCard.imageUrl}
          alt={previewCard.fullName}
          ink={previewCard.ink}
          originRect={preview.originRect}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// ── GlowOrbs ──

function GlowOrbs({style}: {style?: React.CSSProperties}) {
  return (
    <div aria-hidden="true" style={{...GLOW_ORBS_STYLE, ...style}}>
      <span style={{...ORB_BASE, width: 220, height: 220, background: INK_COLORS.Amethyst.border, top: '8%', left: '-12%'}} />
      <span style={{...ORB_BASE, width: 260, height: 260, background: INK_COLORS.Sapphire.border, bottom: '12%', right: '-18%'}} />
      <span style={{...ORB_BASE, width: 180, height: 180, background: INK_COLORS.Emerald.border, top: '48%', left: '55%'}} />
    </div>
  );
}

// ── Cards row ──

interface CardsRowProps {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  /** Refs forwarded to each card's tile button — the entry/exit FLIP animates these elements. */
  cardARef: React.RefObject<HTMLButtonElement | null>;
  cardBRef: React.RefObject<HTMLButtonElement | null>;
  onCardTap: (which: 'a' | 'b', tileEl: HTMLElement) => void;
  /** Exit tail-fade style — merged onto the row so the cards hand off to the default view. */
  style?: React.CSSProperties;
}

function CardsRow({cardA, cardB, cardARef, cardBRef, onCardTap, style}: CardsRowProps) {
  return (
    <div style={{...CARDS_ROW_STYLE, ...style}}>
      <ComparisonCardTile card={cardA} which="a" onTap={onCardTap} tileRef={cardARef} />
      <PairConnectorSvg />
      <ComparisonCardTile card={cardB} which="b" onTap={onCardTap} tileRef={cardBRef} />
    </div>
  );
}

function PairConnectorSvg() {
  return (
    <span aria-hidden="true" style={PAIR_CONNECTOR_STYLE}>
      <svg width="34" height="14" viewBox="0 0 34 14" fill="none">
        <line x1="2" y1="7" x2="32" y2="7" stroke={COLORS.primary} strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx="17" cy="7" r="3" fill={COLORS.background} stroke={COLORS.primary} strokeWidth={1.2} />
        <circle cx="17" cy="7" r="1.2" fill={COLORS.primary} />
      </svg>
    </span>
  );
}

// ── Tab bar (Score Chevrons) ──

interface TabBarProps {
  activeTab: TabName;
  onChange: (name: TabName) => void;
  engineScore: number;
  communityScore: number | null;
  /** Exit fade style — merged onto the tab bar (chrome with no default-view counterpart). */
  style?: React.CSSProperties;
}

function TabBar({activeTab, onChange, engineScore, communityScore, style}: TabBarProps) {
  return (
    <div style={{...TAB_BAR_STYLE, ...style}}>
      <ScoreChevronsTab
        label="Engine"
        score={formatScore(engineScore)}
        showScale
        isActive={activeTab === 'engine'}
        tint={COLORS.primary}
        onClick={() => onChange('engine')}
      />
      <ScoreChevronsTab
        label="Community"
        score={communityScore != null ? formatScore(communityScore) : '—'}
        showScale={communityScore != null}
        isActive={activeTab === 'community'}
        tint={INK_COLORS.Amethyst.text}
        onClick={() => onChange('community')}
      />
    </div>
  );
}

// ── Styles ──

/**
 * Root style. MobileComparisonView is ALWAYS an absolute overlay (#332 #5) filling the modal
 * body — entering/exiting comparison never changes the layout, only fades this overlay in/out.
 * ModalBody carries no padding, so `inset: 0` covers the body region edge-to-edge.
 */
const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontFamily: FONTS.body,
  position: 'absolute',
  inset: 0,
  zIndex: 2,
};

const CONTENT_STYLE: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const GLOW_ORBS_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  zIndex: 0,
};

const ORB_BASE: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(80px)',
  // The orbs shine through the see-through tabs and panels, and on short phones they sit right
  // behind text: at 0.35 they took labels down to 3.3:1, where 0.15 keeps every one at 4.5:1 or
  // more (WCAG 1.4.3).
  opacity: 0.15,
};

const CARDS_ROW_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  margin: '0 16px',
  flexShrink: 0,
  // No `contain: paint` here — it clips painting to the row box, which amputates the
  // entry/exit FLIP (the cards scale ~1.6x beyond the row while animating).
};

const PAIR_CONNECTOR_STYLE: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
};

const TAB_BAR_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  margin: '0 16px',
  flexShrink: 0,
};

const VIEWPORT_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollSnapType: 'x mandatory',
  scrollbarWidth: 'none',
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
};

const PANEL_STRIP_STYLE: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  willChange: 'transform',
};

const PANEL_WRAP_STYLE: React.CSSProperties = {
  flex: '0 0 100%',
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
  overflowY: 'auto',
  padding: '0 16px 24px',
  scrollbarWidth: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};
