import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES} from '../../../shared/constants';
import {useResponsive} from '../../../shared/hooks/useResponsive';

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
const DESKTOP_BREAKPOINT = 1400;
const COMPACT_BREAKPOINT = 700;

function gridTemplate(tileCount: number, viewport: number): string {
  if (viewport < COMPACT_BREAKPOINT) return 'repeat(2, minmax(0, 180px))';
  if (viewport < DESKTOP_BREAKPOINT) return 'repeat(4, minmax(0, 200px))';
  return `repeat(${tileCount}, minmax(0, 190px))`;
}

export function RoleTileRow({tiles, activeRoles, onToggle}: RoleTileRowProps) {
  const {windowWidth: viewport} = useResponsive();
  if (tiles.length === 0) return null;

  const sortedTiles = [...tiles].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate(sortedTiles.length, viewport),
        gap: 10,
        justifyContent: 'center',
        alignItems: 'stretch',
        margin: '0 0 28px',
      }}>
      {sortedTiles.map((t) => (
        <RoleTileButton
          key={t.role}
          tile={t}
          active={activeRoles.has(t.role)}
          onToggle={onToggle}
        />
      ))}
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
