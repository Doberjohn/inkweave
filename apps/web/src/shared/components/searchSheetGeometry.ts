/**
 * Where the search sheet's edges go, given what the user can actually see.
 *
 * Pure, and separate from the component, because this is the whole substance of
 * the keyboard fix and it is arithmetic — rendering a sheet to assert a number
 * would test jsdom's layout engine instead of the rule.
 *
 * THE RULE. The sheet is anchored to the VISIBLE band, not the layout viewport:
 * its bottom sits on top of the keyboard rather than behind it, and its height
 * is measured against the space that remains. Both edges are returned because
 * the results list is a `flex: 1; overflow-y: auto` child, and a percentage-
 * height child needs a DEFINITE height on its ancestor — `top` + `bottom` give
 * the sheet one without hardcoding a `height`.
 */

/**
 * Scrim left uncovered above the sheet. Once the sheet is at full height this
 * strip is the only tap-to-dismiss target, and a sheet flush to the top edge
 * reads as a page rather than an overlay.
 */
export const SHEET_TOP_GAP = 56;

/**
 * Idle share of the visible band. Chosen to reproduce the previous hardcoded
 * `top: 244` exactly at 812px (812 × 0.7 = 568px tall, top 244) so that the
 * common no-keyboard case is visually unchanged — while now scaling, where the
 * fixed offset cost a 667px screen 37% of its height and a 932px screen 26%.
 */
const IDLE_FRACTION = 0.7;

interface SheetGeometryInput {
  /** `window.innerHeight` — the viewport `position: fixed` is resolved against. */
  layoutHeight: number;
  /** The visible band, from `useVisualViewport`. */
  visibleHeight: number;
  /** Pixels the keyboard covers at the bottom. */
  keyboardInset: number;
  /** Whether suggestions are showing; results want every pixel available. */
  hasResults: boolean;
}

export function searchSheetGeometry({
  layoutHeight,
  visibleHeight,
  keyboardInset,
  hasResults,
}: SheetGeometryInput): {top: number; bottom: number} {
  const maxHeight = Math.max(0, visibleHeight - SHEET_TOP_GAP);

  // Keyboard up means the user is typing, so give them everything: growing into
  // space the keyboard occupies would add height that cannot be seen.
  const wantsFullHeight = hasResults || keyboardInset > 0;
  const height = wantsFullHeight
    ? maxHeight
    : Math.min(maxHeight, Math.round(visibleHeight * IDLE_FRACTION));

  return {
    bottom: keyboardInset,
    top: layoutHeight - keyboardInset - height,
  };
}
