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
export const PER_PAGE = SPREAD_PAGE.columns * SPREAD_PAGE.rows;
export const PER_SPREAD = PER_PAGE * 2;
export const PER_LONE_PAGE = LONE_PAGE.columns * LONE_PAGE.rows;

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
/** A phone pages a lone page of nine at a time, with no covers (#969). */
export const LONE_PAGING: BinderPaging = {perView: PER_LONE_PAGE, lead: 0};

export const pagingOf = (single: boolean) => (single ? LONE_PAGING : SPREAD_PAGING);

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

/** How far it sits below the binder's top over its page map (#969): half its room over arrows. */
export const LONE_TOP_OVER_MAP = SPACING.xs;

/**
 * How tall a phone's lone board draws in `width`, a CSS length, as CSS (#969): three rows of
 * cards as wide as the page's three columns leave, with the page's padding and gaps and the
 * board round them. The page is width-driven, so this is all its height; the binder's loading
 * frame sizes its page by it, in container units.
 */
export function loneBoardHeight(width: string): string {
  const across = 2 * BOARD + SPINE_WIDTH + 2 * PAGE_PADDING + (LONE_PAGE.columns - 1) * POCKET_GAP;
  const down = 2 * BOARD + 2 * PAGE_PADDING + (LONE_PAGE.rows - 1) * POCKET_GAP;
  return `calc(${down}px + ${LONE_PAGE.rows} * (${width} - ${across}px) / ${LONE_PAGE.columns} / ${CARD_ASPECT})`;
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

/** A phone's mini page, at full size as it always is (#969): 35 by 41. */
export const LONE_MINI = {
  width: miniSide(LONE_PAGE.columns, MAP_CELL.width),
  height: miniSide(LONE_PAGE.rows, MAP_CELL.height),
};

/** How far a phone's page map sits under its page. */
export const MAP_GAP_ABOVE = SPACING.xs;

/**
 * The band a phone's page map takes under its page: its gap, then a mini page, its tallest. The
 * binder's loading frame keeps it empty, so the map that arrives draws in it (`BinderChunkFallback`).
 */
export const MAP_BAND_HEIGHT = MAP_GAP_ABOVE + LONE_MINI.height;
