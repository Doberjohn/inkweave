import {useRef} from 'react';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../shared/constants';

export type AdminTab = 'calibration' | 'activity';

interface TabBarProps {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const TABS: {id: AdminTab; label: string}[] = [
  {id: 'calibration', label: 'Calibration'},
  {id: 'activity', label: 'Activity'},
];

/**
 * Top-level admin dashboard tab switcher (Calibration | Activity). Follows the
 * ARIA tablist contract: roving tabindex (only the active tab is in the tab
 * order) with Left/Right arrow keys moving between tabs and activating them.
 */
export function TabBar({active, onChange}: TabBarProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + TABS.length) % TABS.length;
    onChange(TABS[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Admin analytics views"
      style={{
        display: 'flex',
        gap: SPACING.xs,
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
        marginBottom: SPACING.section,
      }}>
      {TABS.map(({id, label}, i) => {
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
            style={{
              appearance: 'none',
              border: 'none',
              borderBottom: `2px solid ${isActive ? COLORS.primary : 'transparent'}`,
              background: isActive ? COLORS.surfaceAlt : 'transparent',
              color: isActive ? COLORS.primary : COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: FONT_SIZES.lg,
              fontWeight: isActive ? 700 : 500,
              padding: `${SPACING.sm}px ${SPACING.lg}px`,
              cursor: 'pointer',
              marginBottom: -1,
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
