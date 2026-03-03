import {useState, memo} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from '../../cards';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {CardLightbox} from '../../../shared/components';
import {useCardPreviewHandlers} from '../../cards';
import {getStrengthTier} from '../utils';

interface SynergyCardProps {
  card: LorcanaCard;
  score: number;
  explanation: string;
  isMobile?: boolean;
}

export const SynergyCard = memo(function SynergyCard({
  card,
  score,
  explanation,
  isMobile = false,
}: SynergyCardProps) {
  const tier = getStrengthTier(score);
  const colors = INK_COLORS[card.ink];
  const {previewHandlers} = useCardPreviewHandlers({card});
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const imgSrc = card.thumbnailUrl || card.imageUrl;

  return (
    <div>
      {/* Card tile with strength badge overlay */}
      <motion.button
        {...(isMobile ? {} : previewHandlers)}
        onClick={isMobile && card.imageUrl ? () => setLightboxOpen(true) : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={card.fullName || ''}
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
          padding: 0,
          width: '100%',
        }}>
        {/* "View details" hover cue — desktop only */}
        {!isMobile && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(13, 13, 20, 0.8)',
              color: COLORS.primary,
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: `${RADIUS.sm}px`,
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.2s',
              zIndex: 2,
              pointerEvents: 'none',
            }}>
            View details
          </span>
        )}

        {/* Card image or fallback */}
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={card.fullName}
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

        {/* Bottom overlay: strength badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: isMobile ? '10px 4px 4px' : '12px 6px 5px',
            background:
              'linear-gradient(transparent, rgba(13, 13, 20, 0.85) 30%, rgba(13, 13, 20, 0.95))',
            display: 'flex',
            alignItems: 'center',
          }}>
          <span
            data-testid="reason-tag"
            title={explanation}
            style={{
              background: tier.bg,
              color: tier.color,
              padding: isMobile ? '2px 6px' : '2px 7px',
              borderRadius: `${RADIUS.sm}px`,
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 600,
              lineHeight: 1.4,
            }}>
            {isMobile ? tier.shortLabel : tier.label} {score}
          </span>
        </div>
      </motion.button>

      {lightboxOpen && card.imageUrl && (
        <CardLightbox
          src={card.imageUrl}
          alt={card.fullName}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
});
