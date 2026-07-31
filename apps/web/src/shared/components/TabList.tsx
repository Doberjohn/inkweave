import {useRef, useState, type ReactNode} from 'react';
import {COLORS, DURATION, EASING, FONTS, FONT_SIZES, GOLD_GLOW} from '../constants';

interface TabListProps<T extends string> {
  tabs: ReadonlyArray<{id: T; label: string; icon?: ReactNode}>;
  active: T;
  onChange: (id: T) => void;
  /** Accessible name for the tablist (e.g. "Deck panel views"). */
  ariaLabel: string;
}

/** Active tab wears the app's one selection recipe: gold tint + gold text + rail. */
function segmentStyle(isActive: boolean, isHovered: boolean): React.CSSProperties {
  return {
    flex: 1,
    appearance: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '11px 8px',
    background: isActive ? GOLD_GLOW.activeBg : 'transparent',
    // Inset rather than borderBottom so the segment height never shifts between states.
    boxShadow: isActive ? `inset 0 -2px 0 ${COLORS.primary}` : 'none',
    color: isActive || isHovered ? COLORS.primary : COLORS.textMuted,
    fontFamily: FONTS.body,
    fontSize: `${FONT_SIZES.lg}px`,
    // Active keeps 700: it sits one step above its siblings, and flattening it to
    // the kit's 600 would delete the active cue exactly as the neighbours got heavier.
    fontWeight: isActive ? 700 : 600,
    cursor: 'pointer',
    transition: `background ${DURATION.base}ms ${EASING.snappy}, color ${DURATION.base}ms ${EASING.snappy}`,
    minWidth: 0,
  };
}

/**
 * The blessed tab strip: full-width segments on a recessed (`surfaceAlt`) strip,
 * an optional leading icon, and the app's single selection recipe for the active
 * tab (`GOLD_GLOW.activeBg` + gold text + a gold rail) rather than a tab-only
 * idiom. Interaction follows the header nav — gold on hover, quiet at rest.
 *
 * Behavior is the correct ARIA tablist contract: roving tabindex with Left/Right
 * arrows moving focus AND selection, wrapping at the ends.
 */
export function TabList<T extends string>({tabs, active, onChange, ariaLabel}: TabListProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = useState<T | null>(null);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{display: 'flex', background: COLORS.surfaceAlt, borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
      {tabs.map(({id, label, icon}, i) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            style={segmentStyle(isActive, hovered === id)}>
            {icon}
            <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
