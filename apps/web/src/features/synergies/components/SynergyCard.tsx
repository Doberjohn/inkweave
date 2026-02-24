import {useState, useMemo, memo} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from '../../cards';
import type {SynergyStrength} from '../types';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS} from '../../../shared/constants';
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
    [/\bat a location\b/i, 'At Location'],
    [/\bmove.*location\b/i, 'Move'],
    [/\bplay.*location\b/i, 'Play Trigger'],
    [/\bhave a location\b/i, 'Location Check'],
    [/\bsearch.*location|tutor/i, 'Tutor'],
    [/\blocations? (gain|get)|buff.*location/i, 'Location Buff'],
    [/\bLocation\b/, 'Location'],
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

export const SynergyCard = memo(function SynergyCard({card, explanation}: SynergyCardProps) {
  const colors = INK_COLORS[card.ink];
  const {isMobile} = useResponsive();
  const {previewHandlers} = useCardPreviewHandlers({card});
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgSrc = card.thumbnailUrl || card.imageUrl;
  const reasonTag = useMemo(() => extractReasonTag(explanation), [explanation]);

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
          cursor: 'pointer',
          overflow: 'hidden',
          aspectRatio: '0.72',
          padding: 0,
          width: '100%',
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

        {/* Bottom overlay: card name + reason tag */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 8px 6px',
            background:
              'linear-gradient(transparent, rgba(13, 13, 20, 0.85) 30%, rgba(13, 13, 20, 0.95))',
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
          }}>
          <span
            style={{
              fontSize: `${FONT_SIZES.base}px`,
              fontWeight: 600,
              color: COLORS.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}>
            {card.name}
          </span>
          <span
            data-testid="reason-tag"
            title={explanation}
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              color: COLORS.textMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}>
            {reasonTag}
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
