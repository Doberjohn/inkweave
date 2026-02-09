import {useState} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from '../types';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {useCardPreviewHandlers} from './useCardPreviewHandlers';

interface CardTileProps {
  card: LorcanaCard;
  onClick: () => void;
  isSelected: boolean;
}

export function CardTile({card, onClick, isSelected}: CardTileProps) {
  const colors = INK_COLORS[card.ink];
  const {previewHandlers} = useCardPreviewHandlers({card, onTap: onClick});
  const [imgError, setImgError] = useState(false);
  const imgSrc = card.thumbnailUrl || card.imageUrl;

  return (
    <motion.button
      onClick={onClick}
      {...previewHandlers}
      aria-pressed={isSelected}
      whileHover={{scale: 1.04, y: -3}}
      whileTap={{scale: 0.97}}
      transition={{type: 'spring', stiffness: 400, damping: 25}}
      style={{
        position: 'relative',
        borderRadius: `${RADIUS.lg}px`,
        border: `2px solid ${isSelected ? colors.border : 'transparent'}`,
        background: COLORS.surface,
        boxShadow: isSelected
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

      {/* Name overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          padding: '16px 6px 5px',
        }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: `${FONT_SIZES.sm}px`,
            color: '#fff',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
          }}>
          {card.name}
        </span>
        {card.version && (
          <span
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              color: 'rgba(255,255,255,0.7)',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}>
            {card.version}
          </span>
        )}
      </div>
    </motion.button>
  );
}
