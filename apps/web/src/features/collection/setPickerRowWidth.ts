/**
 * Below this window width the set picker's row button leaves its logo out, so its words keep the
 * room Filters and Collection leave them: on an iPhone 15 the logo fits, and on a 375 or 360
 * phone the words need its room. A module of its own so the E2E suite reads the same number
 * without loading the picker.
 */
export const ROW_LOGO_MIN_WIDTH = 393;
