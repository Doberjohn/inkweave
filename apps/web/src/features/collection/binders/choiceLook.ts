import type {CSSProperties} from 'react';
import {COLORS, DURATION, EASING, GOLD_GLOW, RADIUS, SPACING} from '../../../shared/constants';

/** The choices' look, for `coverPicker.css`, which holds only `var()`s: the Pages tiles' too (`PagesChoices`). */
export const CHOICE_LOOK = {
  '--cover-radius': `${RADIUS.lg}px`,
  '--cover-edge': '0 0 0 1px transparent',
  '--cover-hover-ring': `0 0 0 1px ${GOLD_GLOW.activeBorder}`,
  '--cover-chosen-ring': `0 0 0 2px ${COLORS.primary}, ${GOLD_GLOW.shadow}`,
  '--cover-focus-ring': GOLD_GLOW.focusRing,
  '--cover-fade': `${DURATION.fast}ms ${EASING.snappy}`,
} as CSSProperties;

/** Inside the button, which takes no inline style of its own: room round the binder for the ring, and the chosen one's gold wash. */
export const faceStyle = (chosen: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACING.xs,
  padding: SPACING.xs,
  borderRadius: `${RADIUS.lg}px`,
  background: chosen ? GOLD_GLOW.activeBg : undefined,
});
