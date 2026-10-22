import {CARD_TILE_GLOW, COLORS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';

/**
 * A synergy group's "+N more" tile: a dashed, card-sized tile for the cards past the grid's
 * limit, which opens the whole group. It sits in the grid as a card does, so it lights as one
 * (the gold glow, `.synergy-more-tile` in index.css; owner, 2026-10-21) where it used to rise
 * and turn its dashes gold.
 */
export function SynergyMoreTile({
  count,
  onClick,
  isMobile,
  tabIndex,
  compact = false,
}: {
  count: number;
  onClick?: () => void;
  isMobile?: boolean;
  tabIndex?: number;
  /** Compact sizing for narrow grids (mockup `.mini-tile.more`: 13px / 9px). Default false → standard sizing. */
  compact?: boolean;
}) {
  const config = pickMoreTileConfig(compact);

  return (
    <button
      className="synergy-more-tile"
      data-testid="more-tile"
      data-roving-item
      tabIndex={tabIndex}
      onClick={onClick}
      aria-label={`Show ${count} more cards`}
      style={pickMoreTileButtonStyle({config, compact, isMobile})}>
      <span style={{fontSize: `${config.countFontSize}px`, fontWeight: 700, color: COLORS.primary500}}>
        +{count}
      </span>
      {/* The flex column never renders this space, but without it the tile's text reads "+12more
          cards", which label-in-name checks (WCAG 2.5.3) can't find in the aria-label. */}{' '}
      <span
        style={{
          fontSize: `${config.labelFontSize}px`,
          fontWeight: 500,
          color: COLORS.textMuted,
          textTransform: config.labelTextTransform,
          letterSpacing: config.labelLetterSpacing,
        }}>
        {config.labelText}
      </span>
    </button>
  );
}

interface MoreTileConfig {
  countFontSize: number;
  labelFontSize: number;
  labelText: string;
  borderRadius: number;
  labelTextTransform: 'uppercase' | undefined;
  labelLetterSpacing: string | undefined;
}

/** Single switch on `compact` returning the full visual config, in place of ten inline ternaries. */
function pickMoreTileConfig(compact: boolean): MoreTileConfig {
  if (compact) {
    return {
      countFontSize: FONT_SIZES.sm,
      labelFontSize: 9,
      labelText: 'more',
      borderRadius: RADIUS.sm + 1,
      labelTextTransform: 'uppercase',
      labelLetterSpacing: '0.06em',
    };
  }
  return {
    countFontSize: FONT_SIZES.xxl,
    labelFontSize: FONT_SIZES.xs,
    labelText: 'more cards',
    borderRadius: RADIUS.lg,
    labelTextTransform: undefined,
    labelLetterSpacing: undefined,
  };
}

interface MoreTileButtonStyleInput {
  config: MoreTileConfig;
  compact: boolean;
  isMobile?: boolean;
}

function pickMoreTileButtonStyle({config, compact, isMobile}: MoreTileButtonStyleInput): React.CSSProperties {
  return {
    // The gold glow while pointed at or focused (`.synergy-more-tile`, index.css).
    ...CARD_TILE_GLOW,
    position: 'relative',
    borderRadius: `${config.borderRadius}px`,
    overflow: 'hidden',
    aspectRatio: '0.72',
    cursor: 'pointer',
    background: COLORS.surfaceAlt,
    border: `1px dashed ${COLORS.gray300}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: pickMoreTileGap(compact, isMobile),
    width: '100%',
    padding: 0,
    fontFamily: 'inherit',
  };
}

function pickMoreTileGap(compact: boolean, isMobile?: boolean): number {
  if (compact) return SPACING.xxs;
  if (isMobile) return SPACING.xs;
  return SPACING.sm;
}
