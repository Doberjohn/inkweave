import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES} from '../../../shared/constants';

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
}

const DESCRIPTION_COLOR = '#c8c8d8';

const TILE_WIDTH = 190;
const TILE_GAP = 10;
/** Cap a single row at 8 cells (7 tiles + a show-more cell, or 8 tiles outright). */
const MAX_VISIBLE_TILES = 8;
/** Collapsed view shows this many real tiles; the 8th cell is the show-more tile. */
const COLLAPSED_TILE_COUNT = MAX_VISIBLE_TILES - 1;
const ROW_MAX_WIDTH = MAX_VISIBLE_TILES * TILE_WIDTH + (MAX_VISIBLE_TILES - 1) * TILE_GAP;

/**
 * A playstyle's mechanic tiles. With ≤8 mechanics every tile shows in a static
 * row. With more, the row collapses to 7 tiles + a "show more" tile; clicking it
 * reveals the rest and turns the row into a smooth horizontal scroll carousel
 * (scroll-snap + subtle scrollbar). Each tile toggles a role filter.
 */
export function RoleTileRow({tiles, activeRoles, onToggle}: RoleTileRowProps) {
  const [expanded, setExpanded] = useState(false);

  if (tiles.length === 0) return null;

  const sortedTiles = [...tiles].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  // Show-more only earns its cell when it hides ≥2 tiles (total > 8); at exactly
  // 8 the tiles all fit, so we never trade a real tile for the affordance.
  const needsShowMore = sortedTiles.length > MAX_VISIBLE_TILES;
  const collapsed = needsShowMore && !expanded;
  const visibleTiles = collapsed ? sortedTiles.slice(0, COLLAPSED_TILE_COUNT) : sortedTiles;
  const hiddenCount = sortedTiles.length - COLLAPSED_TILE_COUNT;

  return (
    <section
      aria-label="Mechanics"
      // Carousel scrolls only once expanded; collapsed stays a clipped static row.
      className={collapsed ? undefined : 'subtle-scrollbar'}
      style={{
        display: 'flex',
        gap: TILE_GAP,
        // flex-start (not center) so overflowing leading tiles stay scrollable.
        justifyContent: 'flex-start',
        overflowX: collapsed ? 'hidden' : 'auto',
        scrollSnapType: collapsed ? undefined : 'x proximity',
        maxWidth: ROW_MAX_WIDTH,
        margin: '0 auto 28px',
        padding: '2px 2px 10px', // room for the focus ring + scrollbar track
      }}>
      {visibleTiles.map((t) => (
        <RoleTileButton
          key={t.role}
          tile={t}
          active={activeRoles.has(t.role)}
          onToggle={onToggle}
        />
      ))}
      {collapsed && (
        <ShowMoreTile hiddenCount={hiddenCount} onClick={() => setExpanded(true)} />
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
function getRoleTileButtonStyle(active: boolean, hovered: boolean): React.CSSProperties {
  return {
    position: 'relative',
    flex: `0 0 ${TILE_WIDTH}px`, // fixed-width carousel cells; the row scrolls
    scrollSnapAlign: 'start',
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
    minHeight: 120,
    transition:
      'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.2s ease',
    transform: hovered && !active ? 'translateY(-1px)' : 'translateY(0)',
    boxShadow: tileBoxShadow(active, hovered),
  };
}

function RoleTileButton({
  tile,
  active,
  onToggle,
}: {
  tile: RoleTile;
  active: boolean;
  onToggle: (role: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = active ? COLORS.primaryMuted : undefined;

  return (
    <button
      type="button"
      onClick={() => onToggle(tile.role)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={tile.label}
      aria-pressed={active}
      style={getRoleTileButtonStyle(active, hovered)}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 6,
        }}>
        <span
          style={{
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 600,
            color: accent ?? COLORS.text,
          }}>
          {tile.label}
        </span>
        <span
          style={{
            fontSize: `${FONT_SIZES.lg}px`,
            fontWeight: 500,
            color: accent ?? COLORS.textMuted,
          }}>
          ({tile.count})
        </span>
      </div>
      <p
        style={{
          fontSize: `${FONT_SIZES.md}px`,
          color: DESCRIPTION_COLOR,
          margin: '4px 0 0',
        }}>
        {tile.description}
      </p>
    </button>
  );
}

/**
 * Base style for the show-more tile — a dashed "thematic" cell that matches the
 * real tiles' footprint (190×120) but reads as a reveal affordance: dashed gold
 * border on the dark dashed-tile background, brightening on hover. The inner
 * content (label/count/icon) is the human contribution below.
 */
function getShowMoreTileStyle(hovered: boolean): React.CSSProperties {
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
    minHeight: 120,
    transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.15s ease',
    transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
  };
}

function ShowMoreTile({hiddenCount, onClick}: {hiddenCount: number; onClick: () => void}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Show ${hiddenCount} more mechanics`}
      style={getShowMoreTileStyle(hovered)}>
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
