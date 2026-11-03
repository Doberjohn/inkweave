import type {CSSProperties} from 'react';
import {COLORS, DURATION, EASING, FONT_SIZES, FONT_WEIGHT, GOLD_GLOW, RADIUS, SPACING, TABULAR} from '../../shared/constants';

/** How a button is drawn: whether it is open (or the chosen row), and whether it is hovered. */
export interface Look {
  on: boolean;
  hovered: boolean;
}

/**
 * The kit's neutral button as a row of the set picker's list: gold-ringed for the open set or
 * binder, washed on hover. Its first column fits a promo set's code ("RPH"), where a set has its
 * number (#805), and a binder its medal.
 */
export function optionStyle({on: selected, hovered}: Look): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr) auto',
    alignItems: 'center',
    justifyContent: 'stretch',
    columnGap: SPACING.sm,
    width: '100%',
    minHeight: 0,
    flexShrink: 0,
    padding: `${SPACING.sm}px ${SPACING.xs}px`,
    borderRadius: `${RADIUS.md}px`,
    border: `1px solid ${selected ? GOLD_GLOW.activeBorder : 'transparent'}`,
    background: selected ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    color: COLORS.text,
    fontSize: `${FONT_SIZES.lg}px`,
    textAlign: 'left',
    // Rows don't boop: a growing row would clip against the list's edge.
    transform: undefined,
    transition: `background ${DURATION.fast}ms ${EASING.snappy}`,
  };
}

/** A row's percentage: gold and bold once done. */
export const percentStyle = (done: boolean): CSSProperties => ({
  ...TABULAR,
  fontSize: `${FONT_SIZES.base}px`,
  color: done ? COLORS.primary : COLORS.textMuted,
  fontWeight: done ? FONT_WEIGHT.bold : FONT_WEIGHT.regular,
});
