import {useState, type CSSProperties} from 'react';
import {COLORS, EASING, FONTS, FONT_SIZES, hexRgba} from '../../../shared/constants';

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
  /** 'md' = pool tile dims (default), 'sm' = deck row. */
  size?: 'md' | 'sm';
  /** Used in aria-labels: `Add one copy of ${label}` / `Remove one copy of ${label}`. */
  label?: string;
  /** CONTROLLED pop: if provided (not undefined), the count pops while this is true. */
  popping?: boolean;
  /** Called on the count's onAnimationEnd when controlled. */
  onPopEnd?: () => void;
}

interface StepperDims {
  height: number;
  radius: number;
  countMinWidth: number;
  cellPadding: string;
  sideWidth: number;
  iconSize: number;
}

// md reproduces the committed pool pill 1:1; sm is the tighter deck-row variant.
// Both flow from this one table so the two variants can never drift.
const DIMS: Record<'md' | 'sm', StepperDims> = {
  md: {height: 32, radius: 16, countMinWidth: 40, cellPadding: '0 8px', sideWidth: 34, iconSize: 16},
  sm: {height: 30, radius: 15, countMinWidth: 30, cellPadding: '0 6px', sideWidth: 28, iconSize: 14},
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
function sideButtonStyle(dims: StepperDims, isShown: boolean, disabled: boolean, color: string): CSSProperties {
  return {
    ...cellStyle(dims),
    minWidth: 0,
    width: isShown ? dims.sideWidth : 0,
    opacity: isShown ? 1 : 0,
    padding: 0,
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

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        height: dims.height,
        borderRadius: dims.radius,
        border: `1px solid ${COLORS.primary}80`,
        background: hexRgba(COLORS.background, 0.94),
        overflow: 'hidden',
      }}>
      <button type="button" style={sideButtonStyle(dims, shown, false, COLORS.error)} onClick={handleDec} tabIndex={shown ? 0 : -1} aria-hidden={!shown} aria-label={`Remove one copy of ${name}`}>
        <MinusIcon size={dims.iconSize} />
      </button>
      <span
        onAnimationEnd={handlePopEnd}
        style={{...cell, color: COLORS.text, fontSize: FONT_SIZES.xl, animation: shouldPop ? 'inkweave-qty-pop 0.22s ease-out' : undefined}}>
        {value}
      </span>
      <button
        type="button"
        style={sideButtonStyle(dims, shown, incrementDisabled, COLORS.success)}
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
