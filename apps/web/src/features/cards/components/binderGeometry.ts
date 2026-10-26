import type {CSSProperties} from 'react';
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
export const PER_PAGE = SPREAD_PAGE.columns * SPREAD_PAGE.rows;
export const PER_SPREAD = PER_PAGE * 2;

/**
 * How many rows a phone's lone page has: 3, or 4 where the screen is tall enough that they keep
 * their cards near the 3-row page's size (`loneFitFor`, owner 2026-10-26).
 */
export type LoneRows = 3 | 4;

/** A phone's lone page, 3 across (owner, 2026-10-25): its pockets about 38% wider than 4 across. */
const LONE_PAGES: Record<LoneRows, PageGrid> = {3: {columns: 3, rows: 3}, 4: {columns: 3, rows: 4}};
export const lonePage = (rows: LoneRows): PageGrid => LONE_PAGES[rows];
export const perLonePage = (rows: LoneRows) => LONE_PAGES[rows].columns * rows;

/**
 * How a binder pages its pockets, which the binder, its map and their caller must agree on: the
 * pockets a view holds, and those whose room the front cover takes before the first card.
 */
export interface BinderPaging {
  perView: number;
  lead: number;
}

/**
 * A spread binder pages two pages of twelve at a time, opening on the inside front cover (owner,
 * 2026-10-18), which takes the first spread's left page: its cards start a page in.
 */
export const SPREAD_PAGING: BinderPaging = {perView: PER_SPREAD, lead: PER_PAGE};
/**
 * A phone pages a lone page at a time, nine or twelve, with no covers. One object per row
 * count, so a caller that keeps it in a dependency list sees a change only when the rows change.
 */
const LONE_PAGINGS: Record<LoneRows, BinderPaging> = {3: {perView: perLonePage(3), lead: 0}, 4: {perView: perLonePage(4), lead: 0}};

export const pagingOf = (single: boolean, rows: LoneRows) => (single ? LONE_PAGINGS[rows] : SPREAD_PAGING);

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

/** How far a phone's lone board sits in from the binder's sides (`SingleView`). */
export const LONE_INSET = SPACING.sm;

/**
 * How far it sits below the binder's top over its page map: a quarter of its room over arrows,
 * which a short phone needs for a fourth row.
 */
export const LONE_TOP_OVER_MAP = SPACING.xxs;

/**
 * The lone board's box: `top` above it, `LONE_INSET` either side, and where the page's height caps
 * it (`LoneFit.maxWidth`) no wider than that, centred. The binder (`SingleView`) and its
 * loading frame (`BinderChunkFallback`) both draw it, so the one takes over the other's place.
 */
export function loneBoxStyle(top: number, maxWidth: number | undefined): CSSProperties {
  const box = {padding: `${top}px ${LONE_INSET}px 0`};
  return maxWidth === undefined ? box : {...box, maxWidth, width: '100%', margin: '0 auto', boxSizing: 'border-box'};
}

/** What a lone board draws across besides its three cards: the board either side, the spine, the page's padding and gaps. */
const LONE_ACROSS = 2 * BOARD + SPINE_WIDTH + 2 * PAGE_PADDING + (LONE_PAGES[3].columns - 1) * POCKET_GAP;

/** What it draws down besides its cards, `rows` of them: the board above and below, the page's padding and gaps. */
const loneDown = (rows: LoneRows) => 2 * BOARD + 2 * PAGE_PADDING + (rows - 1) * POCKET_GAP;

/**
 * How tall a phone's lone board draws in `width`, a CSS length, as CSS: `rows` of cards as
 * wide as the page's three columns leave, with the page's padding and gaps and the board round
 * them. The page is width-driven, so this is all its height; the binder's loading frame sizes its
 * page by it, in container units.
 */
export function loneBoardHeight(width: string, rows: LoneRows): string {
  return `calc(${loneDown(rows)}px + ${rows} * (${width} - ${LONE_ACROSS}px) / ${LONE_PAGES[3].columns} / ${CARD_ASPECT})`;
}

/** A cell of the binder's map at full size (`BinderSpreadMap`): 7px across, so 9 tall, the nearest to a card's shape. */
export const MAP_CELL = {width: 7, height: Math.round(7 / 0.75)};

/** The gap between a mini page's cells. */
export const MAP_CELL_GAP = SPACING.xxs;

/** A mini spread's or page's padding round its cells, and its border round that. */
export const MINI_PADDING = SPACING.xs;
export const MINI_BORDER = 1;

/** A mini page's side of `cells` cells `cell` long: the cells, their gaps, and its padding and border either side. */
const miniSide = (cells: number, cell: number) =>
  cells * cell + (cells - 1) * MAP_CELL_GAP + 2 * (MINI_PADDING + MINI_BORDER);

/** A phone's mini page, at full size as it always is: 35 wide, 41 tall at 3 rows and 52 at 4. */
export const LONE_MINI_WIDTH = miniSide(LONE_PAGES[3].columns, MAP_CELL.width);
const loneMiniHeight = (rows: LoneRows) => miniSide(rows, MAP_CELL.height);

/** How far a phone's page map sits under its page. */
export const MAP_GAP_ABOVE = SPACING.xs;

/**
 * The band a phone's page map takes under its page of `rows`: its gap, then a mini page, its
 * tallest. The binder's loading frame keeps it empty, so the map that arrives draws in it
 * (`BinderChunkFallback`).
 */
export const mapBandHeight = (rows: LoneRows) => MAP_GAP_ABOVE + loneMiniHeight(rows);

/** The room a phone's binder has: its section's content box, which the board, its gap above and the map share. */
export interface LoneRoom {
  width: number;
  height: number;
}

/** How a phone's lone page fits its room: its rows, and how wide its board's box may be, where the height caps it. */
export interface LoneFit {
  rows: LoneRows;
  maxWidth?: number;
}

/** A lone page's card width at `rows`: as wide as `room` lets the page be, and no taller than it lets the page and map be. */
function loneCardWidth({width, height}: LoneRoom, rows: LoneRows): number {
  const byWidth = (width - 2 * LONE_INSET - LONE_ACROSS) / LONE_PAGES[rows].columns;
  const byHeight = ((height - LONE_TOP_OVER_MAP - mapBandHeight(rows) - loneDown(rows)) * CARD_ASPECT) / rows;
  return Math.min(byWidth, byHeight);
}

/** How much of the 3-row page's card width a 4-row page must keep to be drawn (owner, 2026-10-26). */
const FOUR_ROWS_SHARE = 0.9;

/**
 * ROWS THAT FIT (owner, 2026-10-26): a phone's page has 4 rows where, narrowed to fit the
 * height with its map, their cards keep 90% or more of the 3-row page's width, so a tall phone's
 * page fills its screen; else 3, width-driven as before, which a short phone scrolls to its map.
 * At 4 rows the board's box is capped to the width whose height fits (`maxWidth`), and centred.
 */
export function loneFitFor(room: LoneRoom): LoneFit {
  const three = (room.width - 2 * LONE_INSET - LONE_ACROSS) / LONE_PAGES[3].columns;
  const four = loneCardWidth(room, 4);
  if (four < FOUR_ROWS_SHARE * three) return {rows: 3};
  return {rows: 4, maxWidth: 2 * LONE_INSET + LONE_ACROSS + LONE_PAGES[4].columns * four};
}
