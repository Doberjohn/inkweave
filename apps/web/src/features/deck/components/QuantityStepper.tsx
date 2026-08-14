import {useState, type CSSProperties} from 'react';
import {COLORS, EASING, FOIL_SHEEN, FONTS, FONT_SIZES, hexRgba} from '../../../shared/constants';

interface QuantityStepperProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Greys + disables the +, and suppresses onIncrement. */
  incrementDisabled?: boolean;
  /** title + aria-label on a disabled +. */
  disabledReason?: string;
  /** When true the − and + collapse to width 0 (count-only), transitioning open when false. */
  collapsed?: boolean;
  /** 'md' = pool tile dims (default), 'sm' = deck row, 'xs' = binder slot. */
  size?: StepperSize;
  /**
   * `'foil'` fills the pill with brushed gold (`FOIL_SHEEN`) instead of the flat
   * dark ground. The collection binder shows both finishes side by side and needs
   * them told apart WITHOUT a letter: an `N`/`F` beside each number read as noise
   * at that size, where a change of surface reads instantly.
   */
  tone?: 'default' | 'foil';
  /** Sweeps the foil light band across the pill. Ignored unless `tone` is foil. */
  shimmer?: boolean;
  /** Used in aria-labels: `Add one copy of ${label}` / `Remove one copy of ${label}`. */
  label?: string;
  /** CONTROLLED pop: if provided (not undefined), the count pops while this is true. */
  popping?: boolean;
  /** Called on the count's onAnimationEnd when controlled. */
  onPopEnd?: () => void;
}

export type StepperSize = 'md' | 'sm' | 'xs';

interface StepperDims {
  height: number;
  radius: number;
  countMinWidth: number;
  cellPadding: string;
  sideWidth: number;
  iconSize: number;
  countFontSize: number;
  /**
   * What the pill is painted on. `md`/`sm` sit on a deck surface and let a sliver
   * of the tile behind them through, which is the look those two have always had.
   * `xs` is FULLY OPAQUE (owner, 2026-08-14: no transparency at rest): it sits
   * directly on card art, where 6% passthrough is a smear of somebody's face
   * behind a number rather than a tasteful hint of the surface below.
   */
  ground: string;
  /**
   * Outer inset on the − and + cells, pushing both glyphs toward the count.
   * Padding rather than a narrower cell so the pill's TOTAL width is unchanged:
   * `xs` has 4px of slack against the narrowest binder slot and cannot spend it.
   * On a pill-radius end the glyph otherwise crowds the curve.
   *
   * Dropped to 0 while collapsed — with `box-sizing: border-box` a padded cell
   * cannot shrink below its padding, so leaving it on would stop the pill
   * collapsing to count-only.
   */
  sideInset: number;
}

// md reproduces the committed pool pill 1:1; sm is the tighter deck-row variant.
// All three flow from this one table so the variants can never drift.
//
// xs EXISTS FOR A MEASURED CONSTRAINT, not for taste. The collection binder puts
// two steppers SIDE BY SIDE inside one card slot, and it is sized FROM the
// narrowest slot the app actually produces rather than from a comfortable one.
//
// The binder slot is HEIGHT-driven (`aspect-ratio` inside a 3-row spread), so it
// SHRINKS on a short window and does not grow on a wide one. Measured on
// /browse?view=binder: 114px at 1280x720, 125 at 1366x768, 157 at 1440x900, 200
// at 1920x1080. 114 is the number that matters. Two `sm` pills are 2x88 = 176 and
// could never fit; two `xs` are 2x54 + a 2px gap = 110, inside 114 with 4 to
// spare. A count of 10+ widens its cell and eats that margin — the pair then
// overhangs its own slot symmetrically, which is survivable because the hovered
// slot sits above its neighbours on `zIndex` and they are only card art.
//
// EVERY SPARE PIXEL IS IN THE COUNT (owner, 2026-08-14: bigger number, still one
// row). The count cell went 20 -> 24 and its type 11 -> 12 by taking 1px off each
// side button and 2px off the gap between the pair. The − and + are 14x22, small
// for a finger but this control is hover-only by construction, and the number is
// the thing being read.
const TRANSLUCENT_GROUND = hexRgba(COLORS.background, 0.94);

const DIMS: Record<StepperSize, StepperDims> = {
  md: {height: 32, radius: 16, countMinWidth: 40, cellPadding: '0 8px', sideWidth: 34, iconSize: 16, countFontSize: FONT_SIZES.xl, ground: TRANSLUCENT_GROUND, sideInset: 0},
  sm: {height: 30, radius: 15, countMinWidth: 30, cellPadding: '0 6px', sideWidth: 28, iconSize: 14, countFontSize: FONT_SIZES.xl, ground: TRANSLUCENT_GROUND, sideInset: 0},
  xs: {height: 22, radius: 11, countMinWidth: 24, cellPadding: '0 2px', sideWidth: 14, iconSize: 10, countFontSize: FONT_SIZES.md, ground: COLORS.background, sideInset: 4},
};

// SVG glyphs (not font characters) so "−"/"+" center exactly in the pill on any
// font — the font-metric baseline was rendering the text glyphs low.
function MinusIcon({size}: {size: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon({size}: {size: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function cellStyle(dims: StepperDims): CSSProperties {
  // Centered glyph/number cell. `line-height: 1` + flex-centering keeps the "−",
  // "+" and digit optically centered in the pill regardless of their font metrics.
  return {
    minWidth: dims.countMinWidth,
    height: '100%',
    padding: dims.cellPadding,
    border: 'none',
    background: 'transparent',
    fontFamily: FONTS.body,
    fontWeight: 700,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

// The − / + side buttons collapse to width 0 when `collapsed`; the width
// transition grows the count pill into a full stepper when opened.
/** `0 <right> 0 <left>`, with the inset on the pill's OUTER side only. */
function padShorthand(inset: number, side: 'start' | 'end'): string {
  return side === 'start' ? `0 0 0 ${inset}px` : `0 ${inset}px 0 0`;
}

function sideButtonStyle(
  dims: StepperDims,
  isShown: boolean,
  disabled: boolean,
  color: string,
  side: 'start' | 'end',
): CSSProperties {
  return {
    ...cellStyle(dims),
    minWidth: 0,
    width: isShown ? dims.sideWidth : 0,
    opacity: isShown ? 1 : 0,
    // ONE SHORTHAND, ALWAYS FULLY SPECIFIED — never `padding: 0` plus a
    // conditional `paddingLeft`. React removes a dropped longhand by clearing
    // it, which also clears that side of the shorthand it was overriding, and
    // the element falls back to the UA stylesheet. A <button> defaults to
    // `padding: 1px 6px`, so the collapsed side cell settled at 6px instead of
    // 0 and the pill stayed 38px wide after a hover instead of returning to 26.
    padding: isShown ? padShorthand(dims.sideInset, side) : '0',
    color: disabled ? COLORS.textDim : color,
    cursor: disabled ? 'default' : 'pointer',
    overflow: 'hidden',
    transition: `width 0.2s ${EASING.snappy}, opacity 0.18s ${EASING.snappy}, color 0.15s ${EASING.snappy}`,
  };
}

function incrementAriaLabel(disabled: boolean, disabledReason: string | undefined, name: string): string {
  if (disabled) return disabledReason ?? `Cannot add more ${name}`;
  return `Add one copy of ${name}`;
}

// Owns the pop animation state so the component stays a thin view. Controlled
// (parent passes `popping`/`onPopEnd`) or uncontrolled (internal state); the pop
// is triggered from the click handlers only, never a render-time effect.
function usePopAnimation(popping: boolean | undefined, onPopEnd: (() => void) | undefined) {
  const isControlled = popping !== undefined;
  const [internalPop, setInternalPop] = useState(false);
  const shouldPop = isControlled ? popping : internalPop;
  const triggerPop = () => {
    if (!isControlled) setInternalPop(true);
  };
  const handlePopEnd = () => {
    if (isControlled) onPopEnd?.();
    else setInternalPop(false);
  };
  return {shouldPop, triggerPop, handlePopEnd};
}

/**
 * The gold-pill `− count +` quantity stepper shared by the pool tile (variant
 * `md`, collapse-on-hover) and the deck row (variant `sm`, always-open).
 *
 * The pop animation is driven from the click handlers only — never a useEffect
 * or a set-state-during-render — so it fires on a real change and stays silent
 * when a virtualized tile scrolls back into view. Pass `popping`/`onPopEnd` to
 * own the pop from the parent (the pool tile also pops on card-body adds);
 * omit them for the uncontrolled internal pop.
 */
export function QuantityStepper({
  value,
  onIncrement,
  onDecrement,
  incrementDisabled = false,
  disabledReason,
  collapsed = false,
  size = 'md',
  tone = 'default',
  shimmer = false,
  label,
  popping,
  onPopEnd,
}: QuantityStepperProps) {
  const dims = DIMS[size];
  const shown = !collapsed;
  const name = label ?? 'card';

  const {shouldPop, triggerPop, handlePopEnd} = usePopAnimation(popping, onPopEnd);

  const handleInc = () => {
    if (incrementDisabled) return;
    triggerPop();
    onIncrement();
  };
  const handleDec = () => {
    triggerPop();
    onDecrement();
  };

  const cell = cellStyle(dims);

  const isFoil = tone === 'foil';

  return (
    <div
      className={isFoil && shimmer ? FOIL_SHEEN.shimmerClass : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        height: dims.height,
        borderRadius: dims.radius,
        border: `1px solid ${COLORS.primary}80`,
        // The foil surface layers OVER the ground rather than replacing it: its
        // gold is semi-transparent, and the ground is what keeps the count
        // readable. Flat brand gold behind white bold text is 3.0:1 and fails.
        ...(isFoil ? FOIL_SHEEN.surface(dims.ground, shown) : {background: dims.ground}),
        overflow: 'hidden',
      }}>
      <button type="button" style={sideButtonStyle(dims, shown, false, COLORS.error, 'start')} onClick={handleDec} tabIndex={shown ? 0 : -1} aria-hidden={!shown} aria-label={`Remove one copy of ${name}`}>
        <MinusIcon size={dims.iconSize} />
      </button>
      <span
        onAnimationEnd={handlePopEnd}
        style={{...cell, color: COLORS.text, fontSize: dims.countFontSize, animation: shouldPop ? 'inkweave-qty-pop 0.22s ease-out' : undefined}}>
        {value}
      </span>
      <button
        type="button"
        style={sideButtonStyle(dims, shown, incrementDisabled, COLORS.success, 'end')}
        onClick={handleInc}
        disabled={incrementDisabled}
        tabIndex={shown ? 0 : -1}
        aria-hidden={!shown}
        title={incrementDisabled ? disabledReason : undefined}
        aria-label={incrementAriaLabel(incrementDisabled, disabledReason, name)}>
        <PlusIcon size={dims.iconSize} />
      </button>
    </div>
  );
}
