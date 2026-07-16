import {useState, type MouseEvent} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {LorcanaCard} from '../../cards';
import {smallImageUrl} from '../../cards';
import {INK_COLORS, COLORS, EASING, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {CardLightbox, StrengthBadge} from '../../../shared/components';
import {isSyntheticMouseEvent, isModifiedClick} from '../../../shared/utils/touchGuard';
import {getStrengthTier} from '../utils';

interface SynergyCardProps {
  card: LorcanaCard;
  score: number;
  explanation: string;
  isMobile?: boolean;
  /** Compact tile styling for narrow grids (e.g. CardOverviewModal mockup): neutral border,
   *  no "View details" hover cue, smaller corner radius. Default false. */
  compact?: boolean;
  onCardClick?: (card: LorcanaCard) => void;
  /** Override tabIndex for roving tabindex grid navigation */
  tabIndex?: number;
}

export function SynergyCard({
  card,
  score,
  explanation,
  isMobile = false,
  compact = false,
  onCardClick,
  tabIndex,
}: SynergyCardProps) {
  const tier = getStrengthTier(score);
  const colors = INK_COLORS[card.ink];
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Rendered as a real <a href> so the synergy graph is crawlable (issue #486). Plain
  // left-click is intercepted for the in-app behavior (onCardClick — modal comparison or
  // page navigation); modified/middle-clicks fall through to the native link and open the
  // partner's card page in a new tab.
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isModifiedClick(e)) return; // let the browser open the partner's card page in a new tab
    // Touch devices fire a synthetic mouse event after touch — suppress the desktop-only path.
    if (!isMobile && isSyntheticMouseEvent()) {
      e.preventDefault();
      return;
    }
    if (onCardClick) {
      e.preventDefault();
      onCardClick(card);
      return;
    }
    if (isMobile && card.imageUrl) {
      e.preventDefault();
      setLightboxOpen(true);
    }
    // Otherwise let the <a href> navigate to the card's page.
  };

  return (
    <div>
      <a
        className="card-tile"
        href={`/card/${card.id}`}
        data-roving-item
        data-card-id={card.id}
        tabIndex={tabIndex}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={card.fullName || ''}
        style={{
          position: 'relative',
          // Mockup `.mini-tile`: 5px radius + neutral var(--border). Wider contexts get the inkier 8px tinted border.
          borderRadius: `${compact ? RADIUS.sm + 1 : RADIUS.lg}px`,
          border: `1px solid ${compact ? COLORS.surfaceBorder : `${colors.border}40`}`,
          background: COLORS.surface,
          cursor: 'pointer',
          overflow: 'hidden',
          aspectRatio: '0.72',
          padding: 0,
          width: '100%',
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
        }}>
        <ViewDetailsHoverCue isMobile={isMobile} compact={compact} hovered={hovered} />
        <CardImageOrFallback card={card} colors={colors} />
        <StrengthBadgeOverlay tier={tier} score={score} explanation={explanation} isMobile={isMobile} />
      </a>
      <MaybeLightbox card={card} lightboxOpen={lightboxOpen} setLightboxOpen={setLightboxOpen} />
    </div>
  );
}

function ViewDetailsHoverCue({isMobile, compact, hovered}: {isMobile: boolean; compact: boolean; hovered: boolean}) {
  if (isMobile || compact) return null;
  return (
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
        transition: `opacity 0.2s ${EASING.snappy}`,
        zIndex: 2,
        pointerEvents: 'none',
      }}>
      View details
    </span>
  );
}

function CardImageOrFallback({card, colors}: {card: LorcanaCard; colors: typeof INK_COLORS[keyof typeof INK_COLORS]}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgSrc = smallImageUrl(card);

  if (!imgSrc || imgError) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: colors.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <span style={{fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 600, color: colors.text}}>{card.cost}</span>
      </div>
    );
  }
  return (
    <>
      {!imgLoaded && (
        <Skeleton
          width="100%"
          height="100%"
          borderRadius={0}
          baseColor={COLORS.surfaceAlt}
          highlightColor={COLORS.surfaceHover}
          style={{position: 'absolute', inset: 0, display: 'block'}}
        />
      )}
      <img
        src={imgSrc}
        alt={card.fullName}
        loading="lazy"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: imgLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />
    </>
  );
}

interface StrengthBadgeOverlayProps {
  tier: ReturnType<typeof getStrengthTier>;
  score: number;
  explanation: string;
  isMobile: boolean;
}

function StrengthBadgeOverlay({tier, score, explanation, isMobile}: StrengthBadgeOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: isMobile ? '10px 4px 4px' : '12px 6px 5px',
        background: 'linear-gradient(transparent, rgba(13, 13, 20, 0.85) 30%, rgba(13, 13, 20, 0.95))',
        display: 'flex',
        alignItems: 'center',
      }}>
      <StrengthBadge tier={tier} size="sm" testId="reason-tag" title={explanation}>
        {isMobile ? tier.shortLabel : tier.label} {score}
      </StrengthBadge>
    </div>
  );
}

function MaybeLightbox({card, lightboxOpen, setLightboxOpen}: {card: LorcanaCard; lightboxOpen: boolean; setLightboxOpen: (open: boolean) => void}) {
  if (!lightboxOpen || !card.imageUrl) return null;
  return (
    <CardLightbox
      src={card.imageUrl}
      alt={card.fullName}
      isLocation={card.type === 'Location'}
      onClose={() => setLightboxOpen(false)}
    />
  );
}
