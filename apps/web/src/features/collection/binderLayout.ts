import type {CSSProperties} from 'react';
import {BROWSE_GUTTER, BROWSE_ROW_TOP} from '../cards/components/BrowseSidePanel';
import {SPACING} from '../../shared/constants';

/**
 * The binder section's box, shared by every branch of `CollectionBinderSection`, so the box
 * around them matches, and by `BinderChunkFallback`, drawn in it while the section's chunk
 * downloads (#913). A module of its own, so that fallback doesn't pull in the chunk.
 *
 * A phone's single page is WIDTH-driven, so its height is not bounded by the
 * space left under the toolbar, and Browse's `<main>` clips overflow. Measured:
 * at 375x667 the arrows clear the bottom by 2px; a shorter phone would hide them.
 * Scrolling the section keeps them reachable at any height. A desktop spread is
 * height-capped and never needs it.
 *
 * DOCKED, THE SIDES ARE BROWSE'S GUTTER (owner, 2026-10-08): the binder, drawn
 * there without arrows or padding of its own, starts where the search bar does,
 * one gutter past the filters panel, and stops one gutter short of the set panel.
 * The top and bottom match the panels' own, so a full-height binder starts and ends
 * level with them. Undocked, it starts where the toolbar's own padding put it
 * before the toolbar came to end at its controls (`BROWSE_ROW_TOP`).
 */
export function sectionStyle(isMobile: boolean, docked = false): CSSProperties {
  const gutter = isMobile ? SPACING.sm : SPACING.xxl;
  const sides = docked ? BROWSE_GUTTER : gutter;
  const top = docked ? BROWSE_ROW_TOP : SPACING.md;
  return {padding: `${top}px ${sides}px ${gutter}px`, height: '100%', ...(isMobile && {overflowY: 'auto'})};
}
