import {useState, useMemo, memo} from 'react';
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
import {CardLightbox} from '../../../shared/components';
import {useCardPreviewHandlers} from '../../cards';
import {useResponsive} from '../../../shared/hooks';

interface SynergyCardProps {
  card: LorcanaCard;
  strength: SynergyStrength;
  explanation: string;
}

/**
 * Extract a short reason tag from the full explanation.
 * e.g. "Singer keyword reduces Song cost" → "Singer"
 *      "Can Shift onto this character" → "Shift"
 *      "Evasive + quest synergy" → "Evasive"
 */
function extractReasonTag(explanation: string): string {
  // Ordered by priority — first match wins
  const patterns: [RegExp, string][] = [
    [/\bSinger\b/i, 'Singer'],
    [/\bShift\b/i, 'Shift'],
    [/\bEvasive\b/i, 'Evasive'],
    [/\bChallenger\b/i, 'Challenger'],
    [/\bWard\b/i, 'Ward'],
    [/\bBodyguard\b/i, 'Bodyguard'],
    [/\bRush\b/i, 'Rush'],
    [/\bExert\b/i, 'Exert'],
    [/\bDraw\b/i, 'Draw'],
    [/\bRamp\b|ink acceleration/i, 'Ramp'],
    [/\bDiscard\b/i, 'Discard'],
    [/\bBounce\b|return to hand/i, 'Bounce'],
    [/\bDamage\b|deal damage/i, 'Damage'],
    [/\bBanish\b/i, 'Removal'],
    [/\bPrincess\b/i, 'Princess'],
    [/\bVillain\b/i, 'Villain'],
    [/\bHero\b/i, 'Hero'],
    [/\bSong\b/i, 'Song'],
    [/\bquest\b/i, 'Quest'],
    [/same name/i, 'Same Name'],
    [/ink color/i, 'Same Ink'],
    [/cost curve/i, 'Curve'],
  ];

  for (const [pattern, tag] of patterns) {
    if (pattern.test(explanation)) return tag;
  }

  // Fallback: first two words of explanation
  const words = explanation.split(/\s+/);
  return words.slice(0, 2).join(' ');
}

export const SynergyCard = memo(function SynergyCard({
  card,
  strength,
  explanation,
}: SynergyCardProps) {
  const colors = INK_COLORS[card.ink];
  const strengthStyle = STRENGTH_STYLES[strength];
  const {isMobile} = useResponsive();
  const {previewHandlers} = useCardPreviewHandlers({card});
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgSrc = card.thumbnailUrl || card.imageUrl;
  const reasonTag = useMemo(() => extractReasonTag(explanation), [explanation]);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
      {/* Card image tile */}
      <motion.div
        {...(isMobile ? {} : previewHandlers)}
        onClick={isMobile && card.imageUrl ? () => setLightboxOpen(true) : undefined}
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
      </motion.div>

      {/* Reason tag pill */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}>
        <span
          data-testid="reason-tag"
          title={explanation}
          style={{
            background: COLORS.surfaceAlt,
            color: COLORS.textMuted,
            border: `1px solid ${COLORS.surfaceBorder}`,
            padding: '2px 8px',
            borderRadius: `${RADIUS.sm}px`,
            fontSize: `${FONT_SIZES.xs}px`,
            fontWeight: 500,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
          {reasonTag}
        </span>
      </div>

      {lightboxOpen && card.imageUrl && (
        <CardLightbox src={card.imageUrl} alt={card.fullName} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
});
