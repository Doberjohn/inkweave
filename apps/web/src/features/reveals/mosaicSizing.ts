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
