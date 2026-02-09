import {useState, memo} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from '../../cards';
import type {SynergyStrength} from '../types';
import {
  INK_COLORS,
  STRENGTH_STYLES,
  COLORS,
  FONT_SIZES,
  RADIUS,
} from '../../../shared/constants';
import {useCardPreviewHandlers} from '../../cards';

interface SynergyCardProps {
  card: LorcanaCard;
  strength: SynergyStrength;
  explanation: string;
}

export const SynergyCard = memo(function SynergyCard({
  card,
  strength,
  explanation,
}: SynergyCardProps) {
  const colors = INK_COLORS[card.ink];
  const strengthStyle = STRENGTH_STYLES[strength];
  const {previewHandlers} = useCardPreviewHandlers({card});
  const [imgError, setImgError] = useState(false);
  const imgSrc = card.thumbnailUrl || card.imageUrl;

  return (
    <motion.div
      {...previewHandlers}
      whileHover={{scale: 1.04, y: -3}}
      whileTap={{scale: 0.97}}
      transition={{type: 'spring', stiffness: 400, damping: 25}}
      style={{
        position: 'relative',
        borderRadius: `${RADIUS.lg}px`,
        border: `1px solid ${colors.border}40`,
        background: COLORS.surface,
        cursor: 'pointer',
        overflow: 'hidden',
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

      {/* Strength badge - top right */}
      <span
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          background: strengthStyle.bg,
          color: strengthStyle.text,
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: `${FONT_SIZES.xs}px`,
          fontWeight: 600,
          textTransform: 'capitalize',
          border: `1px solid ${strengthStyle.text}40`,
        }}>
        {strength}
      </span>

      {/* Name + explanation overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
          padding: '20px 6px 5px',
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
        <span
          style={{
            fontSize: `${FONT_SIZES.xs}px`,
            color: 'rgba(255,255,255,0.6)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.2,
            marginTop: '2px',
          }}>
          {explanation}
        </span>
      </div>
    </motion.div>
  );
});
