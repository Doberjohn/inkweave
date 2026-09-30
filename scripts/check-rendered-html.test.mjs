import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  selectSampleCards,
  findOffenders,
  findOrphanImagePreloads,
  findSentryPreloads,
  readCanonical,
  SITE_ORIGIN,
} from './check-rendered-html.mjs';

/** Stand-in for the engine's cardPath — same shape, no engine dist needed. */
const cardPath = (c) => `/card/${c.id}/${c.slug}`;

const CARD = {id: 1989, slug: 'elsa-snow-queen', fullName: 'Elsa - Snow Queen'};

/** A prerendered card page as the crawl actually writes it. */
const goodCardHtml = (card) =>
  `<!doctype html><html><head><title>${card.fullName} | Lorcana Synergies | Inkweave</title>` +
  `<link rel="canonical" href="${SITE_ORIGIN}${cardPath(card)}"/></head>` +
  `<body><h1>${card.fullName}</h1></body></html>`;

/**
 * The same page as React actually hoists it since #535: `<Seo>` stamps `data-seo`
 * on every tag it owns, and React emits attributes in JSX order, so `rel` is no
 * longer first. This exact shape shipped on 2026-07-28 and silently blocked every
 * production deploy for two months, because the guard's reader required `rel` to
 * lead. The canonical was present and correct the whole time.
 */
const goodCardHtmlWithSeoMarker = (card) =>
  `<!doctype html><html><head><title data-seo="">${card.fullName} | Lorcana Synergies | Inkweave</title>` +
  `<link data-seo="" rel="canonical" href="${SITE_ORIGIN}${cardPath(card)}"/></head>` +
  `<body><h1>${card.fullName}</h1></body></html>`;

/** The SPA shell Vercel's rewrite serves when no prerendered file exists. */
const shellHtml =
  `<!doctype html><html><head><title>Inkweave — Master Lorcana Synergies</title>` +
  `<link rel="canonical" href="${SITE_ORIGIN}/"/></head><body><div id="root"></div></body></html>`;

let dist;

/** Write a well-formed build output; individual tests then break one thing. */
function seedGoodBuild(card = CARD) {
  const cardDir = path.join(dist, 'card', String(card.id), card.slug);
  fs.mkdirSync(cardDir, {recursive: true});
  fs.writeFileSync(path.join(cardDir, 'index.html'), goodCardHtml(card));

  const browseDir = path.join(dist, 'browse');
  fs.mkdirSync(browseDir, {recursive: true});
  fs.writeFileSync(
    path.join(browseDir, 'index.html'),
    `<!doctype html><html><body><a href="/card/${card.id}/${card.slug}">${card.fullName}</a></body></html>`,
  );
}

beforeEach(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'render-guard-'));
});

afterEach(() => {
  fs.rmSync(dist, {recursive: true, force: true});
});

describe('selectSampleCards', () => {
  const corpus = (n) => Array.from({length: n}, (_, i) => ({id: i, fullName: `card ${i}`}));

  it('spreads across the corpus instead of sampling only the head', () => {
    const picked = selectSampleCards(corpus(1024));
    const indices = picked.map((c) => c.id);
    expect(indices[0]).toBe(0);
    expect(new Set(indices).size).toBe(indices.length);
    expect(Math.max(...indices)).toBeGreaterThan(800);
  });

  it('always includes the tail, where a killed crawl stops writing', () => {
    const cards = corpus(1024);
    expect(selectSampleCards(cards)).toContain(cards.at(-1));
  });

  it('is deterministic — two calls pick the same pages', () => {
    const cards = corpus(1024);
    expect(selectSampleCards(cards)).toEqual(selectSampleCards(cards));
  });

  it('degrades safely on corpora smaller than the sample size', () => {
    expect(selectSampleCards(corpus(0))).toHaveLength(0);
    expect(selectSampleCards(corpus(1))).toHaveLength(1);
    expect(selectSampleCards(corpus(3))).toHaveLength(3);
  });
});

describe('readCanonical', () => {
  // Attribute order is not a contract: React emits them in JSX prop order, so a new
  // prop ahead of `rel` reorders the markup. Both shapes below have shipped.
  it.each([
    ['rel first', `<link rel="canonical" href="${SITE_ORIGIN}/x">`],
    ['a marker first', `<link data-seo="" rel="canonical" href="${SITE_ORIGIN}/x">`],
    ['href first', `<link href="${SITE_ORIGIN}/x" rel="canonical">`],
  ])('reads the href with %s', (_label, tag) => {
    expect(readCanonical(`<head>${tag}</head>`)).toBe(`${SITE_ORIGIN}/x`);
  });

  it('returns undefined when the page carries no canonical at all', () => {
    expect(readCanonical('<head><link rel="icon" href="/favicon.png"></head>')).toBeUndefined();
  });
});

describe('findOrphanImagePreloads', () => {
  const STALE = '/card-images/1936.0f8a7611d75f31a7-sm.avif';

  // Same attribute-order lesson as readCanonical: read the tag either way round.
  it.each([
    ['rel first', `<link rel="preload" as="image" href="${STALE}">`],
    ['as first', `<link as="image" rel="preload" href="${STALE}">`],
    // rel is a token list: padding and case don't stop the browser from preloading.
    ['a padded, mixed-case rel', `<link rel=" Preload " as="image" href="${STALE}">`],
  ])('flags an image preload the page never renders, with %s', (_label, tag) => {
    expect(findOrphanImagePreloads(`<head>${tag}</head><body></body>`)).toEqual([STALE]);
  });

  it('passes an image preload whose image the page renders', () => {
    const html = `<head><link rel="preload" as="image" href="${STALE}"></head><body><img alt="" src="${STALE}"></body>`;
    expect(findOrphanImagePreloads(html)).toEqual([]);
  });

  it('ignores font preloads, which index.html ships on purpose', () => {
    const html =
      '<head><link rel="preload" href="/fonts/plus-jakarta-sans-400.woff2" as="font" type="font/woff2" crossorigin=""></head>';
    expect(findOrphanImagePreloads(html)).toEqual([]);
  });
});

describe('findSentryPreloads', () => {
  const SENTRY_CHUNKS = new Set(['esm-D3E0E-l0.js']);

  it('flags a modulepreload of a Sentry chunk, whatever order its attributes come in', () => {
    const html =
      '<head><link as="script" rel="modulepreload" href="/assets/esm-D3E0E-l0.js">' +
      '<link rel="modulepreload" href="/assets/HomePage-QCEVrDYP.js"></head>';
    expect(findSentryPreloads(html, SENTRY_CHUNKS)).toEqual(['/assets/esm-D3E0E-l0.js']);
  });

  it('passes a page whose modulepreloads are all ordinary chunks', () => {
    const html = '<head><link rel="modulepreload" crossorigin="" href="/assets/loader-BeYgltdQ.js"></head>';
    expect(findSentryPreloads(html, SENTRY_CHUNKS)).toEqual([]);
  });

  it('reads rel as a token list, so rel="modulepreload " still counts', () => {
    const html = '<head><link rel="modulepreload " href="/assets/esm-D3E0E-l0.js"></head>';
    expect(findSentryPreloads(html, SENTRY_CHUNKS)).toEqual(['/assets/esm-D3E0E-l0.js']);
  });
});

describe('findOffenders', () => {
  it('passes a well-formed build', () => {
    seedGoodBuild();
    expect(findOffenders(dist, [CARD], cardPath)).toEqual([]);
  });

  it('reads the canonical whatever order its attributes come in', () => {
    seedGoodBuild();
    fs.writeFileSync(
      path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html'),
      goodCardHtmlWithSeoMarker(CARD),
    );
    expect(findOffenders(dist, [CARD], cardPath)).toEqual([]);
  });

  it('fails when the card page was never written (crawl did not run)', () => {
    seedGoodBuild();
    fs.rmSync(path.join(dist, 'card'), {recursive: true});
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/missing/);
  });

  it('fails when the card page is an SPA shell carrying the homepage canonical', () => {
    seedGoodBuild();
    fs.writeFileSync(path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html'), shellHtml);
    const reasons = findOffenders(dist, [CARD], cardPath).map((o) => o.reason);
    // Both signals fire: no card name in the body, and a non-self-referential canonical.
    expect(reasons.some((r) => r.includes('Elsa - Snow Queen'))).toBe(true);
    expect(reasons.some((r) => r.includes(`${SITE_ORIGIN}/card/1989/elsa-snow-queen`))).toBe(true);
  });

  it('fails when /browse links no card URLs', () => {
    seedGoodBuild();
    fs.writeFileSync(path.join(dist, 'browse', 'index.html'), shellHtml);
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/no \/card\/ URLs/);
  });

  it('reports every offender at once rather than stopping at the first', () => {
    // Nothing seeded: both the card page and /browse are missing.
    expect(findOffenders(dist, [CARD], cardPath).length).toBeGreaterThan(1);
  });

  it("fails when the crawl server's origin leaked into the shipped HTML", () => {
    seedGoodBuild();
    const cardFile = path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html');
    fs.writeFileSync(
      cardFile,
      goodCardHtml(CARD).replace(
        '</head>',
        '<link rel="modulepreload" as="script" href="http://localhost:4179/assets/x.js"></head>',
      ),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/localhost/);
  });

  it('fails when a card page preloads an image it never renders (#627)', () => {
    seedGoodBuild();
    const cardFile = path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html');
    fs.writeFileSync(
      cardFile,
      goodCardHtml(CARD).replace(
        '</head>',
        '<link rel="preload" as="image" href="/card-images/1936.a-sm.avif"></head>',
      ),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/1936\.a-sm\.avif/);
  });

  it('checks the homepage for orphan image preloads too, not only card pages', () => {
    seedGoodBuild();
    fs.writeFileSync(
      path.join(dist, 'index.html'),
      '<!doctype html><html><head><link rel="preload" as="image" href="/card-images/1936.a-sm.avif"></head><body></body></html>',
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].file).toBe(path.join(dist, 'index.html'));
  });

  it('fails when a crawled page modulepreloads the Sentry SDK, found by its name string (#640)', () => {
    seedGoodBuild();
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'assets', 'esm-abc12345.js'), 'const sdk = {name: "sentry.javascript.react"};');
    fs.writeFileSync(path.join(dist, 'assets', 'loader-def67890.js'), 'export const load = 1;');
    fs.writeFileSync(
      path.join(dist, 'index.html'),
      '<!doctype html><html><head><link rel="modulepreload" href="/assets/loader-def67890.js">' +
        '<link rel="modulepreload" as="script" href="/assets/esm-abc12345.js"></head><body></body></html>',
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].file).toBe(path.join(dist, 'index.html'));
    expect(offenders[0].reason).toMatch(/esm-abc12345\.js/);
  });

  it('distinguishes a wrong target path from a failed crawl', () => {
    const offenders = findOffenders(path.join(dist, 'no-such-dir'), [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/wrong path/);
  });
});
