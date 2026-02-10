import {useState} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from '../types';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {useCardPreviewHandlers} from './useCardPreviewHandlers';

interface CardTileProps {
  card: LorcanaCard;
  onClick: () => void;
  isSelected: boolean;
  variant?: 'full' | 'minimal';
  useThumbnail?: boolean;
  borderRadius?: number;
  disablePreview?: boolean;
}

export function CardTile({card, onClick, isSelected, variant = 'full', useThumbnail, borderRadius, disablePreview}: CardTileProps) {
  const colors = INK_COLORS[card.ink];
  const {previewHandlers, hidePreview} = useCardPreviewHandlers({card, onTap: onClick});
  const [imgError, setImgError] = useState(false);
  const imgSrc = useThumbnail
    ? (card.thumbnailUrl || card.imageUrl)
    : (card.imageUrl || card.thumbnailUrl);

  return (
    <motion.button
      data-testid="card-tile"
      onClick={() => { hidePreview(); onClick(); }}
      {...(disablePreview ? {} : previewHandlers)}
      aria-pressed={isSelected}
      aria-label={card.fullName || card.name || 'View card details'}
      whileHover={{
        scale: 1.04,
        y: -3,
        boxShadow: isSelected
          ? `0 0 12px ${colors.border}80`
          : variant === 'minimal'
            ? `0 0 14px ${COLORS.primary}30, 0 25px 50px -12px rgba(0,0,0,0.5)`
            : `0 4px 16px ${colors.border}40`,
      }}
      whileTap={{scale: 0.97}}
      transition={{
        default: {type: 'spring', stiffness: 400, damping: 25},
        boxShadow: {type: 'tween', duration: 0.15},
      }}
      style={{
        position: 'relative',
        borderRadius: `${borderRadius ?? RADIUS.xl}px`,
        border: variant === 'minimal'
          ? 'none'
          : `2px solid ${isSelected ? colors.border : 'transparent'}`,
        background: COLORS.surface,
        boxShadow: variant === 'minimal'
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
          alt=""
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

    </motion.button>
  );
}
