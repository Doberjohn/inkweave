/** How many sheets show under each page of a view (#941): its left page's foot and its right's. */
export interface ViewSheets {
  left: number;
  right: number;
}

/** The most sheets drawn under a page, however many lie there. */
const MOST_SHEETS = 3;

/** Sheets drawn under a page's foot for `n` sheets there, out of the binder's `sheets`: none, or one to three. */
export const sheetCount = (n: number, sheets: number) =>
  n <= 0 ? 0 : Math.min(MOST_SHEETS, Math.max(1, Math.round((MOST_SHEETS * n) / Math.max(1, sheets - 1))));

/**
 * The sheets under each page of view `view`, out of `total` views, by how far through the binder
 * it is: on a spread, those already turned lie under the left page and those still to come under
 * the right, so a set's first spread has three under its right page and its last three under its
 * left. A phone's lone page lies on every page still to come, with no left page.
 */
export function viewSheets(view: number, total: number, single: boolean): ViewSheets {
  if (single) return {left: 0, right: sheetCount(total - 1 - view, total)};
  return {left: sheetCount(view - 1, total - 1), right: sheetCount(total - view - 2, total - 1)};
}
