import type {CSSProperties} from 'react';
import {BROWSE_GUTTER, BROWSE_ROW_TOP} from '../cards/components/BrowseSidePanel';
import {SPACING} from '../../shared/constants';

/**
 * The binder section's box, shared by every branch of `CollectionBinderSection`, so the box
 * around them matches, and by `BinderChunkFallback`, drawn in it while the section's chunk
 * downloads (#913). A module of its own, so that fallback doesn't pull in the chunk.
 *
 * A phone's single page is WIDTH-driven, so its height is not bounded by the
 * space left under the row above it, and Browse's `<main>` clips overflow. On the
 * five phones #969 measured, the row, the page and its map fit with the browser's
 * bars showing, 1px to spare on an iPhone 13 mini (375x629) once the section's
 * padding came down to 4px above and below the binder; a shorter screen would hide
 * the map. Scrolling the section keeps it reachable at any height. A desktop spread
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
  if (isMobile) return {padding: `${SPACING.xs}px ${SPACING.sm}px`, height: '100%', overflowY: 'auto'};
  const sides = docked ? BROWSE_GUTTER : SPACING.xxl;
  const top = docked ? BROWSE_ROW_TOP : SPACING.md;
  return {padding: `${top}px ${sides}px ${SPACING.xxl}px`, height: '100%'};
}

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
