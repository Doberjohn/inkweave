import {useState, useCallback, memo} from 'react';
import type {LorcanaCard} from '../types';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {useCardPreviewHandlers} from './useCardPreviewHandlers';

interface CardTileProps {
  card: LorcanaCard;
  /** @deprecated Use onSelect instead for stable references with React.memo */
  onClick?: () => void;
  /** Stable callback — receives the card, so parent doesn't need per-item closures */
  onSelect?: (card: LorcanaCard) => void;
  isSelected: boolean;
  variant?: 'full' | 'minimal';
  useThumbnail?: boolean;
  borderRadius?: number;
  disablePreview?: boolean;
  /** Rendered width hint for srcset/sizes (e.g., "180px"). Helps browser pick the right image. */
  displayWidth?: string;
}

export const CardTile = memo(function CardTile({
  card,
  onClick,
  onSelect,
  isSelected,
  variant = 'full',
  useThumbnail,
  borderRadius,
  disablePreview,
  displayWidth,
}: CardTileProps) {
  const handleClick = useCallback(() => {
    onClick?.();
    onSelect?.(card);
  }, [onClick, onSelect, card]);
  const colors = INK_COLORS[card.ink];
  const {previewHandlers, hidePreview} = useCardPreviewHandlers({card, onTap: handleClick});
  const [imgError, setImgError] = useState(false);
  const imgSrc = useThumbnail
    ? card.thumbnailUrl || card.imageUrl
    : card.imageUrl || card.thumbnailUrl;

  // Build srcset when both image sizes are available (thumbnail: 367w, full: 1468w)
  const srcSet =
    card.thumbnailUrl && card.imageUrl
      ? `${card.thumbnailUrl} 367w, ${card.imageUrl} 1468w`
      : undefined;
  const sizes = srcSet && displayWidth ? displayWidth : undefined;

  return (
    <button
      className="card-tile"
      data-testid="card-tile"
      onClick={() => {
        hidePreview();
        handleClick();
      }}
      {...(disablePreview ? {} : previewHandlers)}
      aria-pressed={isSelected}
      aria-label={card.fullName || card.name || 'View card details'}
      style={{
        position: 'relative',
        borderRadius: `${borderRadius ?? RADIUS.xl}px`,
        border:
          variant === 'minimal'
            ? 'none'
            : `2px solid ${isSelected ? colors.border : 'transparent'}`,
        background: COLORS.surface,
        boxShadow:
          variant === 'minimal'
            ? '0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px -12px rgba(0,0,0,0.5)'
            : isSelected
              ? `0 0 8px ${colors.border}60`
              : '0 2px 6px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        padding: 0,
        overflow: 'hidden',
        width: '100%',
        aspectRatio: '0.72',
      }}>
      {/* Card image or fallback */}
      {imgSrc && !imgError ? (
        <img
          src={imgSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={card.fullName || card.name || ''}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <span style={{fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 600, color: colors.text}}>
            {card.cost}
          </span>
        </div>
      )}
    </button>
  );
});
