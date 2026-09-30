/**
 * Slot-sizing math for the ink board mosaic, kept out of CardMosaic so that file
 * exports only its component (react-refresh) and this auto-fit calc stays a pure,
 * unit-testable function.
 */

/** Mobile slot bounds (px): MIN keeps card art legible on 320px phones, MAX stops
 *  slots ballooning on ~760px "mobile" tablets, FALLBACK applies until first measure. */
const MOBILE_SLOT_MIN = 38;
const MOBILE_SLOT_MAX = 58;
const MOBILE_SLOT_FALLBACK = 46;

/**
 * Auto-fit mobile slot width: the largest size at which the widest row (maxCols
 * cards + their gaps) still fits the measured rail. Floored so the row is never a
 * sub-pixel too wide (which would trigger a horizontal scrollbar) and clamped to
 * [MIN, MAX] for legibility. Falls back until the rail is first measured (width 0).
 */
export function mobileSlotWidth(containerW: number, maxCols: number, gap: number): number {
  if (containerW <= 0) return MOBILE_SLOT_FALLBACK;
  const fit = Math.floor((containerW - (maxCols - 1) * gap) / maxCols);
  return Math.min(Math.max(fit, MOBILE_SLOT_MIN), MOBILE_SLOT_MAX);
}

/** Card slot proportion (height / width), preserved when the mobile slot auto-fits. */
const CARD_RATIO = 64 / 46;

/** A slot narrower than this draws its placeholder symbol at the smaller size. */
export function isNarrowSlot(width: number): boolean {
  return width < 54;
}

/**
 * A board slot's size and the gap between slots. Desktop slots are a fixed 58x80 with 7px
 * gaps; mobile slots auto-fit `maxCols` (the diamond's widest row) to the measured rail with
 * 5px gaps, keeping the card proportion. The diamond and the special printings row both use
 * it, so their slots always match.
 */
export function slotSize(
  compact: boolean,
  containerW: number,
  maxCols: number,
): {width: number; height: number; gap: number} {
  if (!compact) return {width: 58, height: 80, gap: 7};
  const gap = 5;
  const width = mobileSlotWidth(containerW, maxCols, gap);
  return {width, height: Math.round(width * CARD_RATIO), gap};
}
