import type {CSSProperties, ReactNode} from 'react';
import {CARD_TILE_GLOW, INSET_FOCUS_RING} from '../tokens/theme';

interface CardImageButtonProps {
  /** What a click enlarges, e.g. "Enlarge card image" or "Enlarge Enchanted printing". */
  ariaLabel: string;
  onClick: () => void;
  /** Rounds the focus ring and clip to the art's corners. */
  borderRadius?: number;
  /** False when there is no art to enlarge: the pointer cursor would promise a lightbox. */
  enlargeable?: boolean;
  /**
   * Its place in a roving Tab order, such as the binder's pockets' (`BinderSpread`): given, the
   * button marks itself `data-roving-item`, as `CardTile` does. Left out, it is a Tab stop.
   */
  tabIndex?: number;
  /**
   * Drawn as a card tile, for art among card tiles (a waiting promo's binder pocket, #805): it
   * fills its box and takes the tiles' gold glow under a pointer or keyboard focus, and their
   * press (`.card-tile`, index.css).
   */
  tile?: boolean;
  children: ReactNode;
}

/** A tile's own: the box it fills, and the glow's colours (`CARD_TILE_GLOW`), which `.card-tile` reads. */
const TILE_STYLE: CSSProperties = {...CARD_TILE_GLOW, width: '100%', height: '100%'};

/**
 * Card art that opens its lightbox on click (#509 kit): a bare, unstyled button around a
 * CardImage, so the art keeps its own look while staying keyboard- and screen-reader
 * operable. Used by the card page hero, each PrintingCarousel slide and a waiting promo's
 * binder pocket. Its focus ring is drawn inside the art (`inset-focus-ring`): the carousel's
 * scroll viewport clips anything outside it.
 */
export function CardImageButton({
  ariaLabel,
  onClick,
  borderRadius,
  enlargeable = true,
  tabIndex,
  tile = false,
  children,
}: CardImageButtonProps) {
  const style: CSSProperties = {
    ...INSET_FOCUS_RING,
    ...(tile && TILE_STYLE),
    display: 'block',
    border: 'none',
    background: 'none',
    padding: 0,
    borderRadius,
    overflow: 'hidden',
    cursor: enlargeable ? 'pointer' : 'default',
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      tabIndex={tabIndex}
      data-roving-item={tabIndex === undefined ? undefined : true}
      className={tile ? 'inset-focus-ring card-tile' : 'inset-focus-ring'}
      style={style}>
      {children}
    </button>
  );
}
