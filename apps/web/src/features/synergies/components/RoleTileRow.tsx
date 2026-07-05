import {useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {COLORS, FONTS, FONT_SIZES, Z_INDEX} from '../../../shared/constants';
import {useContainerWidth} from '../../../shared/hooks';

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

const DESCRIPTION_COLOR = '#c8c8d8';

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
function getSectionStyle(collapsed: boolean, centered: boolean): React.CSSProperties {
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
    padding: '2px 2px 10px', // room for the focus ring + scrollbar track
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
      style={getSectionStyle(collapsed, centered)}>
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

/** Compute box-shadow for the tile based on active/hover state. */
function tileBoxShadow(active: boolean, hovered: boolean): string {
  if (active) return `0 0 0 1px ${COLORS.primaryMuted}, 0 0 18px rgba(212, 175, 55, 0.18)`;
  if (hovered) return '0 4px 12px rgba(0, 0, 0, 0.4)';
  return 'none';
}

/** Compute the full button style for a RoleTile based on its interaction state. */
function getRoleTileButtonStyle(active: boolean, hovered: boolean, minHeight: number, fill: boolean): React.CSSProperties {
  return {
    position: 'relative',
    // Grid cells fill their column; carousel cells are fixed-width and scroll-snap.
    ...(fill
      ? {width: '100%'}
      : {flex: `0 0 ${TILE_WIDTH}px`, scrollSnapAlign: 'start' as const}),
    background: active || hovered ? COLORS.surface : COLORS.surfaceAlt,
    border: `1px solid ${active || hovered ? COLORS.primaryMuted : COLORS.surfaceBorder}`,
    borderRadius: 8,
    padding: '14px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    color: COLORS.text,
    fontFamily: FONTS.body,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight,
    transition:
      'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.2s ease',
    transform: hovered && !active ? 'translateY(-1px)' : 'translateY(0)',
    boxShadow: tileBoxShadow(active, hovered),
  };
}

/**
 * The description tooltip, portaled to <body> so it escapes the carousel's
 * overflow clip and sits above modal layers. Positioned (viewport-fixed) centered
 * under the tile that opened it.
 */
function RoleTileTooltip({left, top, text}: {left: number; top: number; text: string}) {
  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateX(-50%)',
        maxWidth: 220,
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: `${FONT_SIZES.md}px`,
        lineHeight: 1.4,
        color: DESCRIPTION_COLOR,
        fontFamily: FONTS.body,
        textAlign: 'center',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
        zIndex: Z_INDEX.popover,
        pointerEvents: 'none',
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
  const [tip, setTip] = useState<{left: number; top: number} | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const accent = active ? COLORS.primaryMuted : undefined;

  const openTip = () => {
    if (showDescription) return; // description is inline; no tooltip needed
    const r = ref.current?.getBoundingClientRect();
    if (r) setTip({left: r.left + r.width / 2, top: r.bottom + 8});
  };
  const closeTip = () => setTip(null);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onToggle(tile.role)}
      onMouseEnter={() => {
        setHovered(true);
        openTip();
      }}
      onMouseLeave={() => {
        setHovered(false);
        closeTip();
      }}
      onFocus={openTip}
      onBlur={closeTip}
      aria-label={`${tile.label}, ${tile.count} cards`}
      aria-pressed={active}
      style={getRoleTileButtonStyle(active, hovered, minHeight, fill)}>
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
        <p style={{fontSize: `${FONT_SIZES.md}px`, color: DESCRIPTION_COLOR, margin: '4px 0 0'}}>
          {tile.description}
        </p>
      )}
      {tip && <RoleTileTooltip left={tip.left} top={tip.top} text={tile.description} />}
    </button>
  );
}

/**
 * Base style for the show-more tile — a dashed "thematic" cell that matches the
 * real tiles' footprint but reads as a reveal affordance: dashed gold border on
 * the dark dashed-tile background, brightening on hover.
 */
function getShowMoreTileStyle(hovered: boolean, minHeight: number): React.CSSProperties {
  return {
    flex: `0 0 ${TILE_WIDTH}px`,
    background: '#151525',
    border: `1px dashed ${hovered ? COLORS.primary : '#444466'}`,
    borderRadius: 8,
    padding: '14px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: FONTS.body,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight,
    transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.15s ease',
    transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
  };
}

/** The dashed reveal tile shown as the last collapsed cell; clicking it expands the carousel. */
function ShowMoreTile({hiddenCount, minHeight, onClick}: {hiddenCount: number; minHeight: number; onClick: () => void}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Show ${hiddenCount} more mechanics`}
      style={getShowMoreTileStyle(hovered, minHeight)}>
      <span
        style={{
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          color: COLORS.primary,
        }}>
        +{hiddenCount}
      </span>
      <span
        style={{
          fontSize: `${FONT_SIZES.md}px`,
          fontWeight: 500,
          color: hovered ? COLORS.primary : COLORS.textMuted,
          transition: 'color 0.15s ease',
        }}>
        Show more ▾
      </span>
    </button>
  );
}
