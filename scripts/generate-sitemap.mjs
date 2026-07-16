#!/usr/bin/env node
/**
 * Generates apps/web/public/sitemap.xml from the card database + playstyle ids + static routes
 * (issue #487). Replaces the hand-maintained 2-URL file, which drifted with every set release.
 *
 * Emits, on the apex host, with <lastmod> and NO <priority>/<changefreq> (Google ignores both):
 *   - every card:      /card/:id            (× ~1,024)
 *   - every playstyle: /playstyles/:id      (× 21)
 *   - static hubs:     /, /browse, /playstyles, /vote, /about, /privacy, /terms, /disclaimer
 *
 * The combinatorial /compare/:a/:b and /vote/:a/:b pair routes are deliberately EXCLUDED and are
 * blocked in robots.txt — an unlinked thin/duplicate URL space that must never be indexed.
 *
 * Wired into build:vercel after precompute-synergies (engine built → getAllPlaystyles resolves)
 * and before build:web (so public/ is copied into dist/), so prod never drifts.
 *
 * Usage: node scripts/generate-sitemap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** Apex host — MUST match the canonical host emitted by <Seo> (#488 reconciliation). */
export const SITE_ORIGIN = 'https://inkweave.ink';
const CARDS_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const OUTPUT_FILE = path.join(ROOT, 'apps/web/public/sitemap.xml');

/** Crawlable hub pages (the /vote hub stays in; its /vote/:a/:b pairs are robots-disallowed). */
export const STATIC_ROUTES = [
  '/',
  '/browse',
  '/playstyles',
  '/vote',
  '/about',
  '/privacy',
  '/terms',
  '/disclaimer',
];

/** W3C date (YYYY-MM-DD) — a valid <lastmod> value; simpler than a full timestamp. */
function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Load playstyle ids from the BUILT engine dist. A root script can't resolve the workspace
 * package name, so import the dist by file URL (matches scripts/prerender.mjs + precompute).
 */
async function loadPlaystyleIds() {
  const enginePath = path.join(ROOT, 'packages', 'synergy-engine', 'dist', 'index.js');
  const {getAllPlaystyles} = await import(
    new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href
  );
  return getAllPlaystyles().map((p) => p.id);
}

/**
 * Build the ordered list of `{loc, lastmod}` sitemap entries. Reads the card data + engine, so it
 * is async; kept separate from disk-writing so tests can assert the URL set without side effects.
 */
export async function buildSitemapUrls() {
  const {cards} = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
  const cardsLastmod = isoDate(fs.statSync(CARDS_FILE).mtime);
  const buildDate = isoDate(Date.now());
  const playstyleIds = await loadPlaystyleIds();

  return [
    ...STATIC_ROUTES.map((route) => ({loc: `${SITE_ORIGIN}${route}`, lastmod: buildDate})),
    ...playstyleIds.map((id) => ({loc: `${SITE_ORIGIN}/playstyles/${id}`, lastmod: buildDate})),
    ...cards.map((c) => ({loc: `${SITE_ORIGIN}/card/${c.id}`, lastmod: cardsLastmod})),
  ];
}

/** Render sitemap XML from entries. Pure. */
export function renderSitemap(urls) {
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
  const urls = await buildSitemapUrls();
  fs.writeFileSync(OUTPUT_FILE, renderSitemap(urls), 'utf8');
  console.log(`✓ sitemap.xml: ${urls.length} URLs written to apps/web/public/sitemap.xml`);
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
