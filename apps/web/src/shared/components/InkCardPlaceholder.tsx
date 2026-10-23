import type {CSSProperties} from 'react';
import type {Ink} from '../../features/cards';
import {COLORS, INK_COLORS, blackRgba, hexRgba, whiteRgba} from '../constants';

/**
 * The colors every tile shares, as variables for `.ink-card-placeholder` (index.css): the page
 * just showing through, the recess under its top edge, and the sheen.
 */
const GROUND = {
  '--ink-ground': hexRgba(COLORS.background, 0.95),
  '--ink-recess': blackRgba(0.55),
  '--ink-sheen': whiteRgba(0.16),
};
/** A card not known yet: the app's neutral lavender, no ink's, and the mark's own gold glow. */
const NEUTRAL = {
  ...GROUND,
  '--ink': COLORS.gray400,
  '--ink-shine': COLORS.primary,
} as CSSProperties;

interface InkCardPlaceholderProps {
  /** The card's ink. Leave it out while no card is known yet: the tile is neutral, with the Inkweave mark. */
  ink?: Ink;
  /** A dual-ink card's second ink: the tile glows in both and shows both symbols. */
  ink2?: Ink;
}

/**
 * A card's place while its art loads: the reveals board's unrevealed slot (CardSlot), filling
 * whatever holds it. A tile in the card's ink, glowing from the top, with the ink's symbol just
 * above the middle and a sheen across the top. A dual-ink card glows in both inks and shows both
 * symbols; a card not known yet (a page still loading its card list) gets a neutral tile with the
 * Inkweave mark. One element, which index.css draws (`.ink-card-placeholder`) from the colors set
 * on it here, so a grid of loading tiles costs a span each. It covers its parent and takes the
 * parent's corner radius, and assistive tech skips it: the card's own image or label names it.
 */
export function InkCardPlaceholder({ink, ink2}: InkCardPlaceholderProps) {
  const style = ink
    ? ({
        ...GROUND,
        '--ink': INK_COLORS[ink].border,
        '--ink2': ink2 && INK_COLORS[ink2].border,
      } as CSSProperties)
    : NEUTRAL;
  return (
    <span
      aria-hidden="true"
      className="ink-card-placeholder"
      data-ink={ink}
      data-ink2={ink && ink2}
      style={style}
    />
  );
}
