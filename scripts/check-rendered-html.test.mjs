import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  selectSampleCards,
  findOffenders,
  findOrphanImagePreloads,
  findLazySdkPreloads,
  readCanonical,
  readPrerenderRoute,
  SITE_ORIGIN,
} from './check-rendered-html.mjs';

/** Stand-in for the engine's cardPath — same shape, no engine dist needed. */
const cardPath = (c) => `/card/${c.id}/${c.slug}`;

const CARD = {id: 1989, slug: 'elsa-snow-queen', fullName: 'Elsa - Snow Queen'};

/** The site footer's ink nav, which every captured card page carries (#530). */
const FOOTER_HTML =
  '<footer aria-label="Site footer">' +
  ['amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel']
    .map((ink) => `<a href="/ink/${ink}">${ink}</a>`)
    .join('') +
  '</footer>';

/** A captured page's #root, marked with the route it was captured on (#915). */
const markedRoot = (route, content = '') =>
  `<div id="root" data-prerender-route="${route}">${content}</div>`;

/** A prerendered card page as the crawl actually writes it. */
const goodCardHtml = (card) =>
  `<!doctype html><html><head><title>${card.fullName} | Lorcana Synergies | Inkweave</title>` +
  `<link rel="canonical" href="${SITE_ORIGIN}${cardPath(card)}"/></head>` +
  `<body>${markedRoot(cardPath(card), `<h1>${card.fullName}</h1>${FOOTER_HTML}`)}</body></html>`;

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
  `<body>${markedRoot(cardPath(card), `<h1>${card.fullName}</h1>${FOOTER_HTML}`)}</body></html>`;

/** The SPA shell Vercel's rewrite serves when no prerendered file exists. */
const shellHtml =
  `<!doctype html><html><head><title>Inkweave — Master Lorcana Synergies</title>` +
  `<link rel="canonical" href="${SITE_ORIGIN}/"/></head><body><div id="root"></div></body></html>`;

let dist;

/** The home page's capture, with `head` in its <head>. */
const homeHtml = (head = '') =>
  `<!doctype html><html><head>${head}</head><body>${markedRoot('/', '<h1>Inkweave</h1>')}</body></html>`;

/** Write a well-formed build output; individual tests then break one thing. */
function seedGoodBuild(card = CARD) {
  const cardDir = path.join(dist, 'card', String(card.id), card.slug);
  fs.mkdirSync(cardDir, {recursive: true});
  fs.writeFileSync(path.join(cardDir, 'index.html'), goodCardHtml(card));

  const browseDir = path.join(dist, 'browse');
  fs.mkdirSync(browseDir, {recursive: true});
  fs.writeFileSync(
    path.join(browseDir, 'index.html'),
    `<!doctype html><html><body>${markedRoot('/browse', `<a href="/card/${card.id}/${card.slug}">${card.fullName}</a>`)}</body></html>`,
  );

  fs.writeFileSync(path.join(dist, 'index.html'), homeHtml());
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

describe('findLazySdkPreloads', () => {
  const SDK_CHUNKS = new Map([
    ['esm-D3E0E-l0.js', 'Sentry'],
    ['posthogClient-Bq3xU9kL.js', 'PostHog'],
  ]);

  it('flags a modulepreload of each lazy SDK chunk by name, whatever order its attributes come in', () => {
    const html =
      '<head><link as="script" rel="modulepreload" href="/assets/esm-D3E0E-l0.js">' +
      '<link rel="modulepreload" href="/assets/HomePage-QCEVrDYP.js">' +
      '<link rel="modulepreload" href="/assets/posthogClient-Bq3xU9kL.js"></head>';
    expect(findLazySdkPreloads(html, SDK_CHUNKS)).toEqual([
      {sdk: 'Sentry', href: '/assets/esm-D3E0E-l0.js'},
      {sdk: 'PostHog', href: '/assets/posthogClient-Bq3xU9kL.js'},
    ]);
  });

  it('passes a page whose modulepreloads are all ordinary chunks', () => {
    const html = '<head><link rel="modulepreload" crossorigin="" href="/assets/loader-BeYgltdQ.js"></head>';
    expect(findLazySdkPreloads(html, SDK_CHUNKS)).toEqual([]);
  });

  it('reads rel as a token list, so rel="modulepreload " still counts', () => {
    const html = '<head><link rel="modulepreload " href="/assets/esm-D3E0E-l0.js"></head>';
    expect(findLazySdkPreloads(html, SDK_CHUNKS)).toEqual([{sdk: 'Sentry', href: '/assets/esm-D3E0E-l0.js'}]);
  });
});

describe('readPrerenderRoute', () => {
  // Same attribute-order lesson as readCanonical.
  it.each([
    ['id first', '<div id="root" data-prerender-route="/browse">'],
    ['the mark first', '<div data-prerender-route="/browse" id="root">'],
  ])("reads #root's route with %s", (_label, tag) => {
    expect(readPrerenderRoute(`<body>${tag}<a href="/card/1">x</a></div></body>`)).toBe('/browse');
  });

  it('reads no route from an unmarked #root, nor from a mark on another element', () => {
    expect(readPrerenderRoute('<body><div id="root"></div></body>')).toBeUndefined();
    expect(
      readPrerenderRoute('<body><div id="rooted" data-prerender-route="/"></div></body>'),
    ).toBeUndefined();
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
    // Captured before its grid drew a card link (#584).
    fs.writeFileSync(
      path.join(dist, 'browse', 'index.html'),
      `<html><body>${markedRoot('/browse')}</body></html>`,
    );
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
      homeHtml('<link rel="preload" as="image" href="/card-images/1936.a-sm.avif">'),
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
      homeHtml(
        '<link rel="modulepreload" href="/assets/loader-def67890.js">' +
          '<link rel="modulepreload" as="script" href="/assets/esm-abc12345.js">',
      ),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].file).toBe(path.join(dist, 'index.html'));
    expect(offenders[0].reason).toMatch(/esm-abc12345\.js/);
  });

  it('fails when a crawled card page modulepreloads the PostHog SDK, found by its name string (#827)', () => {
    seedGoodBuild();
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'assets', 'posthogClient-ghi34567.js'), 'console.warn("[PostHog.js]", msg);');
    const cardFile = path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html');
    fs.writeFileSync(
      cardFile,
      goodCardHtml(CARD).replace(
        '</head>',
        '<link rel="modulepreload" as="script" href="/assets/posthogClient-ghi34567.js"></head>',
      ),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].file).toBe(cardFile);
    expect(offenders[0].reason).toMatch(/PostHog SDK \(\/assets\/posthogClient-ghi34567\.js\)/);
  });

  it('fails when a card page was captured before its footer rendered (#532)', () => {
    seedGoodBuild();
    // The footer is the only thing on a card page that links the ink hubs.
    fs.writeFileSync(
      path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html'),
      goodCardHtml(CARD).replace(FOOTER_HTML, ''),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/links 0 of the 6 ink hubs/);
  });

  it('does not count a misspelled ink hub link as one of the six', () => {
    seedGoodBuild();
    fs.writeFileSync(
      path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html'),
      goodCardHtml(CARD).replace('href="/ink/steel"', 'href="/ink/steeel"'),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/links 5 of the 6 ink hubs/);
  });

  it('fails a card page captured without its route mark (#915)', () => {
    seedGoodBuild();
    const cardFile = path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html');
    fs.writeFileSync(
      cardFile,
      goodCardHtml(CARD).replace(' data-prerender-route="/card/1989/elsa-snow-queen"', ''),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toEqual([
      {
        file: cardFile,
        reason: '#root is marked with no route, expected "/card/1989/elsa-snow-queen" (#915)',
      },
    ]);
  });

  it('fails a home page marked with another route, which every route without a capture is served (#915)', () => {
    seedGoodBuild();
    fs.writeFileSync(
      path.join(dist, 'index.html'),
      homeHtml().replace('data-prerender-route="/"', 'data-prerender-route="/browse"'),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toEqual([
      {
        file: path.join(dist, 'index.html'),
        reason: '#root is marked "/browse", expected "/" (#915)',
      },
    ]);
  });

  it('fails a /browse capture without its route mark (#915)', () => {
    seedGoodBuild();
    const browseFile = path.join(dist, 'browse', 'index.html');
    fs.writeFileSync(
      browseFile,
      fs.readFileSync(browseFile, 'utf8').replace(' data-prerender-route="/browse"', ''),
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toEqual([
      {file: browseFile, reason: '#root is marked with no route, expected "/browse" (#915)'},
    ]);
  });

  it('distinguishes a wrong target path from a failed crawl', () => {
    const offenders = findOffenders(path.join(dist, 'no-such-dir'), [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/wrong path/);
  });
});
