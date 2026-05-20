import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {DetailedPairSynergy, Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS} from '../../../shared/constants';
import {usePairScore} from '../../voting/hooks/usePairScore';
import {formatScore} from '../../../shared/utils/scoreFormatting';
import {EngineColumn} from './EngineColumn';
import {CommunityColumn} from './CommunityColumn';
import {MobileLightbox} from './MobileLightbox';

type TabName = 'engine' | 'community';

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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

/**
 * Mobile comparison view — replaces the desktop two-column layout with a tabbed swipe-deck
 * (#332 #5). Top: cards side-by-side with cost/ink/magnify overlays. Middle: Score Chevrons
 * tab pills carrying the title + big score number. Bottom: horizontal scroll-snap strip with
 * the engine + community panels.
 *
 * Tabs are an *indicator* over the scroll position, not a switch — tap a pill OR swipe the
 * strip; both paths converge on the same active-tab state. Tapping a card opens a lightbox
 * inside the modal (NOT a portal-to-body) so the modal frame stays visible.
 *
 * Sister components: {@link MobileLightbox}, {@link DeltaPanel}, and the `compact` mode on
 * {@link EngineColumn} + {@link CommunityColumn}.
 */
interface PreviewState {
  which: 'a' | 'b';
  /** Rect of the tapped tile — drives the lightbox's FLIP reveal. */
  originRect: DOMRect;
}

export function MobileComparisonView({pair, engineScore, originRects = null, isExiting = false}: MobileComparisonViewProps) {
  const {cardA, cardB} = pair;
  const [activeTab, setActiveTab] = useState<TabName>('engine');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardARef = useRef<HTMLButtonElement>(null);
  const cardBRef = useRef<HTMLButtonElement>(null);
  // One in-flight FLIP animation per card. Cancelled before a new one starts so two animations
  // never compete on `transform` (the StrictMode double-invoke / fast-reverse hazard).
  const flipA = useRef<Animation | null>(null);
  const flipB = useRef<Animation | null>(null);

  // The pair-score hook is shared with CommunityColumn's call via the module-level cache —
  // duplicate calls dedupe, no extra fetches. We need the score here too so the Community
  // tab pill can show a numeric score (or `—` when below threshold).
  const {score} = usePairScore(cardA.id, cardB.id);
  const communityScore = score && score.score_votes >= 5 ? Number(score.avg_score) : null;

  // Entry FLIP — BOTH cards converge on their side-by-side slots: Card A shrinks from its big
  // default-view image, Card B grows from the tapped synergy tile. The cleanup cancel() keeps
  // StrictMode's double-invoke from stacking competing transform animations.
  useLayoutEffect(() => {
    flipA.current = runCardFlip(cardARef.current, originRects?.cardA, 'entry');
    flipB.current = runCardFlip(cardBRef.current, originRects?.cardB, 'entry');
    const a = flipA.current;
    const b = flipB.current;
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, [originRects]);

  // Exit FLIP — on BACK, both cards reverse: Card A grows back to its big image, Card B shrinks
  // back to the synergy tile. `fill: forwards` holds each at its origin until the parent unmounts
  // the view. As the overlay fades, each card dissolves into the real element underneath.
  useEffect(() => {
    if (!isExiting) return;
    flipA.current?.cancel();
    flipB.current?.cancel();
    flipA.current = runCardFlip(cardARef.current, originRects?.cardA, 'exit');
    flipB.current = runCardFlip(cardBRef.current, originRects?.cardB, 'exit');
    const a = flipA.current;
    const b = flipB.current;
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, [isExiting, originRects]);

  // Root fades IN on mount (entry). It does NOT fade out as a whole on exit — that uniform
  // crossfade ghosted the comparison chrome over the default view underneath. Exit is
  // choreographed per-element via chromeExitStyle / cardsExitStyle below.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const rootOpacity = revealed ? 1 : 0;

  // Chrome (glow orbs, tab bar, panels) fades out fast — nothing in the default view replaces it.
  const chromeExitStyle: React.CSSProperties = {
    opacity: isExiting ? 0 : 1,
    transition: `opacity ${CHROME_EXIT_FADE_MS}ms ease-out`,
  };
  // The cards stay fully opaque so the FLIP back home reads as real travel; once it has mostly
  // landed (delay), a short tail-fade dissolves them into the real cards showing through.
  const cardsExitStyle: React.CSSProperties = isExiting
    ? {opacity: 0, transition: `opacity ${CARDS_TAIL_FADE_MS}ms ease-out ${CARDS_TAIL_FADE_DELAY_MS}ms`}
    : {opacity: 1};

  // Tab indicator follows scroll position. Update only when the active tab actually changes
  // so React bails out for in-progress swipes that don't cross the midpoint.
  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    let last: TabName | null = null;
    const update = () => {
      const cw = root.clientWidth;
      if (!cw) return;
      const next: TabName = root.scrollLeft > cw / 2 ? 'community' : 'engine';
      if (next !== last) {
        last = next;
        setActiveTab(next);
      }
    };
    update();
    root.addEventListener('scroll', update, {passive: true});
    return () => root.removeEventListener('scroll', update);
  }, []);

  const scrollToTab = useCallback((name: TabName) => {
    const root = viewportRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLDivElement>(`[data-panel="${name}"]`);
    if (!target) return;
    setActiveTab(name); // optimistic — observer confirms once the smooth-scroll lands
    target.scrollIntoView({behavior: 'smooth', inline: 'start', block: 'nearest'});
  }, []);

  const onCardTap = useCallback((which: 'a' | 'b', tileEl: HTMLElement) => {
    setPreview({which, originRect: tileEl.getBoundingClientRect()});
  }, []);

  const previewCard = preview?.which === 'a' ? cardA : preview?.which === 'b' ? cardB : null;

  return (
    <div
      style={{
        ...ROOT_STYLE,
        opacity: rootOpacity,
        transition: `opacity ${CONTENT_FADE_MS}ms ease-out`,
      }}>
      <GlowOrbs style={chromeExitStyle} />

      <div style={CONTENT_STYLE}>
        <CardsRow cardA={cardA} cardB={cardB} cardARef={cardARef} cardBRef={cardBRef} onCardTap={onCardTap} style={cardsExitStyle} />
        <TabBar activeTab={activeTab} onChange={scrollToTab} engineScore={engineScore} communityScore={communityScore} style={chromeExitStyle} />

        <div ref={viewportRef} role="presentation" style={{...VIEWPORT_STYLE, ...chromeExitStyle}} className="mobile-tab-viewport">
          <div style={PANEL_STRIP_STYLE}>
            <div data-panel="engine" style={PANEL_WRAP_STYLE} className="mobile-tab-panel-wrap">
              <EngineColumn pair={pair} engineScore={engineScore} compact />
            </div>
            <div data-panel="community" style={PANEL_WRAP_STYLE} className="mobile-tab-panel-wrap">
              <CommunityColumn pair={pair} engineScore={engineScore} compact />
            </div>
          </div>
        </div>
      </div>

      {previewCard && preview && (
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
      <span style={{...ORB_BASE, width: 220, height: 220, background: '#8b5cf6', top: '8%', left: '-12%'}} />
      <span style={{...ORB_BASE, width: 260, height: 260, background: '#3b82f6', bottom: '12%', right: '-18%'}} />
      <span style={{...ORB_BASE, width: 180, height: 180, background: '#14b8a6', top: '48%', left: '55%'}} />
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
      <MobileCardTile card={cardA} which="a" onTap={onCardTap} tileRef={cardARef} />
      <PairConnectorSvg />
      <MobileCardTile card={cardB} which="b" onTap={onCardTap} tileRef={cardBRef} />
    </div>
  );
}

interface MobileCardTileProps {
  card: LorcanaCard;
  which: 'a' | 'b';
  onTap: (which: 'a' | 'b', tileEl: HTMLElement) => void;
  /** Optional ref to the tile button — set for Card B so the comparison FLIP can target it. */
  tileRef?: React.RefObject<HTMLButtonElement | null>;
}

function MobileCardTile({card, which, onTap, tileRef}: MobileCardTileProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => onTap(which, e.currentTarget),
    [onTap, which],
  );
  const borderColor = INK_BORDER_TINT[card.ink];
  // No cost/ink overlay badges — the card art already shows both. Only the magnify hint is kept.
  return (
    <button
      type="button"
      ref={tileRef}
      aria-label={`Enlarge ${card.fullName}`}
      onClick={handleClick}
      style={{...CARD_TILE_STYLE, borderColor}}>
      <img src={card.imageUrl} alt={card.fullName} style={CARD_IMG_STYLE} />
      <span aria-hidden="true" style={MAGNIFY_HINT_STYLE}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 4V1H4M10 4V1H7M1 7V10H4M10 7V10H7" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}

function PairConnectorSvg() {
  return (
    <span aria-hidden="true" style={PAIR_CONNECTOR_STYLE}>
      <svg width="34" height="14" viewBox="0 0 34 14" fill="none">
        <line x1="2" y1="7" x2="32" y2="7" stroke={COLORS.primary500} strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx="17" cy="7" r="3" fill={COLORS.background} stroke={COLORS.primary500} strokeWidth={1.2} />
        <circle cx="17" cy="7" r="1.2" fill={COLORS.primary500} />
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
    <div role="tablist" style={{...TAB_BAR_STYLE, ...style}}>
      <ScoreChevronsTab
        name="engine"
        label="Engine"
        score={formatScore(engineScore)}
        showScale
        isActive={activeTab === 'engine'}
        tintColor={COLORS.primary500}
        tintBg="rgba(212, 175, 55, 0.06)"
        tintBorder="rgba(212, 175, 55, 0.5)"
        tintGlow="rgba(212, 175, 55, 0.15)"
        onClick={() => onChange('engine')}
      />
      <ScoreChevronsTab
        name="community"
        label="Community"
        score={communityScore != null ? formatScore(communityScore) : '—'}
        showScale={communityScore != null}
        isActive={activeTab === 'community'}
        tintColor="#b691ff"
        tintBg="rgba(182, 145, 255, 0.06)"
        tintBorder="rgba(182, 145, 255, 0.5)"
        tintGlow="rgba(182, 145, 255, 0.15)"
        onClick={() => onChange('community')}
      />
    </div>
  );
}

interface ScoreChevronsTabProps {
  name: TabName;
  label: string;
  score: string;
  showScale: boolean;
  isActive: boolean;
  tintColor: string;
  tintBg: string;
  tintBorder: string;
  tintGlow: string;
  onClick: () => void;
}

function ScoreChevronsTab({name, label, score, showScale, isActive, tintColor, tintBg, tintBorder, tintGlow, onClick}: ScoreChevronsTabProps) {
  const tabStyle: React.CSSProperties = {
    ...TAB_BASE_STYLE,
    background: isActive ? tintBg : 'rgba(255, 255, 255, 0.02)',
    borderColor: isActive ? tintBorder : COLORS.surfaceBorder,
    boxShadow: isActive ? `0 0 14px ${tintGlow}` : undefined,
  };
  const labelStyle: React.CSSProperties = {...TAB_LABEL_STYLE, color: isActive ? tintColor : COLORS.textDim};
  const scoreStyle: React.CSSProperties = {...TAB_SCORE_STYLE, color: isActive ? tintColor : COLORS.textDim};
  const scaleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: isActive ? tintColor : COLORS.textDim,
    opacity: isActive ? 0.8 : 0.7,
    marginLeft: 2,
  };
  return (
    <button type="button" role="tab" aria-selected={isActive} aria-controls={`${name}-panel`} onClick={onClick} style={tabStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={scoreStyle}>
        {score}
        {showScale && <span style={scaleStyle}>/10</span>}
      </span>
    </button>
  );
}

// ── Ink mapping helpers ──

const INK_BORDER_TINT: Record<Ink, string> = {
  Amber: 'rgba(245, 178, 2, 0.55)',
  Amethyst: 'rgba(139, 92, 246, 0.55)',
  Emerald: 'rgba(16, 185, 129, 0.55)',
  Ruby: 'rgba(239, 68, 68, 0.55)',
  Sapphire: 'rgba(59, 130, 246, 0.55)',
  Steel: 'rgba(107, 114, 128, 0.55)',
};

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
  opacity: 0.35,
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

const CARD_TILE_STYLE: React.CSSProperties = {
  position: 'relative',
  width: 'calc(50% - 8px)',
  maxWidth: 152,
  aspectRatio: '264 / 368',
  borderRadius: 14,
  overflow: 'hidden',
  border: '1.5px solid',
  cursor: 'zoom-in',
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
  padding: 0,
  background: COLORS.surfaceAlt,
  fontFamily: 'inherit',
};

const CARD_IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const MAGNIFY_HINT_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 6,
  right: 6,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(13, 13, 20, 0.85)',
  color: COLORS.primary500,
  border: '1px solid rgba(212, 175, 55, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
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

const TAB_BASE_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '12px 14px 10px',
  border: '1px solid',
  borderRadius: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'background 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1), color 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
};

const TAB_LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

const TAB_SCORE_STYLE: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1,
  fontFeatureSettings: '"tnum"',
};

const VIEWPORT_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollSnapType: 'x mandatory',
  scrollBehavior: 'smooth',
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
