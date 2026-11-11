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

/** A binder's page size as its row keeps it: its pockets across and down (owner, 2026-11-05). */
export type PageSide = 2 | 3 | 4;

/** A binder's page size until its player picks one, as the tables make a row: 4 by 4 (owner, 2026-11-05). */
export const DEFAULT_SIDE: PageSide = 4;

declare const BINDER_PAGE: unique symbol;

/**
 * A binder's own page: today's (`TODAY_PAGE`) or a side's (`squarePage`), the only two that make
 * one. A page a view draws (`viewPage`) is a plain `PageGrid`, so it can't come back in as a
 * binder's: a phone's 3 by 3 lone page would pass for a 3 by 3 binder's (`isSquare`).
 */
export type BinderGrid = PageGrid & {readonly [BINDER_PAGE]: true};

/**
 * Today's page, 4 by 3: every binder's while binders are off. A spread draws two of them on
 * tablets and desktop, and a phone draws it 3 across (`lonePage`).
 */
export const TODAY_PAGE = {columns: 4, rows: 3} as BinderGrid;

/** How many pockets a page of `grid` holds. */
export const pocketsOf = ({columns, rows}: PageGrid) => columns * rows;

/** One grid per side, made once, so a caller that keeps one in a dependency list sees a change only when the side does. */
const SQUARE_PAGES: Record<PageSide, BinderGrid> = {
  2: {columns: 2, rows: 2} as BinderGrid,
  3: {columns: 3, rows: 3} as BinderGrid,
  4: {columns: 4, rows: 4} as BinderGrid,
};

/** A binder's page at its size: as many pockets across as down. */
export const squarePage = (side: PageSide): BinderGrid => SQUARE_PAGES[side];

/**
 * How many rows a phone's lone page of today's has: 3, or 4 where the screen is tall enough that
 * they keep their cards near the 3-row page's size (`loneFitFor`, owner 2026-10-26).
 */
export type LoneRows = 3 | 4;

/**
 * A table of one entry per row count, each made once: a caller that keeps an entry in a
 * dependency list sees a change only when the rows change.
 */
const byRows = <T>(make: (rows: LoneRows) => T): Record<LoneRows, T> => ({3: make(3), 4: make(4)});

/** The most pockets across a phone draws (owner, 2026-10-25): a lone page 3 across has pockets about 38% wider than 4 across. */
const LONE_COLUMNS = 3;

/** A phone's lone page of today's, 3 across. */
const LONE_PAGES = byRows((rows): PageGrid => ({columns: LONE_COLUMNS, rows}));
export const lonePage = (rows: LoneRows): PageGrid => LONE_PAGES[rows];

/** Whether a page is a binder's own size, as many across as down, rather than today's 4 by 3. */
export const isSquare = ({columns, rows}: BinderGrid) => columns === rows;

/** Whether a phone draws `grid`'s page as it is: 2 or 3 across fit, as today's 3 across does. */
const drawnWhole = ({columns}: BinderGrid) => columns <= LONE_COLUMNS;

/**
 * The page a view draws of a binder whose pages are `grid`: a spread's are the binder's own. A
 * phone draws a 2 by 2 or 3 by 3 page as it is, and a page 4 across (4 by 4, and today's) as
 * today's 3 across, with the rows that fit (`lonePage`), so a 4 by 4 binder looks on a phone as a
 * binder did before sizes (owner, 2026-11-11: 2B, the binder window's check-in).
 */
export function viewPage(grid: BinderGrid, single: boolean, rows: LoneRows): PageGrid {
  return single && !drawnWhole(grid) ? lonePage(rows) : grid;
}

/**
 * How a binder pages its pockets, which the binder, its map and their caller must agree on: the
 * pockets a view holds, and those whose room the front cover takes before the first card.
 */
export interface BinderPaging {
  perView: number;
  lead: number;
}

/** Each paging made once, so a caller that keeps one in a dependency list sees a change only when it does. */
const PAGINGS = new Map<string, BinderPaging>();

/**
 * How a binder of `grid` pages, by the page its view draws (`viewPage`).
 *
 * A spread pages two pages at a time, opening on the inside front cover (owner, 2026-10-18),
 * which takes the first spread's left page: its cards start a page in.
 *
 * A phone pages a lone page at a time, after an inside front cover that holds the collection's
 * numbers (owner, 2026-10-27): its cards start a page in. It opens on page 1, the view after the
 * cover, so the cards come first.
 */
export function pagingOf(grid: BinderGrid, single: boolean, rows: LoneRows): BinderPaging {
  const page = pocketsOf(viewPage(grid, single, rows));
  const key = `${single ? 'lone' : 'spread'} ${page}`;
  const known = PAGINGS.get(key);
  if (known) return known;
  const paging = {perView: single ? page : 2 * page, lead: page};
  PAGINGS.set(key, paging);
  return paging;
}

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

/** What a lone board draws across besides its cards, `columns` of them: the board either side, the spine, the page's padding and gaps. */
const loneAcross = (columns: number) => 2 * BOARD + SPINE_WIDTH + 2 * PAGE_PADDING + (columns - 1) * POCKET_GAP;

/** What it draws down besides its cards, `rows` of them: the board above and below, the page's padding and gaps. */
const loneDown = (rows: number) => 2 * BOARD + 2 * PAGE_PADDING + (rows - 1) * POCKET_GAP;

/**
 * How tall a phone's lone board of `page` draws in `width`, a CSS length, as CSS: its rows of
 * cards as wide as its columns leave, with the page's padding and gaps and the board round them.
 * The page is width-driven, so this is all its height; the binder's loading frame sizes its page
 * by it, in container units.
 */
export function loneBoardHeight(width: string, {columns, rows}: PageGrid): string {
  return `calc(${loneDown(rows)}px + ${rows} * (${width} - ${loneAcross(columns)}px) / ${columns} / ${CARD_ASPECT})`;
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

/**
 * A phone's mini page of `page`, at full size as it always is: 35 wide for today's 3 across, and
 * 41 tall at 3 rows and 52 at 4.
 */
export const loneMiniWidth = ({columns}: PageGrid) => miniSide(columns, MAP_CELL.width);
const loneMiniHeight = (rows: number) => miniSide(rows, MAP_CELL.height);

/** How far a phone's page map sits under its page. */
export const MAP_GAP_ABOVE = SPACING.xs;

/**
 * The band a phone's page map takes under its page of `rows`: its gap, then a mini page, its
 * tallest. The binder's loading frame keeps it empty, so the map that arrives draws in it
 * (`BinderChunkFallback`).
 */
export const mapBandHeight = (rows: number) => MAP_GAP_ABOVE + loneMiniHeight(rows);

/** The room a phone's binder has: its section's content box, which the board, its gap above and the map share. */
export interface LoneRoom {
  width: number;
  height: number;
}

/**
 * How a phone's lone page fits its room: the rows of a page drawn 3 across (a 2 by 2 or 3 by 3
 * page draws its own), and how wide its board's box may be, where the height caps it.
 */
export interface LoneFit {
  rows: LoneRows;
  maxWidth?: number;
}

/** A lone page at 3 rows, as wide as the binder: where no room was measured, and where 4 rows don't fit it. */
export const THREE_ROWS: LoneFit = {rows: 3};

/**
 * Room a height-capped page leaves unused under its map. The browser rounds each row's height,
 * so a page sized to fill its room exactly can come out a fraction of a pixel taller and scroll
 * its section, and where scrollbars take width, the scrollbar would narrow the page back out of it.
 */
const LONE_FIT_SLACK = 2;

/** A lone page's card width as wide as `room` lets `page` be. */
const loneWidthCard = ({width}: LoneRoom, {columns}: PageGrid) => (width - 2 * LONE_INSET - loneAcross(columns)) / columns;

/**
 * A lone page fitted to `room`: its card width as wide as the room lets `page` be and no taller
 * than it lets the page and map be, and the width of its board's box round cards that wide.
 */
function fitted(room: LoneRoom, page: PageGrid): {card: number; maxWidth: number} {
  const {columns, rows} = page;
  const below = LONE_TOP_OVER_MAP + mapBandHeight(rows) + loneDown(rows) + LONE_FIT_SLACK;
  const card = Math.min(loneWidthCard(room, page), ((room.height - below) * CARD_ASPECT) / rows);
  return {card, maxWidth: 2 * LONE_INSET + loneAcross(columns) + columns * card};
}

/**
 * How much of its width-driven card width a page narrowed to fit the height must keep to be
 * drawn so (owner, 2026-10-26, for today's 4 rows).
 */
const FIT_SHARE = 0.9;

/**
 * ROWS THAT FIT (owner, 2026-10-26): a phone's page of today's has 4 rows where, narrowed to fit
 * the height with its map, their cards keep 90% or more of the 3-row page's width, so a tall
 * phone's page fills its screen; else 3, width-driven as before, which a short phone scrolls to
 * its map. At 4 rows the board's box is capped to the width whose height fits (`maxWidth`), and
 * centred.
 */
function todayFit(room: LoneRoom): LoneFit {
  const four = fitted(room, LONE_PAGES[4]);
  if (four.card < FIT_SHARE * loneWidthCard(room, LONE_PAGES[3])) return THREE_ROWS;
  return {rows: 4, maxWidth: four.maxWidth};
}

/**
 * How `grid`'s lone page fits `room` on a phone. A page drawn 3 across takes the rows that fit. A
 * 2 by 2 or 3 by 3 page draws as wide as the binder: it is no taller than 3 rows of 3 across, so it
 * fits wherever they do, and a short phone scrolls to its map as at 3 rows.
 */
export const loneFitFor = (room: LoneRoom, grid: BinderGrid): LoneFit => (drawnWhole(grid) ? THREE_ROWS : todayFit(room));
