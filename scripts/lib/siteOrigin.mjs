/**
 * The site's apex host, in one place for the build scripts (#554).
 *
 * Was declared three times — `generate-sitemap.mjs`, `check-rendered-html.mjs`
 * and `ping-indexnow.mjs` — each with a comment saying it must match the others.
 * Cross-referencing by comment is the shape of a rule with no mechanism, and the
 * image-restore path in `download-card-images.mjs` would have been a fourth copy.
 *
 * DELIBERATELY NOT SHARED WITH THE APP. `apps/web/src/shared/components/Seo.tsx`
 * keeps its own declaration, and should: a root build script and a bundled React
 * component have no business sharing a module, and importing root `scripts/` from
 * `apps/web` would invert the dependency and drag this file into the bundle. Two
 * declarations that must agree is a real (smaller) risk, tracked separately —
 * do not "fix" it by importing this file into the app.
 *
 * `HOST` is exported alongside because IndexNow's payload needs the bare host as
 * well as the origin; without it `ping-indexnow.mjs` would keep a copy anyway and
 * the deduplication would only be two-thirds done.
 */

/** Bare apex host, no scheme. */
export const HOST = 'inkweave.ink';

/** Apex origin. MUST match the canonical host `<Seo>` emits (#488 reconciliation). */
export const SITE_ORIGIN = `https://${HOST}`;
