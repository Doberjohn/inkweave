import {SPACING} from '../../../shared/constants';

/**
 * The `/decks` tile grid, in one place.
 *
 * Shared by `DecksPage`'s list and `DeckListSkeleton` so the placeholder holds the
 * exact layout the decks arrive into. A skeleton that drifts from the thing it stands
 * in for is worse than none: it promises a layout and then delivers a different one.
 *
 * NOT to be confused with `DECK_GRID_COLUMN` in DeckCardGrid. That one is the grid of
 * CARDS inside a single deck (140px); this is the grid of DECKS on the list page
 * (240px). Two grids, two scales, deliberately different names.
 */

/**
 * Minimum tile width before the grid drops a column.
 *
 * The tiles are Lorcana-proportioned (0.7168), so width buys height at 1.4x: a 240px
 * tile is 335px tall. 240 is the floor where the frame's name plate still renders
 * above its clamp's 11px minimum and the strip above its 10px one — below that both
 * bottom out and the card stops scaling honestly.
 */
export const DECK_TILE_MIN_WIDTH = 240;

export const DECK_TILE_GAP = SPACING.lg;
