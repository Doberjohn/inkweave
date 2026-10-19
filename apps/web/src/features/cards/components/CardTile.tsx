import {useState, type CSSProperties, type MouseEvent, type ReactNode} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {CardPrinting} from 'inkweave-synergy-engine';
import type {LorcanaCard} from '../types';
import {
  INK_COLORS,
  COLORS,
  CARD_TILE_RING,
  EASING,
  FONT_SIZES,
  RADIUS,
  blackRgba,
  whiteRgba,
} from '../../../shared/constants';
import {printingAlt} from '../../../shared/hooks/usePrintingSelection';
import {PROMO_RARITY, isChaseRarity, smallImageUrl} from '../loader';
import {isModifiedClick} from '../../../shared/utils/touchGuard';
import {preloadCardOverviewModal} from '../../../shared/contexts/cardOverviewModalLoader';

type InkColors = (typeof INK_COLORS)[keyof typeof INK_COLORS];

interface CardTileProps {
  card: LorcanaCard;
  /** @deprecated Use onSelect instead. Accepts the card directly, avoiding per-item closures. */
  onClick?: () => void;
  /** Stable callback. Receives the card, so parent doesn't need per-item closures. */
  onSelect?: (card: LorcanaCard) => void;
  /**
   * Selection contexts (deck builder, voting) pass it, and the tile is a toggle,
   * announced with aria-pressed. Omit it where a click opens the card (the binder),
   * or every tile reads as "toggle button, not pressed".
   */
  isSelected?: boolean;
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
  /**
   * A printing whose art the tile shows instead of the card's own: Browse, while
   * that printing's rarity is picked (owner, 2026-10-08). The tile is still the card.
   */
  printing?: CardPrinting;
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
    ...CARD_TILE_RING,
    position: 'relative',
    borderRadius: `${borderRadius ?? RADIUS.xl}px`,
    border: minimal ? 'none' : `2px solid ${isSelected ? colors.border : 'transparent'}`,
    boxShadow: minimal
      ? `0 0 0 1px ${whiteRgba(0.1)}, 0 25px 50px -12px ${blackRgba(0.5)}`
      : isSelected
        ? `0 0 8px ${colors.border}60`
        : `0 2px 6px ${blackRgba(0.3)}`,
    cursor: 'pointer',
    padding: 0,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: '0.72',
  };
}

/**
 * What the tile is called: the card, or the printing it shows ("Elsa - Snow Queen, Enchanted
 * printing"). A card that is itself a printing is named as that printing too: the binder holds
 * each printing as a pocket of its own, under its base card's name. That is a card of a
 * chase rarity, or a collection card with a `baseId`, which covers a printing that keeps its
 * base card's rarity ("Violet Parr - Super Resilient, Alt foil printing", #796, #802).
 */
function tileName(card: LorcanaCard, printing: CardPrinting | undefined): string {
  if (printing) return printingAlt(card, printing);
  if (isChaseRarity(card.rarity) || card.baseId !== undefined) {
    // A promo's card is in its promo set (`printingCard`, #805), whose code it is named by: 25/P1.
    const promoGrouping = card.rarity === PROMO_RARITY ? card.setCode : undefined;
    const {setNumber: number, finish, artVariant} = card;
    return printingAlt(card, {rarity: card.rarity, number, promoGrouping, finish, artVariant});
  }
  return card.fullName || card.name;
}

/** Artwork (the card's, or a printing's) with a load skeleton, falling back to the ink-tinted cost badge on error/no src. */
function CardTileImage({
  art,
  name,
  cost,
  colors,
  useSmall,
  priority,
}: {
  art: Pick<LorcanaCard, 'id' | 'imageUrl' | 'imageHashSm'>;
  /** The image's alt text (`tileName`). */
  name: string;
  /** Shown on the fallback badge. */
  cost: number;
  colors: InkColors;
  useSmall?: boolean;
  priority?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgSrc = useSmall ? smallImageUrl(art) : art.imageUrl;
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
          {cost}
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
        alt={name}
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
      onPointerEnter={preloadCardOverviewModal}
      onFocus={preloadCardOverviewModal}
      aria-label={label}
      style={{...style, display: 'block', textDecoration: 'none', color: 'inherit'}}>
      {children}
    </a>
  );
}

/**
 * The `<button>` variant: a toggle (aria-pressed) where a selection context passes
 * `isSelected` (deck builder, voting), a plain button where a click opens the card.
 */
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
  isSelected: boolean | undefined;
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
  printing,
}: CardTileProps) {
  const colors = INK_COLORS[card.ink];
  const name = tileName(card, printing);
  const label = name || 'View card details';
  const tileStyle = buildTileStyle(colors, variant, isSelected === true, borderRadius);
  const image = (
    <CardTileImage
      // Keyed by the art shown, so a printing whose image failed once does not keep the
      // card's own art on its fallback after the pick changes.
      key={(printing ?? card).id}
      art={printing ?? card}
      name={name}
      cost={card.cost}
      colors={colors}
      useSmall={useSmall}
      priority={priority}
    />
  );

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
