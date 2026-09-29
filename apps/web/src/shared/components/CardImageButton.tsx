import type {CSSProperties, ReactNode} from 'react';

interface CardImageButtonProps {
  /** What a click enlarges, e.g. "Enlarge card image" or "Enlarge Enchanted printing". */
  ariaLabel: string;
  onClick: () => void;
  /** Rounds the focus outline and clip to the art's corners. */
  borderRadius?: number;
  /** False when there is no art to enlarge: the pointer cursor would promise a lightbox. */
  enlargeable?: boolean;
  children: ReactNode;
}

/**
 * Card art that opens its lightbox on click (#509 kit): a bare, unstyled button around a
 * CardImage, so the art keeps its own look while staying keyboard- and screen-reader
 * operable. Used by the card page hero and each PrintingCarousel slide.
 */
export function CardImageButton({
  ariaLabel,
  onClick,
  borderRadius,
  enlargeable = true,
  children,
}: CardImageButtonProps) {
  const style: CSSProperties = {
    display: 'block',
    border: 'none',
    background: 'none',
    padding: 0,
    borderRadius,
    overflow: 'hidden',
    cursor: enlargeable ? 'pointer' : 'default',
  };
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} style={style}>
      {children}
    </button>
  );
}
