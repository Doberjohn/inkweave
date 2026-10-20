import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, INK_COLORS, RADIUS, blackRgba, hexRgba} from '../../../shared/constants';

interface ComparisonCardTileProps {
  card: LorcanaCard;
  which: 'a' | 'b';
  onTap: (which: 'a' | 'b', tileEl: HTMLElement) => void;
  /** Ref to the tile button: the comparison's entry and exit FLIP animates this element. */
  tileRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * One card of the phone comparison (MobileComparisonView): the card's art in a frame of its ink,
 * with a magnify hint. A tap opens the lightbox, which grows out of the tile's rect. A tile family
 * of its own, as CardTile is, so the lint rule's no-adhoc-buttons exempts this file by name (#835).
 */
export function ComparisonCardTile({card, which, onTap, tileRef}: ComparisonCardTileProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => onTap(which, e.currentTarget);
  // No cost/ink overlay badges — the card art already shows both. Only the magnify hint is kept.
  return (
    <button
      type="button"
      ref={tileRef}
      aria-label={`Enlarge ${card.fullName}`}
      onClick={handleClick}
      style={{...CARD_TILE_STYLE, borderColor: inkBorderTint(card.ink)}}>
      <img src={card.imageUrl} alt={card.fullName} style={CARD_IMG_STYLE} />
      <span aria-hidden="true" style={MAGNIFY_HINT_STYLE}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path
            d="M1 4V1H4M10 4V1H7M1 7V10H4M10 7V10H7"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </svg>
      </span>
    </button>
  );
}

/** The frame takes the card's ink, half see-through. */
function inkBorderTint(ink: Ink): string {
  return hexRgba(INK_COLORS[ink].border, 0.55);
}

const CARD_TILE_STYLE: React.CSSProperties = {
  position: 'relative',
  width: 'calc(50% - 8px)',
  maxWidth: 152,
  aspectRatio: '264 / 368',
  borderRadius: RADIUS.xl,
  overflow: 'hidden',
  border: '1.5px solid',
  cursor: 'zoom-in',
  boxShadow: `0 6px 18px ${blackRgba(0.45)}`,
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
  background: hexRgba(COLORS.background, 0.85),
  color: COLORS.primary500,
  border: `1px solid ${hexRgba(COLORS.primary500, 0.4)}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};
