import type {CSSProperties} from 'react';
import {BROWSE_GUTTER, BROWSE_ROW_TOP} from '../cards/components/BrowseSidePanel';
import {SPACING} from '../../shared/constants';

/**
 * The binder section's box, shared by every branch of `CollectionBinderSection`, so the box
 * around them matches, and by `BinderChunkFallback`, drawn in it while the section's chunk
 * downloads (#913). A module of its own, so that fallback doesn't pull in the chunk.
 *
 * A phone's single page is WIDTH-driven at 3 rows, so its height is not bounded by
 * the space left under the row above it, and Browse's `<main>` clips overflow. Where
 * the section is tall enough it draws 4 rows instead, fitted to its height
 * (`loneFitFor`), which the section is measured for (`useLoneFit`): so it
 * has no padding above, the row's own 8px under its controls being the gap, and 4px
 * below. A short phone's 3-row page and map can still run past the section's foot,
 * so scrolling the section keeps the map reachable at any height. A desktop spread
 * is height-capped and never needs it.
 *
 * DOCKED, THE SIDES ARE BROWSE'S GUTTER (owner, 2026-10-08): the binder, drawn
 * there without arrows or padding of its own, starts where the search bar does,
 * one gutter past the filters panel, and stops one gutter short of the set panel.
 * The top and bottom match the panels' own, so a full-height binder starts and ends
 * level with them. Undocked, it starts where the toolbar's own padding put it
 * before the toolbar came to end at its controls (`BROWSE_ROW_TOP`).
 */
export function sectionStyle(isMobile: boolean, docked = false): CSSProperties {
  if (isMobile) return {padding: `0 ${SPACING.sm}px ${SPACING.xs}px`, height: '100%', overflowY: 'auto'};
  const sides = docked ? BROWSE_GUTTER : SPACING.xxl;
  const top = docked ? BROWSE_ROW_TOP : SPACING.md;
  return {padding: `${top}px ${sides}px ${SPACING.xxl}px`, height: '100%'};
}

/**
 * How tall a phone binder row's set button is (`ROW_TRIGGER` in SetPicker.tsx), and its
 * placeholder while the binder's chunk downloads (`BinderChunkFallback`): 34px, as Filters and
 * Collection either side of it are, the row grid mode has (owner, 2026-10-26).
 */
export const ROW_CONTROL_HEIGHT = 34;

/** Bar heights, by how much the number above them matters. */
export const BAR = {headline: 8, second: 6, row: 4} as const;

/** `SIDE_PANEL_STYLE`'s padding, which the numbers reach through: see below. */
const PANEL_PADDING = SPACING.md;

/**
 * The set panel's numbers, under its controls (`NumbersRegion`). They scroll on their own, edge
 * to edge, so their scrollbar sits on the panel's rim as the filters panel's does, and the
 * controls above never scroll away. The docked panel's fallback (`DockedSetBodyFallback`) holds
 * the same box while the binder's chunk downloads.
 */
export const NUMBERS_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  margin: `0 -${PANEL_PADDING}px -${PANEL_PADDING}px`,
  padding: `${SPACING.xs}px ${PANEL_PADDING}px ${PANEL_PADDING}px`,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xl,
};

/**
 * The numbers on a phone's inside front cover (owner, 2026-10-27): the panel's column, packed
 * closer (12px between the headlines and each breakdown, not 20), and 16px in from the page's
 * sides, so the chosen headline's ring, which reaches 9px past the column, keeps clear of them.
 * The cover's own box scrolls them where they are taller than the page.
 */
export const COVER_NUMBERS_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.md,
  padding: `${SPACING.sm}px ${SPACING.lg}px`,
};
