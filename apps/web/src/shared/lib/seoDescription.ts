/** Search results cut a description past about this many characters, mid-sentence. */
const DESCRIPTION_MAX = 160;

/**
 * A page's meta description: the first of its wordings, longest first, that a search result
 * shows whole, or the last when none does.
 */
export function fitDescription(...candidates: [string, ...string[]]): string {
  return candidates.find((text) => text.length <= DESCRIPTION_MAX) ?? candidates[candidates.length - 1];
}
