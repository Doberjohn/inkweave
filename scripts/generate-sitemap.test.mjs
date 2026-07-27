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
  const {getAllPlaystyles} = await import(
    new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href
  );
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

  it('gives card entries a content-derived lastmod, never the build date', async () => {
    const urls = await buildSitemapUrls();
    const cardUrls = urls.filter((u) => u.loc.includes('/card/'));
    const {metadata} = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'apps/web/public/data/allCards.json'), 'utf8'),
    );
    const expected = new Date(metadata.generatedOn).toISOString().slice(0, 10);

    expect(cardUrls.length).toBeGreaterThan(0);
    expect(cardUrls.every((u) => u.lastmod === expected)).toBe(true);

    // The regression this pins (#525): lastmod was read from the file's mtime, and
    // download-card-images.mjs rewrites allCards.json on every build — so every deploy
    // claimed all 1,024 cards changed that day. Google discredits an unreliable lastmod
    // sitemap-wide, which is worse than having none.
    const today = new Date().toISOString().slice(0, 10);
    expect(cardUrls.some((u) => u.lastmod === today)).toBe(
      expected === today, // only legitimate if the data really was re-pulled today
    );
  });

  it('omits lastmod on routes whose change date cannot be known', async () => {
    const urls = await buildSitemapUrls();
    const nonCard = urls.filter((u) => !u.loc.includes('/card/'));

    // Static and playstyle routes change when code changes, which the generator cannot
    // observe. Absent is handled gracefully by Google; fabricated is not.
    expect(nonCard.length).toBeGreaterThan(0);
    expect(nonCard.every((u) => u.lastmod === undefined)).toBe(true);
  });

  it('produces byte-identical output across runs when no card data changed', async () => {
    const a = renderSitemap(await buildSitemapUrls());
    const b = renderSitemap(await buildSitemapUrls());
    expect(a).toBe(b);
  });

  it('renders well-formed XML with the sitemap namespace and no priority/changefreq', async () => {
    const xml = renderSitemap(await buildSitemapUrls());
    const count = (re) => (xml.match(re) || []).length;
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml).not.toContain('<priority>');
    expect(xml).not.toContain('<changefreq>');
    // Balanced tags: one <loc> per <url>. <lastmod> is optional and now appears only on
    // card entries (#525), so it must be present-but-fewer, never more.
    expect(count(/<url>/g)).toBe(count(/<\/url>/g));
    expect(count(/<loc>/g)).toBe(count(/<url>/g));
    expect(count(/<lastmod>/g)).toBeGreaterThan(0);
    expect(count(/<lastmod>/g)).toBeLessThan(count(/<url>/g));
    expect(count(/<lastmod>/g)).toBe(count(/<\/lastmod>/g));
  });
});
