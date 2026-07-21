/**
 * URL slug for a card, derived from its `fullName` ("name - version").
 *
 * SINGLE SOURCE OF TRUTH (#498). The identical slug must be produced by:
 *   - the web app's card routes + internal links,
 *   - `scripts/generate-sitemap.mjs` (sitemap `<loc>`s),
 *   - `scripts/prerender.mjs` (the crawled output paths).
 * If any of these diverged, the sitemap/canonical/link URLs would not match the
 * prerendered files on disk, producing 404s and canonical conflicts. All three
 * consume the built engine, so this is the one place the rule lives.
 *
 * Rules (validated against all 1024 card `fullName`s, which are ASCII):
 *   - apostrophes are dropped, not hyphenated: "Bruno's Return" -> "brunos-return"
 *   - every other run of non-alphanumerics collapses to a single hyphen (so the
 *     " - " name/version separator does not become "---")
 *   - leading/trailing hyphens are trimmed
 */
export function cardSlug(card: {fullName: string}): string {
  return card.fullName
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Canonical URL path for a card page, e.g. "/card/1936/bruno-madrigal-undetected-uncle" (#498).
 * The one builder every consumer routes through (app links + canonical, sitemap, prerender), so
 * the slug and the "/card/{id}/" wrapper can never drift apart into a 404. The numeric id stays
 * the lookup key; the slug is decorative.
 */
export function cardPath(card: {id: number | string; fullName: string}): string {
  return `/card/${card.id}/${cardSlug(card)}`;
}
