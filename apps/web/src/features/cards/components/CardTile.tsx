import {useState, type CSSProperties, type MouseEvent, type ReactNode} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {LorcanaCard} from '../types';
import {INK_COLORS, COLORS, EASING, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {smallImageUrl} from '../loader';
import {isModifiedClick} from '../../../shared/utils/touchGuard';

type InkColors = (typeof INK_COLORS)[keyof typeof INK_COLORS];

interface CardTileProps {
  card: LorcanaCard;
  /** @deprecated Use onSelect instead. Accepts the card directly, avoiding per-item closures. */
  onClick?: () => void;
  /** Stable callback. Receives the card, so parent doesn't need per-item closures. */
  onSelect?: (card: LorcanaCard) => void;
  isSelected: boolean;
  variant?: 'full' | 'minimal';
  borderRadius?: number;
  /** Set to true for above-fold LCP-candidate images to disable lazy loading and boost priority. */
  priority?: boolean;
  /** Use the smaller grid-optimized image (191×266) instead of full-size (337×470). */
  useSmallImage?: boolean;
  /** Override tabIndex for roving tabindex grid navigation */
  tabIndex?: number;
  /**
   * When set, the tile renders as a crawlable `<a href>` (issue #486) instead of a `<button>`.
   * Plain left-click is intercepted for the in-app behavior (onClick/onSelect — e.g. opens the
   * card modal); modified/middle-clicks follow the link and open the card page in a new tab.
   * Omit for selection contexts (deck builder, voting) that need `<button>` + aria-pressed.
   */
  href?: string;
}

/** Border + shadow depend on variant/selection; hoisted out of the component to keep its CC low. */
function buildTileStyle(
  colors: InkColors,
  variant: 'full' | 'minimal',
  isSelected: boolean,
  borderRadius: number | undefined,
): CSSProperties {
  const minimal = variant === 'minimal';
  return {
    position: 'relative',
    borderRadius: `${borderRadius ?? RADIUS.xl}px`,
    border: minimal ? 'none' : `2px solid ${isSelected ? colors.border : 'transparent'}`,
    boxShadow: minimal
      ? '0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px -12px rgba(0,0,0,0.5)'
      : isSelected
        ? `0 0 8px ${colors.border}60`
        : '0 2px 6px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    padding: 0,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: '0.72',
  };
}

/** Card artwork with a load skeleton, falling back to the ink-tinted cost badge on error/no src. */
function CardTileImage({
  card,
  colors,
  useSmall,
  priority,
}: {
  card: LorcanaCard;
  colors: InkColors;
  useSmall?: boolean;
  priority?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgSrc = useSmall ? smallImageUrl(card) : card.imageUrl;
  // Above-fold LCP candidates load eagerly + decode synchronously; the rest defer (one flag, one branch).
  const {loading, decoding} = priority
    ? ({loading: 'eager', decoding: 'sync'} as const)
    : ({loading: 'lazy', decoding: 'async'} as const);

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
        <span style={{fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 600, color: colors.text}}>
          {card.cost}
        </span>
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
        className="card-tile-img"
        src={imgSrc}
        alt={card.fullName || card.name || ''}
        loading={loading}
        decoding={decoding}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: imgLoaded ? 1 : 0,
          transition: `opacity 0.2s ${EASING.smooth}`,
        }}
      />
    </>
  );
}

/** Crawlable `<a href>` variant: plain left-click runs the in-app handler, modified clicks navigate. */
function CardTileLink({
  href,
  tabIndex,
  label,
  style,
  card,
  onClick,
  onSelect,
  children,
}: {
  href: string;
  tabIndex?: number;
  label: string;
  style: CSSProperties;
  card: LorcanaCard;
  onClick?: () => void;
  onSelect?: (card: LorcanaCard) => void;
  children: ReactNode;
}) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isModifiedClick(e)) return; // let the browser open the card page in a new tab
    e.preventDefault();
    onClick?.();
    onSelect?.(card);
  };
  return (
    <a
      className="card-tile"
      data-testid="card-tile"
      data-roving-item
      href={href}
      tabIndex={tabIndex}
      onClick={handleClick}
      aria-label={label}
      style={{...style, display: 'block', textDecoration: 'none', color: 'inherit'}}>
      {children}
    </a>
  );
}

/** Selection `<button>` variant (deck builder, voting): toggles via onClick/onSelect + aria-pressed. */
function CardTileButton({
  tabIndex,
  label,
  isSelected,
  style,
  card,
  onClick,
  onSelect,
  children,
}: {
  tabIndex?: number;
  label: string;
  isSelected: boolean;
  style: CSSProperties;
  card: LorcanaCard;
  onClick?: () => void;
  onSelect?: (card: LorcanaCard) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="card-tile"
      data-testid="card-tile"
      data-roving-item
      tabIndex={tabIndex}
      onClick={() => {
        onClick?.();
        onSelect?.(card);
      }}
      aria-pressed={isSelected}
      aria-label={label}
      style={style}>
      {children}
    </button>
  );
}

export function CardTile({
  card,
  onClick,
  onSelect,
  isSelected,
  variant = 'full',
  borderRadius,
  priority,
  useSmallImage: useSmall,
  tabIndex,
  href,
}: CardTileProps) {
  const colors = INK_COLORS[card.ink];
  const label = card.fullName || card.name || 'View card details';
  const tileStyle = buildTileStyle(colors, variant, isSelected, borderRadius);
  const image = <CardTileImage card={card} colors={colors} useSmall={useSmall} priority={priority} />;

  if (href) {
    return (
      <CardTileLink
        href={href}
        tabIndex={tabIndex}
        label={label}
        style={tileStyle}
        card={card}
        onClick={onClick}
        onSelect={onSelect}>
        {image}
      </CardTileLink>
    );
  }

  return (
    <CardTileButton
      tabIndex={tabIndex}
      label={label}
      isSelected={isSelected}
      style={tileStyle}
      card={card}
      onClick={onClick}
      onSelect={onSelect}>
      {image}
    </CardTileButton>
  );
}
