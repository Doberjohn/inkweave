import {useLayoutEffect, useRef, useState, type CSSProperties, type RefObject} from 'react';
import {
  CARD_BAR_SHARE,
  COLORS,
  DURATION,
  EASING,
  FOIL_SHEEN,
  FONTS,
  FONT_SIZES,
  INSET_FOCUS_RING,
  TABULAR,
  hexRgba,
} from '../constants';
import {useContainerWidth} from 'inkweave-ui/hooks/useContainerWidth';
import {useHover} from 'inkweave-ui/hooks/useHover';
import {usePrefersReducedMotion} from 'inkweave-ui/utils/prefersReducedMotion';

/** One finish's part of the stripe: its count, and how the − and + change it. */
export interface StripePart {
  /** Names the part in its buttons: "Add one copy of foil". */
  label: string;
  count: number;
  /** `'foil'` paints the part in brushed gold (`FOIL_SHEEN`), its light band sweeping while open. */
  tone: 'default' | 'foil';
  /** Set the count. Never asked for less than 0: the − does nothing at 0. */
  onChange: (count: number) => void;
}

interface CopiesStripeProps {
  /** Every finish the card is printed in, left to right: normal, then foil. */
  parts: readonly StripePart[];
  /**
   * Open, the parts share the whole width, each − count +. Closed, a held part shows its count
   * alone and an unheld one nothing, so the stripe opens out from the middle.
   */
  open: boolean;
  /** False keeps the − and + out of the Tab order even while they show. Default true. */
  tabbable?: boolean;
  /**
   * How the stripe takes its size from its width: `'pocket'` (the default) scales down from the
   * width it is drawn for, as a binder pocket's does; `'bar'` is as tall as the card's own black
   * bar, as the card window's is (owner, 2026-10-20).
   */
  fit?: 'pocket' | 'bar';
}

/** The stripe's height: the count's size, with room around it. */
const HEIGHT = 26;
/** The count's box, and a held part's width at rest. */
const COUNT_WIDTH = 30;
const GLYPH_SIZE = 12;
/**
 * The width the stripe is drawn for. A narrower one scales down with its card (owner,
 * 2026-10-20: stacking the parts on a narrow pocket did not feel right): a 1920px screen's
 * 144px stripe to 0.9 of its drawn size (the owner's pick of four), a 1440px screen's to about
 * 0.53, a 1280px screen's to 0.4.
 */
const DRAWN_WIDTH = 160;

/** The stripe's zoom for its measured width, by how it fits. */
const ZOOMS: Record<NonNullable<CopiesStripeProps['fit']>, (width: number) => number> = {
  pocket: (width) => Math.min(1, width / DRAWN_WIDTH),
  bar: (width) => (width * CARD_BAR_SHARE) / HEIGHT,
};

/**
 * A card's copies as a stripe across its foot (owner, 2026-10-20), black like the card's own
 * bottom bar: normal copies on the left on the dark ground, foil on the right in brushed gold.
 * At rest a held part shows its count; open, the parts widen from the middle to the card's
 * edges, the − and + growing out beside each count, as the binder's pills used to open.
 *
 * ON A SMALLER CARD THE STRIPE IS SMALLER: `zoom` scales its pixels (the height, the counts,
 * their boxes and the glyphs) by its width, and leaves the parts' shares of that width alone,
 * so it still opens to the card's edges. A pocket's never scales up past `DRAWN_WIDTH`; the
 * card window's matches the card's own bar at any size. The width is measured, so until it is
 * known the stripe is drawn at full size.
 */
export function CopiesStripe({parts, open, tabbable = true, fit = 'pocket'}: CopiesStripeProps) {
  const sizer = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(sizer);
  useZoomBeforePaint(sizer, row, fit === 'pocket' ? ZOOMS.pocket : undefined);
  const share = `${100 / parts.length}%`;
  return (
    <div style={{position: 'relative'}}>
      {/*
        What is measured: the stripe's width, with no height, so the zoom that width sets, which
        changes the stripe's height, never changes the size measured.
      */}
      <div ref={sizer} style={{position: 'absolute', left: 0, right: 0, height: 0}} />
      <div ref={row} style={{display: 'flex', justifyContent: 'center', zoom: width > 0 ? ZOOMS[fit](width) : 1}}>
        {parts.map((part) => (
          <Part key={part.label} part={part} width={partWidth(open, share, part.count)} open={open} tabbable={tabbable} />
        ))}
      </div>
    </div>
  );
}

/**
 * A pocket's stripe takes its zoom before it first paints (owner, 2026-10-26: each page a turn
 * mounted drew its counts full size for a frame, then shrank). The width `useContainerWidth`
 * measures renders after the paint, so an observer started in the commit puts the first width's
 * zoom straight onto the row, before the paint, and the render that follows writes the same zoom.
 * It renders nothing there: a render inside the observer's step (React's `flushSync`) also ran
 * the page's other pending work, such as a page turn under way, and a box observed there that
 * changed size was left for the next frame, which the browser reports as an error ("ResizeObserver
 * loop completed with undelivered notifications", uncaught in WebKit). Only the row changes
 * size, and nothing observes it. The card window's stripe sits in the window's flow, where its
 * zoom moves the window's contents, so it keeps to the render.
 */
function useZoomBeforePaint(
  sizer: RefObject<HTMLDivElement | null>,
  row: RefObject<HTMLDivElement | null>,
  zoom: ((width: number) => number) | undefined,
) {
  useLayoutEffect(() => {
    const measured = sizer.current;
    const zoomed = row.current;
    if (!zoom || !measured || !zoomed || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width <= 0) return;
      zoomed.style.zoom = String(zoom(width));
      observer.disconnect();
    });
    observer.observe(measured);
    return () => observer.disconnect();
  }, [sizer, row, zoom]);
}

/** A part's width: its share open, its count's box held, nothing unheld. */
function partWidth(open: boolean, share: string, count: number): string | number {
  if (open) return share;
  return count > 0 ? COUNT_WIDTH : 0;
}

/**
 * The count pops when its own − or + changes it (`inkweave-qty-pop`), never on a re-render:
 * each press remounts the count under a new key, which replays the animation. Still under
 * reduced motion.
 */
function usePop() {
  const reducedMotion = usePrefersReducedMotion();
  const [pops, setPops] = useState(0);
  return {
    popKey: pops,
    animation: pops > 0 && !reducedMotion ? `inkweave-qty-pop ${DURATION.base}ms ${EASING.smooth}` : undefined,
    pop: () => setPops((n) => n + 1),
  };
}

function partStyle(isFoil: boolean, open: boolean, width: string | number): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'stretch',
    flexShrink: 0,
    width,
    height: HEIGHT,
    overflow: 'hidden',
    // Open, the whole part is the stripe's, its count included: no press passes through it.
    pointerEvents: open ? 'auto' : 'none',
    // A count is no text to pick out (owner, 2026-10-20): the arrow over it, not the I-beam,
    // and a quick double click on a + never selects it.
    cursor: 'default',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    ...(isFoil ? FOIL_SHEEN.surface(COLORS.background, open) : {background: COLORS.background}),
    transition: `width ${DURATION.base}ms ${EASING.snappy}`,
  };
}

const COUNT_STYLE: CSSProperties = {
  ...TABULAR,
  flex: `0 0 ${COUNT_WIDTH}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: COLORS.text,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.xl}px`,
  fontWeight: 700,
  lineHeight: 1,
};

interface PartProps {
  part: StripePart;
  width: string | number;
  open: boolean;
  tabbable: boolean;
}

/** One finish: − count +, the − and + sharing what the count leaves of the part's width. */
function Part({part, width, open, tabbable}: PartProps) {
  const {label, count, tone, onChange} = part;
  const isFoil = tone === 'foil';
  const {popKey, animation, pop} = usePop();
  const change = (next: number) => {
    pop();
    onChange(next);
  };
  const buttons = {label, open, tabbable};
  return (
    <div className={isFoil && open ? FOIL_SHEEN.shimmerClass : undefined} style={partStyle(isFoil, open, width)}>
      <StripeButton kind="minus" disabled={count === 0} onPress={() => change(count - 1)} {...buttons} />
      <span key={popKey} style={{...COUNT_STYLE, animation}}>
        {count}
      </span>
      <StripeButton kind="plus" disabled={false} onPress={() => change(count + 1)} {...buttons} />
    </div>
  );
}

interface StripeButtonProps {
  kind: 'minus' | 'plus';
  label: string;
  /** Greyed and inert, but still in reach: a − pressed to 0 under keyboard focus keeps that focus. */
  disabled: boolean;
  open: boolean;
  tabbable: boolean;
  onPress: () => void;
}

/** What each button does to the count, said in its label, and its colour: the binder pills' red and green. */
const KINDS = {
  minus: {verb: 'Remove', color: COLORS.error},
  plus: {verb: 'Add', color: COLORS.success},
} as const;

interface ButtonLook {
  color: string;
  disabled: boolean;
  open: boolean;
  /** The mouse is on it, and it can act. */
  hot: boolean;
}

function buttonStyle({color, disabled, open, hot}: ButtonLook): CSSProperties {
  return {
    // The gold its keyboard ring (`.inset-focus-ring`) is drawn in.
    ...INSET_FOCUS_RING,
    flex: '1 1 0',
    minWidth: 0,
    padding: 0,
    border: 'none',
    background: hot ? hexRgba(color, 0.22) : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: disabled ? COLORS.textDim : color,
    cursor: disabled ? 'default' : 'pointer',
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none',
    transition: `opacity ${DURATION.base}ms ${EASING.snappy}, color ${DURATION.fast}ms ${EASING.snappy}, background ${DURATION.fast}ms ${EASING.snappy}`,
  };
}

/**
 * A − or + in its colour, filling its side of the count. Pointed at, its cell washes in that
 * colour and its glyph grows (owner, 2026-10-20: the stripe needs to say which button the
 * mouse is on). A disabled one stays still.
 */
function StripeButton({kind, label, disabled, open, tabbable, onPress}: StripeButtonProps) {
  const {hovered, hoverProps} = useHover();
  const {verb, color} = KINDS[kind];
  const hot = hovered && open && !disabled;
  return (
    <button
      type="button"
      // Its part clips an outline: the keyboard's ring is drawn inside the button instead.
      className="inset-focus-ring"
      {...hoverProps}
      tabIndex={open && tabbable ? 0 : -1}
      aria-hidden={!open}
      aria-disabled={disabled || undefined}
      aria-label={`${verb} one copy of ${label}`}
      onClick={disabled ? undefined : onPress}
      style={buttonStyle({color, disabled, open, hot})}>
      <Glyph kind={kind} hot={hot} />
    </button>
  );
}

/** The − or + itself, grown while its button is hot. */
function Glyph({kind, hot}: {kind: StripeButtonProps['kind']; hot: boolean}) {
  return (
    <svg
      width={GLYPH_SIZE}
      height={GLYPH_SIZE}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{transform: hot ? 'scale(1.3)' : undefined, transition: `transform ${DURATION.fast}ms ${EASING.snappy}`}}>
      {kind === 'plus' && <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
