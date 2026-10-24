import {useId, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import Skeleton from 'react-loading-skeleton';
import {
  COLORS,
  EASING,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  VISUALLY_HIDDEN,
  Z_INDEX,
  blackRgba,
  hexRgba,
} from '../../../shared/constants';
import {CtaButton} from '../../../shared/components';
import {useContainerWidth, useTooltip} from '../../../shared/hooks';

/** Where a playstyle's mechanic tiles stand: loading, failed to load, or loaded (#930). */
export type RoleTilesStatus = 'loading' | 'failed' | 'loaded';

export interface RoleTile {
  role: string;
  label: string;
  description: string;
  count: number;
}

export interface RoleTileRowProps {
  tiles: RoleTile[];
  activeRoles: ReadonlySet<string>;
  onToggle: (role: string) => void;
  /**
   * Render each tile's description inline. Default true (the mobile MechanicsBottomSheet
   * has vertical room and no hover). The desktop inline row passes false: tiles are
   * compact and the description surfaces in a hover/focus tooltip instead.
   */
  showDescriptions?: boolean;
  /**
   * 'carousel' (default): a horizontal fixed-width row that collapses to a show-more
   * cell and scrolls. 'grid': a vertical-scrolling 2-column grid (the mobile sheet),
   * fitting more tiles at once without horizontal scrolling.
   */
  layout?: 'carousel' | 'grid';
}

const TILE_WIDTH = 190;
const TILE_GAP = 10;
/** Width one fixed-width cell occupies in the row (tile + the gap before it). */
const CELL_WIDTH = TILE_WIDTH + TILE_GAP;
/** Cap a single row at 8 cells (7 tiles + a show-more cell, or 8 tiles outright). */
const MAX_VISIBLE_TILES = 8;
/**
 * Below this many fitting cells the collapse isn't worth it (≤1 real tile + a
 * show-more cell reads as broken), so narrow containers — e.g. the mobile
 * MechanicsBottomSheet — just scroll the full set instead of collapsing.
 */
const MIN_COLLAPSE_CELLS = 3;
const ROW_MAX_WIDTH = MAX_VISIBLE_TILES * TILE_WIDTH + (MAX_VISIBLE_TILES - 1) * TILE_GAP;
/** The row's padding: room around the tiles for the focus ring, and below them for the scrollbar track. */
const ROW_PADDING = {top: 2, side: 2, bottom: 10};
/** Tile height with the description shown vs the compact (label + count only) form. */
const TILE_MIN_HEIGHT_FULL = 120;
const TILE_MIN_HEIGHT_COMPACT = 76;

/**
 * How many fixed-width cells fit in the measured content width, clamped to
 * MAX_VISIBLE_TILES. Returns 0 until measured (width 0) so the caller defaults
 * to the never-clip scroll path.
 */
function cellCapacity(width: number): number {
  if (width <= 0) return 0;
  const fits = Math.floor((width + TILE_GAP) / CELL_WIDTH);
  return Math.min(MAX_VISIBLE_TILES, Math.max(1, fits));
}

/** Sort tiles by count descending, breaking ties alphabetically by label. */
function compareTiles(a: RoleTile, b: RoleTile): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

interface RowLayout {
  collapsed: boolean;
  visibleTiles: RoleTile[];
  hiddenCount: number;
}

/**
 * Derive the row layout from the measured capacity. Collapse to (capacity − 1)
 * tiles + a show-more cell only when the container fits a sensible row AND there
 * are more tiles than fit; otherwise show every tile (the never-clip scroll
 * path). The show-more cell is always the last *visible* cell, so it can never
 * be clipped behind hidden overflow.
 */
function computeRowLayout(
  sortedTiles: RoleTile[],
  capacity: number,
  expanded: boolean,
): RowLayout {
  const needsShowMore = capacity >= MIN_COLLAPSE_CELLS && sortedTiles.length > capacity;
  const collapsed = needsShowMore && !expanded;
  const collapsedTileCount = capacity - 1;
  return {
    collapsed,
    visibleTiles: collapsed ? sortedTiles.slice(0, collapsedTileCount) : sortedTiles,
    hiddenCount: sortedTiles.length - collapsedTileCount,
  };
}

/** Section style — collapsed is a static clipped row; expanded scrolls (scroll-snap). */
function getSectionStyle({collapsed, centered}: {collapsed: boolean; centered: boolean}): React.CSSProperties {
  return {
    display: 'flex',
    gap: TILE_GAP,
    // Center when every tile fits; flex-start when the row scrolls, so the
    // overflowing leading tiles stay reachable from the start.
    justifyContent: centered ? 'center' : 'flex-start',
    overflowX: collapsed ? 'hidden' : 'auto',
    scrollSnapType: collapsed ? undefined : 'x proximity',
    maxWidth: ROW_MAX_WIDTH,
    margin: '0 auto 28px',
    padding: `${ROW_PADDING.top}px ${ROW_PADDING.side}px ${ROW_PADDING.bottom}px`,
  };
}

/** Grid style — a vertical-scrolling 2-column grid, used by the mobile bottom sheet. */
function getGridStyle(): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: TILE_GAP,
    padding: '2px',
    margin: '0 0 8px',
  };
}

/**
 * A playstyle's mechanic tiles. When every tile fits the measured width they
 * show in a static row. When there are more than fit, the row collapses to
 * (capacity − 1) tiles + a "show more" cell; clicking it reveals the rest and
 * turns the row into a smooth horizontal scroll carousel (scroll-snap + subtle
 * scrollbar). Narrow containers (capacity < 3, e.g. mobile) skip the collapse
 * and just scroll, so the reveal cell is never clipped behind hidden overflow.
 * Each tile toggles a role filter.
 */
export function RoleTileRow({
  tiles,
  activeRoles,
  onToggle,
  showDescriptions = true,
  layout = 'carousel',
}: RoleTileRowProps) {
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const width = useContainerWidth(sectionRef);

  if (tiles.length === 0) return null;

  const sortedTiles = [...tiles].sort(compareTiles);
  const tileMinHeight = showDescriptions ? TILE_MIN_HEIGHT_FULL : TILE_MIN_HEIGHT_COMPACT;

  // Grid: every tile in a vertical-scrolling 2-column grid (the mobile sheet).
  if (layout === 'grid') {
    return (
      <section aria-label="Mechanics" style={getGridStyle()}>
        {sortedTiles.map((t) => (
          <RoleTileButton
            key={t.role}
            tile={t}
            active={activeRoles.has(t.role)}
            onToggle={onToggle}
            showDescription={showDescriptions}
            minHeight={tileMinHeight}
            fill
          />
        ))}
      </section>
    );
  }

  const capacity = cellCapacity(width);
  const {collapsed, visibleTiles, hiddenCount} = computeRowLayout(sortedTiles, capacity, expanded);
  // Center whenever the row is static: everything fits, OR it's the collapsed
  // capacity row. Only the expanded scroll carousel uses flex-start, so its leading
  // tiles stay reachable from the start.
  const centered = collapsed || (width > 0 && sortedTiles.length <= capacity);

  return (
    <section
      ref={sectionRef}
      aria-label="Mechanics"
      // Carousel scrolls unless collapsed; collapsed is a static, exactly-fitting row.
      className={collapsed ? undefined : 'subtle-scrollbar'}
      style={getSectionStyle({collapsed, centered})}>
      {visibleTiles.map((t) => (
        <RoleTileButton
          key={t.role}
          tile={t}
          active={activeRoles.has(t.role)}
          onToggle={onToggle}
          showDescription={showDescriptions}
          minHeight={tileMinHeight}
        />
      ))}
      {collapsed && (
        <ShowMoreTile hiddenCount={hiddenCount} minHeight={tileMinHeight} onClick={() => setExpanded(true)} />
      )}
    </section>
  );
}

/**
 * A playstyle's mechanic tiles in the state they stand in (#930): their placeholder while they
 * load, a line saying they failed with a Try again that loads them alone, or the tiles.
 */
export function RoleTiles({
  status,
  onRetry,
  ...row
}: RoleTileRowProps & {status: RoleTilesStatus; onRetry: () => void}) {
  if (status === 'loading') {
    return row.layout === 'grid' ? <RoleTileGridSkeleton /> : <RoleTileRowSkeleton />;
  }
  if (status === 'failed') return <RoleTilesFailed layout={row.layout} onRetry={onRetry} />;
  return <RoleTileRow {...row} />;
}

/**
 * The loaded compact row's box: its padding within the same width, so as many tiles fit, and a
 * compact tile's height inside that padding before the row has measured any tile.
 */
function rowBoxStyle(): React.CSSProperties {
  return {
    ...getSectionStyle({collapsed: true, centered: true}),
    height: ROW_PADDING.top + TILE_MIN_HEIGHT_COMPACT + ROW_PADDING.bottom,
  };
}

/**
 * The compact row's place while a playstyle's cards load (#914): the row's box, holding as many
 * tile placeholders as the loaded row fits across, so what follows starts where it will.
 */
function RoleTileRowSkeleton() {
  const rowRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(rowRef);
  return (
    <div ref={rowRef} aria-hidden="true" style={rowBoxStyle()}>
      {Array.from({length: cellCapacity(width)}, (_, i) => (
        <Skeleton
          key={i}
          inline
          width={TILE_WIDTH}
          height={TILE_MIN_HEIGHT_COMPACT}
          borderRadius={RADIUS.lg}
          style={{display: 'block', flexShrink: 0}}
        />
      ))}
    </div>
  );
}

/** The sheet grid's place while its tiles load again (#930): two rows of tile placeholders. */
function RoleTileGridSkeleton() {
  return (
    <div aria-hidden="true" style={getGridStyle()}>
      {Array.from({length: 4}, (_, i) => (
        <Skeleton
          key={i}
          inline
          height={TILE_MIN_HEIGHT_FULL}
          borderRadius={RADIUS.lg}
          style={{display: 'block'}}
        />
      ))}
    </div>
  );
}

/**
 * The tiles' place when they failed to load and the cards did not (#930): what happened, and a
 * Try again. In the row it keeps the row's box, as the placeholder does, so the cards below stay
 * put through the retry. An alert, as the binder's failure is (#790): it takes the place of tiles
 * the reader was waiting for.
 */
function RoleTilesFailed({
  onRetry,
  layout,
}: {
  onRetry: () => void;
  layout: RoleTileRowProps['layout'];
}) {
  const box = layout === 'grid' ? {padding: `${SPACING.xxl}px 0`} : rowBoxStyle();
  return (
    <div
      style={{
        ...box,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.md,
      }}>
      <p role="alert" style={{margin: 0, color: COLORS.textMuted, fontSize: `${FONT_SIZES.lg}px`}}>
        Couldn&apos;t load this playstyle&apos;s mechanics.
      </p>
      <CtaButton variant="ghost" onClick={onRetry}>
        Try again
      </CtaButton>
    </div>
  );
}

/**
 * Interaction + layout inputs for a single role tile's style, grouped into one options
 * object so the style helpers take a typed shape rather than a run of positional booleans
 * and numbers (keeps the shared active/hovered/minHeight/fill state consistent between them).
 */
interface RoleTileButtonOptions {
  active: boolean;
  hovered: boolean;
  minHeight: number;
  fill: boolean;
}

/** Compute box-shadow for the tile based on active/hover state. */
function tileBoxShadow({active, hovered}: Pick<RoleTileButtonOptions, 'active' | 'hovered'>): string {
  if (active) return `0 0 0 1px ${COLORS.primaryMuted}, 0 0 18px ${hexRgba(COLORS.primary500, 0.18)}`;
  if (hovered) return `0 4px 12px ${blackRgba(0.4)}`;
  return 'none';
}

/** Compute the full button style for a RoleTile based on its interaction state. */
function getRoleTileButtonStyle({active, hovered, minHeight, fill}: RoleTileButtonOptions): React.CSSProperties {
  return {
    position: 'relative',
    // Grid cells fill their column; carousel cells are fixed-width and scroll-snap.
    ...(fill
      ? {width: '100%'}
      : {flex: `0 0 ${TILE_WIDTH}px`, scrollSnapAlign: 'start' as const}),
    background: active || hovered ? COLORS.surface : COLORS.surfaceAlt,
    border: `1px solid ${active || hovered ? COLORS.primaryMuted : COLORS.surfaceBorder}`,
    borderRadius: RADIUS.lg,
    padding: '14px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    color: COLORS.text,
    fontFamily: FONTS.body,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight,
    transition: `transform 0.15s ${EASING.snappy}, border-color 0.15s ${EASING.snappy}, background 0.15s ${EASING.snappy}, box-shadow 0.2s ${EASING.snappy}`,
    transform: hovered && !active ? 'translateY(-1px)' : 'translateY(0)',
    boxShadow: tileBoxShadow({active, hovered}),
  };
}

/** Viewport-fixed anchor point (tile-center x, tile-bottom y) the tooltip is positioned at. */
interface TooltipAnchor {
  left: number;
  top: number;
}

/** Where the tooltip sits for the moment before it measures its tile. */
const UNMEASURED: TooltipAnchor = {left: -9999, top: -9999};

interface RoleTileTooltipProps {
  /** The tile's button, measured as the tooltip opens. */
  tileRef: RefObject<HTMLButtonElement | null>;
  text: string;
  /** The tooltip's id, role and pointer handlers, from the tile's `useTooltip`. */
  tooltipProps: ReturnType<typeof useTooltip>['tooltipProps'];
}

/**
 * The description tooltip, portaled to <body> so it escapes the carousel's
 * overflow clip and sits above modal layers. Positioned (viewport-fixed) centered
 * under the tile that opened it, measured each time it opens. It takes the pointer, so it
 * renders beside the tile's button rather than inside it: a portal's events bubble through
 * the React tree, and a click on it would otherwise toggle the tile.
 */
function RoleTileTooltip({tileRef, text, tooltipProps}: RoleTileTooltipProps) {
  const [anchor, setAnchor] = useState(UNMEASURED);

  useLayoutEffect(() => {
    const r = tileRef.current?.getBoundingClientRect();
    if (r) setAnchor({left: r.left + r.width / 2, top: r.bottom + 8});
  }, [tileRef]);

  return createPortal(
    <div
      {...tooltipProps}
      style={{
        position: 'fixed',
        left: anchor.left,
        top: anchor.top,
        transform: 'translateX(-50%)',
        maxWidth: 220,
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        padding: '8px 12px',
        fontSize: `${FONT_SIZES.md}px`,
        lineHeight: 1.4,
        color: COLORS.descriptionText,
        fontFamily: FONTS.body,
        textAlign: 'center',
        boxShadow: `0 6px 20px ${blackRgba(0.5)}`,
        zIndex: Z_INDEX.popover,
      }}>
      {text}
    </div>,
    document.body,
  );
}

/**
 * A single mechanic tile: label + a corner count badge, toggling its role filter
 * on click. The count is a top-right badge (not inline with the label) so a long,
 * wrapping label stays centered without dragging the number around. When
 * `showDescription` is false the description is revealed in a hover/focus tooltip.
 * Either way the description describes the tile (`aria-describedby`): the tooltip's while it
 * shows, else the inline one, which a direct reference still reads though it's aria-hidden.
 *
 * Its accessible name ("Boost, 54 cards") is one screen-reader-only line, and the visible
 * parts are hidden from screen readers. An aria-label must contain the tile's visible text
 * (WCAG 2.5.3, axe's label-content-name-mismatch), which the badge and description break,
 * and a hidden ", 54 cards" after the visible label reads "Boost , 54 cards" in Chrome.
 */
function RoleTileButton({
  tile,
  active,
  onToggle,
  showDescription,
  minHeight,
  fill = false,
}: {
  tile: RoleTile;
  active: boolean;
  onToggle: (role: string) => void;
  showDescription: boolean;
  minHeight: number;
  fill?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  // The description is inline when shown, so only the compact tile has a tooltip.
  const tip = useTooltip({disabled: showDescription});
  const accent = active ? COLORS.primaryMuted : undefined;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => onToggle(tile.role)}
        {...tip.triggerProps}
        onMouseEnter={() => {
          setHovered(true);
          tip.triggerProps.onMouseEnter();
        }}
        onMouseLeave={() => {
          setHovered(false);
          tip.triggerProps.onMouseLeave();
        }}
        aria-pressed={active}
        aria-describedby={showDescription ? descriptionId : tip.describedBy}
        style={getRoleTileButtonStyle({active, hovered, minHeight, fill})}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            fontSize: `${FONT_SIZES.md}px`,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            // Gold tint (softer than the active accent, so it reads as a count, not a selection).
            color: COLORS.primary500,
          }}>
          {tile.count}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 600,
            lineHeight: 1.2,
            color: accent ?? COLORS.text,
            textWrap: 'balance',
          }}>
          {tile.label}
        </span>
        {showDescription && (
          <p
            id={descriptionId}
            aria-hidden="true"
            style={{fontSize: `${FONT_SIZES.md}px`, color: COLORS.descriptionText, margin: '4px 0 0'}}>
            {tile.description}
          </p>
        )}
        <span style={VISUALLY_HIDDEN}>{`${tile.label}, ${tile.count} cards`}</span>
      </button>
      {tip.open && (
        <RoleTileTooltip tileRef={ref} text={tile.description} tooltipProps={tip.tooltipProps} />
      )}
    </>
  );
}

/**
 * Base style for the show-more tile — a dashed "thematic" cell that matches the
 * real tiles' footprint but reads as a reveal affordance: dashed gold border on
 * the dark dashed-tile background, brightening on hover.
 */
function getShowMoreTileStyle({hovered, minHeight}: {hovered: boolean; minHeight: number}): React.CSSProperties {
  return {
    flex: `0 0 ${TILE_WIDTH}px`,
    background: COLORS.surfaceAlt,
    border: `1px dashed ${hovered ? COLORS.primary : COLORS.gray300}`,
    borderRadius: RADIUS.lg,
    padding: '14px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: FONTS.body,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight,
    transition: `border-color 0.15s ${EASING.snappy}, background 0.15s ${EASING.snappy}, transform 0.15s ${EASING.snappy}`,
    transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
  };
}

/**
 * The dashed reveal tile shown as the last collapsed cell; clicking it expands the carousel.
 * Its accessible name ("Show more, 6 mechanics") is a screen-reader-only line too, for the
 * reason RoleTileButton gives. It starts with the visible "Show more", so a speech-input
 * user can say what the tile shows.
 */
function ShowMoreTile({hiddenCount, minHeight, onClick}: {hiddenCount: number; minHeight: number; onClick: () => void}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={getShowMoreTileStyle({hovered, minHeight})}>
      <span
        aria-hidden="true"
        style={{
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          color: COLORS.primary,
        }}>
        +{hiddenCount}
      </span>
      <span
        aria-hidden="true"
        style={{
          fontSize: `${FONT_SIZES.md}px`,
          fontWeight: 500,
          color: hovered ? COLORS.primary : COLORS.textMuted,
          transition: `color 0.15s ${EASING.snappy}`,
        }}>
        Show more ▾
      </span>
      <span style={VISUALLY_HIDDEN}>{`Show more, ${hiddenCount} mechanics`}</span>
    </button>
  );
}
