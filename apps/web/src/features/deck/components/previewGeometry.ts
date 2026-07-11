import {SPACING} from '../../../shared/constants';

/** A Lorcana card scan's width / height. */
const CARD_ASPECT = 0.716;
/** Wide enough for the card's ability text to be readable at a glance. */
const PREVIEW_MAX_WIDTH = 340;
/** Breathing room against the viewport edges and the anchoring row. */
const PREVIEW_MARGIN = 12;
/** Below this the scan is unreadable, so showing nothing beats covering the row. */
const PREVIEW_MIN_WIDTH = 120;

export interface PreviewGeometry {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** The hovered row's position, as much of a DOMRect as the maths needs. */
interface Anchor {
  left: number;
  top: number;
  height: number;
}

/**
 * Where to float the deck panel's hover preview, given the row it points at.
 *
 * Fits the card into the space it actually has rather than clamping a fixed size
 * into a box too small to hold it: `Math.max(floor, Math.min(v, ceiling))` quietly
 * yields the floor when ceiling < floor, which is how a fixed 340px card ends up
 * overlapping the row it describes (narrow window) or hanging off the bottom of a
 * short viewport. Deriving the size from the available gap makes both violations
 * unrepresentable. Returns null when there is no room worth rendering into.
 */
export function previewGeometry(anchor: Anchor, viewportHeight: number): PreviewGeometry | null {
  const gapToTheLeft = anchor.left - SPACING.md - PREVIEW_MARGIN;
  const widthThatFitsVertically = (viewportHeight - PREVIEW_MARGIN * 2) * CARD_ASPECT;
  const width = Math.round(Math.min(PREVIEW_MAX_WIDTH, gapToTheLeft, widthThatFitsVertically));
  if (width < PREVIEW_MIN_WIDTH) return null;

  const height = Math.round(width / CARD_ASPECT);
  const centered = anchor.top + anchor.height / 2 - height / 2;
  return {
    width,
    height,
    // width <= gapToTheLeft, so this never crosses the anchor nor the left edge.
    left: anchor.left - SPACING.md - width,
    // height <= viewportHeight - 2*margin, so the ceiling is never below the floor.
    top: Math.max(PREVIEW_MARGIN, Math.min(centered, viewportHeight - height - PREVIEW_MARGIN)),
  };
}
