import {useRef} from 'react';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../constants';

interface TabListProps<T extends string> {
  tabs: ReadonlyArray<{id: T; label: string}>;
  active: T;
  onChange: (id: T) => void;
  /** Accessible name for the tablist (e.g. "Deck panel views"). */
  ariaLabel: string;
}

/**
 * The blessed underline tab strip (#509), unifying the app's two underline
 * implementations. Visuals follow DeckPanel's ruling (active = text color +
 * gold underline, no background); behavior follows admin TabBar's correct
 * ARIA tablist contract: roving tabindex with Left/Right arrows moving focus
 * AND selection, wrapping at the ends.
 */
export function TabList<T extends string>({tabs, active, onChange, ariaLabel}: TabListProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

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
      style={{display: 'flex', gap: SPACING.xs, borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
      {tabs.map(({id, label}, i) => {
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
              background: 'transparent',
              color: isActive ? COLORS.text : COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.lg}px`,
              fontWeight: isActive ? 700 : 500,
              padding: `${SPACING.sm}px ${SPACING.md}px`,
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
