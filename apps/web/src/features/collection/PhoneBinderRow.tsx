import type {CSSProperties, ReactNode} from 'react';
import {CtaButton} from '../../shared/components';
import {useHover} from 'inkweave-ui/hooks/useHover';
import {COLORS, EASING, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import {ROW_CONTROL_HEIGHT} from './binderLayout';

interface PhoneBinderRowProps {
  /** The set button (`PhoneSetPicker`), or its placeholder while the binder's chunk loads. */
  setPicker: ReactNode;
  /** Binder options' badge: the filters on, plus one while the binder shows only Owned or Missing. */
  count: number;
  /** Binder options' press: opens the Binder sheet. */
  onOpen: () => void;
  /** Collection, which leaves the binder for the grid, at the row's far end as in grid mode. */
  modeSwitch: ReactNode;
}

/** Binder options is square, as tall as the set button beside it. */
const OPTIONS_SIZE = ROW_CONTROL_HEIGHT;

/** The badge's circle, which a two-digit count stretches into a pill. */
const BADGE_SIZE = 17;

/**
 * Over Binder options' top right corner, past its rim: the count can't crowd the icon, and the
 * corner stays the button's.
 */
const BADGE_OFFSET = -5;

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sm,
  // Its sides line up with the binder's board, 16px in, below it.
  padding: `${SPACING.sm}px ${SPACING.lg}px 0`,
  // Above the binder, as the toolbar is, so the set list opens over the page.
  position: 'relative',
  zIndex: 1,
  flexShrink: 0,
};

/** The set button's own recipe (`triggerStyle` in SetPicker.tsx): a grey rim, lighter on hover; the icon gold. */
function optionsStyle(hovered: boolean): CSSProperties {
  return {
    position: 'relative',
    flexShrink: 0,
    width: OPTIONS_SIZE,
    height: OPTIONS_SIZE,
    minHeight: OPTIONS_SIZE,
    padding: 0,
    borderRadius: `${RADIUS.lg}px`,
    border: `1px solid ${hovered ? COLORS.gray300 : COLORS.surfaceBorder}`,
    background: COLORS.surfaceRaised,
    color: COLORS.primary,
    // As the set button beside it: no boop.
    transform: undefined,
    transition: `border-color 0.15s ${EASING.snappy}`,
  };
}

const BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  top: BADGE_OFFSET,
  right: BADGE_OFFSET,
  minWidth: BADGE_SIZE,
  height: BADGE_SIZE,
  padding: `0 ${SPACING.xs}px`,
  borderRadius: `${RADIUS.pill}px`,
  background: COLORS.primary,
  color: COLORS.background,
  fontSize: `${FONT_SIZES.xs}px`,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** Two sliders, the binder's options: what it shows, its sort and the filters. */
function SlidersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Binder options' name, with the badge's count, which screen readers otherwise never hear: on a
 * phone it is all that shows the binder narrowed to Owned or Missing.
 */
const optionsName = (count: number) => (count > 0 ? `Binder options, ${count} on` : 'Binder options');

/** Opens the Binder sheet, its badge counting what is on, hidden at none. */
function BinderOptions({count, onOpen}: Pick<PhoneBinderRowProps, 'count' | 'onOpen'>) {
  const {hovered, hoverProps} = useHover();
  return (
    <CtaButton variant="neutral" {...hoverProps} aria-label={optionsName(count)} onClick={onOpen} style={optionsStyle(hovered)}>
      <SlidersIcon />
      {count > 0 && <span style={BADGE_STYLE}>{count}</span>}
    </CtaButton>
  );
}

/**
 * A phone's one row over the binder in collection mode (owner, 2026-10-25, #969, option A of
 * the comparison page): the set button, Binder options and Collection, in place of Browse's
 * title, its toolbar and the set strip, which took the top 277px of an iPhone 15 and left the
 * page's last row cut short. The binder under it is the page's protagonist.
 *
 * The set button shows the scope and its two percentages and opens the set list. Binder options
 * holds the rest, what the binder shows, its sort, the filters and the numbers, in the Binder
 * sheet, its badge counting the filters on and Owned or Missing, so no chips sit under the row.
 * Collection stays where grid mode has it, at the far end.
 */
export function PhoneBinderRow({setPicker, count, onOpen, modeSwitch}: PhoneBinderRowProps) {
  return (
    <div data-testid="phone-binder-row" style={ROW_STYLE}>
      <div style={{flex: 1, minWidth: 0}}>{setPicker}</div>
      <BinderOptions count={count} onOpen={onOpen} />
      {modeSwitch}
    </div>
  );
}
