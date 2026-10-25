import {SPACING} from '../../../shared/constants';

/**
 * The binder's measures: its pages' grids and what surrounds their pockets. They live apart
 * from the binder's code (`BinderSpread`), so the phone binder's loading frame can size itself
 * from them without loading the binder (#969).
 */

/** A page's pockets: how many across, and how many down. */
export interface PageGrid {
  columns: number;
  rows: number;
}

/** A spread's pages, 4 by 3, on tablets and desktop. */
export const SPREAD_PAGE: PageGrid = {columns: 4, rows: 3};
/** A phone's lone page, 3 by 3 (owner, 2026-10-25, #969): its pockets about 38% wider than 4 across. */
export const LONE_PAGE: PageGrid = {columns: 3, rows: 3};
export const PER_LONE_PAGE = LONE_PAGE.columns * LONE_PAGE.rows;

/** Lorcana cards are 0.72 wide-to-tall. Drives the whole layout. */
export const CARD_ASPECT = 0.72;

/** A page's margin around its pockets. */
export const PAGE_PADDING = SPACING.md;

/** The gap between a page's pockets, across and down. */
export const POCKET_GAP = SPACING.sm;

/**
 * The board round the pages, which the zip runs along (#941): the spread's sizing counts it on
 * both axes, and on a phone it comes out of the lone page's width.
 */
export const BOARD = SPACING.section;

/**
 * The spine. Wide enough to hold hardware, because a bare gap reads as two
 * separate panels rather than one bound object. Rings are the most legible
 * signal of "binder" and survive at any spread height, where stitching or a
 * leather texture would compete with the pages and need its own asset.
 */
export const SPINE_WIDTH = SPACING.xxl;
