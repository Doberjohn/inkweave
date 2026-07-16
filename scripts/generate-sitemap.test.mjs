import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSitemapUrls, renderSitemap, SITE_ORIGIN, STATIC_ROUTES} from './generate-sitemap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'apps/web/public/data/allCards.json'), 'utf8'),
).cards;

async function playstyleCount() {
  const enginePath = path.join(ROOT, 'packages/synergy-engine/dist/index.js');
  const {getAllPlaystyles} = await import(new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href);
  return getAllPlaystyles().length;
}

describe('generate-sitemap', () => {
  it('lists exactly every card + playstyle + static route', async () => {
    const urls = await buildSitemapUrls();
    expect(urls).toHaveLength(cards.length + (await playstyleCount()) + STATIC_ROUTES.length);
  });

  it('emits only apex-host locs (no www)', async () => {
    const urls = await buildSitemapUrls();
    expect(SITE_ORIGIN).toBe('https://inkweave.ink');
    expect(urls.every((u) => u.loc.startsWith('https://inkweave.ink/'))).toBe(true);
    expect(urls.some((u) => u.loc.includes('www.'))).toBe(false);
  });

  it('keeps the /vote hub but excludes the /compare + /vote pair crawl-traps', async () => {
    const urls = await buildSitemapUrls();
    expect(urls.some((u) => u.loc === 'https://inkweave.ink/vote')).toBe(true);
    expect(urls.some((u) => /\/compare\//.test(u.loc) || /\/vote\/.+/.test(u.loc))).toBe(false);
  });

  it('gives every entry a valid ISO-8601 (YYYY-MM-DD) lastmod', async () => {
    const urls = await buildSitemapUrls();
    expect(urls.every((u) => /^\d{4}-\d{2}-\d{2}$/.test(u.lastmod))).toBe(true);
  });

  it('renders well-formed XML with the sitemap namespace and no priority/changefreq', async () => {
    const xml = renderSitemap(await buildSitemapUrls());
    const count = (re) => (xml.match(re) || []).length;
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml).not.toContain('<priority>');
    expect(xml).not.toContain('<changefreq>');
    // Balanced tags: one <loc> and one <lastmod> per <url>.
    expect(count(/<url>/g)).toBe(count(/<\/url>/g));
    expect(count(/<loc>/g)).toBe(count(/<url>/g));
    expect(count(/<lastmod>/g)).toBe(count(/<url>/g));
  });
});
