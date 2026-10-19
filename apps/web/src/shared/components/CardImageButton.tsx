import type {CSSProperties, ReactNode} from 'react';
import {CARD_TILE_RING} from '../constants';

interface CardImageButtonProps {
  /** What a click enlarges, e.g. "Enlarge card image" or "Enlarge Enchanted printing". */
  ariaLabel: string;
  onClick: () => void;
  /** Rounds the focus ring and clip to the art's corners. */
  borderRadius?: number;
  /** False when there is no art to enlarge: the pointer cursor would promise a lightbox. */
  enlargeable?: boolean;
  children: ReactNode;
}

/**
 * Card art that opens its lightbox on click (#509 kit): a bare, unstyled button around a
 * CardImage, so the art keeps its own look while staying keyboard- and screen-reader
 * operable. Used by the card page hero and each PrintingCarousel slide. Its focus ring is
 * drawn inside the art (`inset-focus-ring`): the carousel's scroll viewport clips anything
 * outside it.
 */
export function CardImageButton({
  ariaLabel,
  onClick,
  borderRadius,
  enlargeable = true,
  children,
}: CardImageButtonProps) {
  const style: CSSProperties = {
    ...CARD_TILE_RING,
    display: 'block',
    border: 'none',
    background: 'none',
    padding: 0,
    borderRadius,
    overflow: 'hidden',
    cursor: enlargeable ? 'pointer' : 'default',
  };
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className="inset-focus-ring" style={style}>
      {children}
    </button>
  );
}
