import {useState, memo} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from '../../cards';
import type {SynergyStrength} from '../types';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS, STRENGTH_STYLES} from '../../../shared/constants';
import {CardLightbox} from '../../../shared/components';
import {useCardPreviewHandlers} from '../../cards';
import {useResponsive} from '../../../shared/hooks';

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
  const {isMobile} = useResponsive();
  const {previewHandlers} = useCardPreviewHandlers({card});
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgSrc = card.thumbnailUrl || card.imageUrl;

  return (
    <div>
      {/* Card tile with integrated name + reason overlay */}
      <motion.button
        {...(isMobile ? {} : previewHandlers)}
        onClick={isMobile && card.imageUrl ? () => setLightboxOpen(true) : undefined}
        aria-label={card.fullName || ''}
        whileHover={{scale: 1.04, y: -3}}
        whileTap={{scale: 0.97}}
        transition={{type: 'spring', stiffness: 400, damping: 25}}
        style={{
          position: 'relative',
          borderRadius: `${RADIUS.lg}px`,
          border: `1px solid ${colors.border}40`,
          background: COLORS.surface,
          cursor: 'default',
          overflow: 'hidden',
          aspectRatio: '0.72',
          padding: 0,
          width: '100%',
        }}>
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

        {/* Bottom overlay: strength badge only */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 6px 5px',
            background:
              'linear-gradient(transparent, rgba(13, 13, 20, 0.85) 30%, rgba(13, 13, 20, 0.95))',
            display: 'flex',
            alignItems: 'center',
          }}>
          <span
            data-testid="reason-tag"
            title={explanation}
            style={{
              background: STRENGTH_STYLES[strength].bg,
              color: STRENGTH_STYLES[strength].text,
              padding: '1px 6px',
              borderRadius: `${RADIUS.sm}px`,
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 600,
              textTransform: 'capitalize',
              lineHeight: 1.4,
            }}>
            {strength}
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
