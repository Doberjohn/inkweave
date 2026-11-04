import type {CSSProperties} from 'react';
import {COLORS, FONTS, FONT_SIZES, FONT_WEIGHT, LINE_HEIGHT, RADIUS, SPACING} from '../../../shared/constants';

/** The text field the binder dialogs share: the display name dialog's. */
export const FIELD: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: SPACING.sm,
  background: COLORS.surfaceAlt,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.md,
  color: COLORS.text,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.md}px`,
};

/** A dialog's lead under its title. */
export const LEAD: CSSProperties = {
  margin: `${SPACING.xs}px 0 0`,
  fontSize: `${FONT_SIZES.base}px`,
  lineHeight: LINE_HEIGHT.relaxed,
  color: COLORS.textMuted,
};

/** A binder's rules as chips, in a row that wraps. */
export const CHIPS: CSSProperties = {display: 'flex', flexWrap: 'wrap', gap: SPACING.xs, margin: 0, padding: 0, listStyle: 'none'};

export const CHIP: CSSProperties = {
  padding: `${SPACING.xxs}px ${SPACING.sm}px`,
  borderRadius: `${RADIUS.pill}px`,
  border: `1px solid ${COLORS.surfaceBorder}`,
  background: COLORS.neutralFill,
  fontSize: `${FONT_SIZES.sm}px`,
  fontWeight: FONT_WEIGHT.medium,
  color: COLORS.text,
};

/** A small muted heading over a part of a dialog: "Its first page", "It holds". */
export const HEADING: CSSProperties = {
  margin: 0,
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: FONT_WEIGHT.semibold,
  color: COLORS.textMuted,
};
