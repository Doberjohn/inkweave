import type {Ink} from '../types';

/**
 * Geometry of the Lorcana-style deck frame, as percentages of the frame image.
 *
 * MEASURED, not designed: every value below was read off the 21 exported frames by
 * scanning each one for its blanked art window and its colour bands. All 21 are
 * 734x1024 and agree on `left`, `top` and `width` to the pixel, which is what lets a
 * single set of numbers serve every ink combination and makes adding a frame a pure
 * asset drop.
 *
 * The frame is a BITMAP, so it owns this geometry outright. Nothing here is a
 * preference that can be nudged: text taller than `bandHeight` spills onto the
 * parchment below it, and CSS cannot move the parchment.
 */
export const FRAME = {
  /** 734 / 1024. The card's own proportions. */
  aspect: 0.7168,
  /** The blanked window the card art is placed into. */
  art: {left: 3.95, top: 2.54, width: 91.69, height: 51.46},
  /** The coloured plate carrying the deck name: 54% to 63.28%. */
  bandTop: 54,
  bandHeight: 9.28,
  /** The darker classification strip below it: 63.28% to 66.89%. */
  stripTop: 63.28,
  stripHeight: 3.61,
} as const;

/**
 * How wide the card art must be drawn, as a percentage of the art window.
 *
 * Card images are a uniform 337x470 (verified across the set). The mockup let them
 * render at natural size, which framed correctly only at one tile width: below it the
 * crop tightened, and above ~390px the image stopped filling the window and left a
 * gap. Expressing it as a percentage makes the crop identical at every size.
 *
 * 131.7% reproduces the framing the owner approved at a 279px tile.
 */
export const ART_SCALE = 131.7;

/** The owner's crop, as a fraction of the art image's own box. */
export const ART_OFFSET = {x: -18, y: -8};

/**
 * Path to the frame for an ink combination, or null when there is none.
 *
 * The filename is DERIVED, not looked up: lowercase the inks, sort alphabetically,
 * join with a hyphen. That is exactly how the 21 assets are named, which makes the
 * sort load-bearing — a frame saved as `steel-emerald.webp` would never be found.
 *
 * Mono-ink falls out for free, because joining a one-element array yields the bare
 * ink name and `amber.webp` exists. An ink-LESS deck is the only case with no frame:
 * a draft with no cards has no ink identity yet, and returning null is the caller's
 * cue to render the frameless placeholder rather than request `.webp`.
 */
export function frameFor(inks: readonly Ink[]): string | null {
  if (inks.length === 0) return null;
  const slug = [...inks].map((ink) => ink.toLowerCase()).sort().join('-');
  return `/art/frames/${slug}.webp`;
}
