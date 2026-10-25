import {useState, type MouseEvent} from 'react';
import type {LorcanaCard} from '../../cards';
import {cardPath} from 'inkweave-synergy-engine/card';
import {smallImageUrl} from '../../cards';
import {INK_COLORS, COLORS, CARD_TILE_GLOW, FONT_SIZES, RADIUS, SPACING, hexRgba} from '../../../shared/constants';
import {useArtLoad} from '../../../shared/hooks/useArtLoad';
import {CardLightbox, InkCardPlaceholder, StrengthBadge} from '../../../shared/components';
import {isModifiedClick} from '../../../shared/utils/touchGuard';
import {getStrengthTier} from '../utils';

interface SynergyCardProps {
  card: LorcanaCard;
  score: number;
  explanation: string;
  isMobile?: boolean;
  /** Compact tile styling for narrow grids (e.g. CardOverviewModal mockup): neutral border,
   *  smaller corner radius. Default false. */
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
  // The tile's aria-label replaces its content, so it repeats the badge's text: named by the card
  // alone, the tile hid its strength from screen readers and failed label-in-name (WCAG 2.5.3).
  const badge = badgeText(tier, score, isMobile);
  const colors = INK_COLORS[card.ink];
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Rendered as a real <a href> so the synergy graph is crawlable (issue #486). Plain
  // left-click is intercepted for the in-app behavior (onCardClick — modal comparison or
  // page navigation); modified/middle-clicks fall through to the native link and open the
  // partner's card page in a new tab.
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isModifiedClick(e)) return; // let the browser open the partner's card page in a new tab
    // No touch guard here: a tap's own click lands inside isSyntheticMouseEvent's window, so a
    // guard dropped every tap on touch screens 768px and wider (#843), as it did on CardTile (#296).
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
        href={cardPath(card)}
        data-roving-item
        data-card-id={card.id}
        tabIndex={tabIndex}
        onClick={handleClick}
        aria-label={`${card.fullName}, ${badge}`}
        style={{
          // The gold glow while pointed at or focused (`.card-tile`, index.css).
          ...CARD_TILE_GLOW,
          position: 'relative',
          // Mockup `.mini-tile` (its 5px radius on the scale's next step, #962) + neutral var(--border).
          // Wider contexts get the inkier 8px tinted border.
          borderRadius: `${compact ? RADIUS.md : RADIUS.lg}px`,
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
        <CardImageOrFallback card={card} colors={colors} />
        <StrengthBadgeOverlay tier={tier} text={badge} explanation={explanation} isMobile={isMobile} />
      </a>
      <MaybeLightbox card={card} lightboxOpen={lightboxOpen} setLightboxOpen={setLightboxOpen} />
    </div>
  );
}

function CardImageOrFallback({card, colors}: {card: LorcanaCard; colors: typeof INK_COLORS[keyof typeof INK_COLORS]}) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = smallImageUrl(card);
  const {loaded: imgLoaded, transition, artProps} = useArtLoad(imgSrc);

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
      {!imgLoaded && <InkCardPlaceholder ink={card.ink} ink2={card.ink2} />}
      <img
        src={imgSrc}
        alt={card.fullName}
        loading="lazy"
        decoding="async"
        {...artProps}
        onError={() => setImgError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: imgLoaded ? 1 : 0,
          transition,
        }}
      />
    </>
  );
}

/** The badge's text, which the tile's name repeats. Phones show the short tier label. */
function badgeText(
  tier: ReturnType<typeof getStrengthTier>,
  score: number,
  isMobile: boolean,
): string {
  return `${isMobile ? tier.shortLabel : tier.label} ${score}`;
}

interface StrengthBadgeOverlayProps {
  tier: ReturnType<typeof getStrengthTier>;
  text: string;
  explanation: string;
  isMobile: boolean;
}

function StrengthBadgeOverlay({tier, text, explanation, isMobile}: StrengthBadgeOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: isMobile
          ? `${SPACING.sm}px ${SPACING.xs}px ${SPACING.xs}px`
          : `${SPACING.md}px ${SPACING.sm}px ${SPACING.xs}px`,
        background: `linear-gradient(transparent, ${hexRgba(COLORS.background, 0.85)} 30%, ${hexRgba(COLORS.background, 0.95)})`,
        display: 'flex',
        alignItems: 'center',
      }}>
      <StrengthBadge tier={tier} size="sm" testId="reason-tag" title={explanation}>
        {text}
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
      card={card}
      ink={card.ink}
      ink2={card.ink2}
      onClose={() => setLightboxOpen(false)}
    />
  );
}
