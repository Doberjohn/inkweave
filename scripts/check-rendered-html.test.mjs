import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  asCapturedText,
  selectSampleCards,
  findDesktopOnlyEagerImages,
  findMissingGuideText,
  findOffenders,
  findOrphanImagePreloads,
  findLazySdkPreloads,
  findPhoneCaptureProblems,
  findPlaystyleGuideOffenders,
  readCanonical,
  readPrerenderRoute,
  SITE_ORIGIN,
} from './check-rendered-html.mjs';
import {CAPTURE_MEDIA} from './lib/captureMedia.mjs';

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

/** The phone capture the crawl puts right after #root (#915): the page in its phone layout. */
const phoneCapture = (content) =>
  `<template id="prerender-phone"><main data-layout="phone">${content}</main></template>`;

/**
 * A captured page's #root, marked with the route it was captured on, and its phone capture
 * (#915).
 */
const markedRoot = (route, content = '') =>
  `<div id="root" data-prerender-route="${route}">${content}</div>${phoneCapture(content)}`;

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

  describe('on a page with a phone capture (#915)', () => {
    const ART = `<img alt="" src="${STALE}">`;
    const preload = (media) => `<link rel="preload" as="image" href="${STALE}"${media}>`;
    const page = (head, root, phone) =>
      `<head>${head}</head><body><div id="root">${root}</div>${phoneCapture(phone)}</body>`;
    const PHONE = ` media="${CAPTURE_MEDIA.phone}"`;
    const DESKTOP = ` media="${CAPTURE_MEDIA.desktop}"`;

    it("passes each screen's preload whose image the capture for that screen renders", () => {
      expect(findOrphanImagePreloads(page(preload(PHONE) + preload(DESKTOP), ART, ART))).toEqual(
        [],
      );
    });

    it('flags a preload for the phone whose image only the desktop capture renders', () => {
      expect(findOrphanImagePreloads(page(preload(PHONE), ART, ''))).toEqual([STALE]);
    });

    it.each([
      ['the desktop', DESKTOP],
      ['every screen', ''],
    ])('flags a preload for %s whose image only the phone capture renders', (_label, media) => {
      expect(findOrphanImagePreloads(page(preload(media), '', ART))).toEqual([STALE]);
    });
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

describe('findDesktopOnlyEagerImages', () => {
  it("finds each eager image in #root that the phone capture doesn't show, once", () => {
    const desktop =
      '<img src="/brand/logo.svg" alt=""><img alt="" src="/assets/rare.svg"><img src="/brand/logo.svg">';
    expect(findDesktopOnlyEagerImages(desktop, '<p>phone</p>')).toEqual([
      '/brand/logo.svg',
      '/assets/rare.svg',
    ]);
  });

  it('passes the images a phone never fetches before the swap, and the ones its capture shows', () => {
    const desktop =
      '<img loading="lazy" src="/brand/logo.svg"><img src="data:image/gif;base64,R0lGOD">' +
      '<img src="/card-images/1.avif" fetchpriority="high">';
    const phone = '<img alt="" src="/card-images/1.avif" loading="lazy">';
    expect(findDesktopOnlyEagerImages(desktop, phone)).toEqual([]);
  });
});

describe('findPhoneCaptureProblems', () => {
  const page = (root, template) =>
    `<html><body><div id="root" data-prerender-route="/">${root}</div>${template}` +
    '<script>approve()</script></body></html>';

  it('passes a page with a phone capture of its own', () => {
    expect(findPhoneCaptureProblems(page('<h1>Desk</h1>', phoneCapture('<h1>Phone</h1>')))).toEqual(
      [],
    );
  });

  it.each([
    ['none', '', 'has no phone capture, so a phone gets the desktop layout (#915)'],
    [
      'an empty one',
      '<template id="prerender-phone"> </template>',
      'its phone capture is empty, so a phone shows a blank page (#915)',
    ],
    [
      'the desktop markup again',
      '<template id="prerender-phone"><h1>Desk</h1></template>',
      'its phone capture is the desktop markup again (#915)',
    ],
  ])('fails a page whose phone capture is %s', (_label, template, reason) => {
    expect(findPhoneCaptureProblems(page('<h1>Desk</h1>', template))).toEqual([reason]);
  });

  it("fails a page whose #root has an eager image the phone capture doesn't show", () => {
    const html = page('<img src="/brand/logo.svg" alt="">', phoneCapture('<h1>Phone</h1>'));
    expect(findPhoneCaptureProblems(html)).toEqual([
      "a phone fetches /brand/logo.svg for nothing: eager in #root, and the phone capture doesn't show them (#915)",
    ]);
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

  it('fails a card page shipped without its phone capture, and / and /browse too (#915)', () => {
    seedGoodBuild();
    const cardFile = path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html');
    for (const file of [
      cardFile,
      path.join(dist, 'index.html'),
      path.join(dist, 'browse', 'index.html'),
    ]) {
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8').replace(/<template[\s\S]*<\/template>/, ''),
      );
    }
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders.map((o) => o.file)).toEqual([
      cardFile,
      path.join(dist, 'index.html'),
      path.join(dist, 'browse', 'index.html'),
    ]);
    expect(new Set(offenders.map((o) => o.reason))).toEqual(
      new Set(['has no phone capture, so a phone gets the desktop layout (#915)']),
    );
  });

  it('skips the phone capture check when the crawl skipped phones (PRERENDER_PHONE=0)', () => {
    seedGoodBuild();
    const homeFile = path.join(dist, 'index.html');
    fs.writeFileSync(
      homeFile,
      fs.readFileSync(homeFile, 'utf8').replace(/<template[\s\S]*<\/template>/, ''),
    );
    expect(findOffenders(dist, [CARD], cardPath, {phones: false})).toEqual([]);
  });

  it("reads /browse's card links from its desktop capture alone, as crawlers do", () => {
    seedGoodBuild();
    // Only the inert phone capture links a card.
    fs.writeFileSync(
      path.join(dist, 'browse', 'index.html'),
      '<html><body><div id="root" data-prerender-route="/browse"></div>' +
        `${phoneCapture('<a href="/card/1989/elsa-snow-queen">Elsa</a>')}</body></html>`,
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders.map((o) => o.reason)).toEqual(['links no /card/ URLs (empty shell?)']);
  });

  it('fails a /browse phone capture that links no card URLs (#931)', () => {
    seedGoodBuild();
    // Read while the phone page's grid drew no rows.
    fs.writeFileSync(
      path.join(dist, 'browse', 'index.html'),
      '<html><body><div id="root" data-prerender-route="/browse">' +
        `<a href="/card/1989/elsa-snow-queen">Elsa</a></div>${phoneCapture('<h1>Browse</h1>')}` +
        '</body></html>',
    );
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders.map((o) => o.reason)).toEqual([
      'its phone capture links no /card/ URLs, so a phone shows no cards (#931)',
    ]);
  });

  it('distinguishes a wrong target path from a failed crawl', () => {
    const offenders = findOffenders(path.join(dist, 'no-such-dir'), [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/wrong path/);
  });
});

describe('asCapturedText', () => {
  it('escapes text as the browser writes it: &, <, > and the no-break space, never a quote', () => {
    const noBreakSpace = String.fromCodePoint(0xa0);
    expect(asCapturedText(`Pooh & Piglet <3 > "Owl"'s${noBreakSpace}book`)).toBe(
      `Pooh &amp; Piglet &lt;3 &gt; "Owl"'s&nbsp;book`,
    );
  });
});

/** Two playstyles as the engine lists them (#995). */
const PLAYSTYLES = [
  {id: 'exert', name: 'Exert'},
  {id: 'hunny', name: 'Hunny'},
];

/** Their guides as the build's data/playstyleGuides.json holds them, an apostrophe and an & included. */
const GUIDES = {
  exert: {paragraphs: ["Exert decks can't wait.", 'Pick a second ink & build.'], keyCards: ['1989']},
  hunny: {paragraphs: ['Hunny decks quest.', 'Play the cheap ones first.'], keyCards: ['3032']},
};

/** A guide as the crawl's browser writes it into a capture (#995). */
const guideMarkup = (name, {paragraphs}) =>
  '<section aria-labelledby="playstyle-guide-heading">' +
  `<h2 id="playstyle-guide-heading" style="margin: 0px">How to play ${name}</h2>` +
  paragraphs.map((text) => `<p style="margin: 0px">${asCapturedText(text)}</p>`).join('') +
  '</section>';

/** A playstyle page's file in the build. */
const playstyleFile = (id) => path.join(dist, 'playstyles', id, 'index.html');

/** A captured playstyle page: its #root, then its phone capture, each as given. */
const playstylePage = (id, desktop, phone = desktop) =>
  `<!doctype html><html><body><div id="root" data-prerender-route="/playstyles/${id}">` +
  `${desktop}</div>${phone === null ? '' : phoneCapture(phone)}</body></html>`;

/** Writes the build's guides file and a page carrying its guide in both captures for each playstyle. */
function seedPlaystyles(playstyles = PLAYSTYLES) {
  fs.mkdirSync(path.join(dist, 'data'), {recursive: true});
  fs.writeFileSync(path.join(dist, 'data', 'playstyleGuides.json'), JSON.stringify(GUIDES));
  for (const {id, name} of playstyles) {
    fs.mkdirSync(path.dirname(playstyleFile(id)), {recursive: true});
    const content = `<h1>${name}</h1>${guideMarkup(name, GUIDES[id])}`;
    fs.writeFileSync(playstyleFile(id), playstylePage(id, content));
  }
}

const check11 = (phones = true) => findPlaystyleGuideOffenders(dist, PLAYSTYLES, {phones});

describe('findPlaystyleGuideOffenders (check 11, #995)', () => {
  it('passes playstyle pages that carry their guide in both captures', () => {
    seedPlaystyles();
    expect(check11()).toEqual([]);
  });

  it('fails a playstyle page the crawl never wrote, as a missing page serves crawlers no guide', () => {
    seedPlaystyles([PLAYSTYLES[0]]);
    expect(check11()).toEqual([
      {file: playstyleFile('hunny'), reason: 'prerendered playstyle page missing (#995)'},
    ]);
  });

  it('fails a page whose desktop capture lacks a paragraph, naming the page and the paragraph', () => {
    seedPlaystyles();
    const phone = `<h1>Exert</h1>${guideMarkup('Exert', GUIDES.exert)}`;
    const desktop = phone.replace(/<p [^>]*>Pick a second[^<]*<\/p>/, '');
    fs.writeFileSync(playstyleFile('exert'), playstylePage('exert', desktop, phone));
    expect(check11()).toEqual([
      {file: playstyleFile('exert'), reason: "its desktop capture lacks its guide's paragraph 2 (#995)"},
    ]);
  });

  it('fails a page whose phone capture was taken without its guide', () => {
    seedPlaystyles();
    const desktop = `<h1>Exert</h1>${guideMarkup('Exert', GUIDES.exert)}`;
    fs.writeFileSync(playstyleFile('exert'), playstylePage('exert', desktop, '<h1>Exert</h1>'));
    expect(check11().map((o) => o.reason)).toEqual([
      'its phone capture lacks its guide\'s heading "How to play Exert", paragraph 1, paragraph 2 (#995)',
    ]);
  });

  it("counts a paragraph only as an element's whole text, not inside another", () => {
    const quoted = `<p>As the guide says, ${GUIDES.hunny.paragraphs[0]} Then more.</p>`;
    const markup = `<h2>How to play Hunny</h2>${quoted}<p>${GUIDES.hunny.paragraphs[1]}</p>`;
    expect(findMissingGuideText(markup, 'Hunny', GUIDES.hunny)).toEqual(['paragraph 1']);
  });

  it('reads the desktop capture alone when the crawl skipped phones, and fails a missing phone capture otherwise', () => {
    seedPlaystyles();
    const desktop = `<h1>Exert</h1>${guideMarkup('Exert', GUIDES.exert)}`;
    fs.writeFileSync(playstyleFile('exert'), playstylePage('exert', desktop, null));
    expect(check11(false)).toEqual([]);
    expect(check11().map((o) => o.reason)).toEqual([
      'has no phone capture to carry its guide (#915, #995)',
    ]);
  });

  it('fails a page whose playstyle has no guide in the build', () => {
    seedPlaystyles();
    const onlyExert = {exert: GUIDES.exert};
    fs.writeFileSync(path.join(dist, 'data', 'playstyleGuides.json'), JSON.stringify(onlyExert));
    expect(check11()).toEqual([
      {file: playstyleFile('hunny'), reason: 'has no guide in data/playstyleGuides.json to show (#995)'},
    ]);
  });

  it('fails a build without the guides file', () => {
    seedPlaystyles();
    fs.rmSync(path.join(dist, 'data'), {recursive: true});
    expect(check11().map((o) => o.reason)).toEqual([
      'missing from the build, so no playstyle page has its guide (#995)',
    ]);
  });

  it('runs inside findOffenders for the playstyles it is given, and not without them', () => {
    seedGoodBuild();
    seedPlaystyles();
    fs.writeFileSync(playstyleFile('hunny'), playstylePage('hunny', '<h1>Hunny</h1>'));
    expect(findOffenders(dist, [CARD], cardPath, {playstyles: PLAYSTYLES})).toHaveLength(2);
    expect(findOffenders(dist, [CARD], cardPath)).toEqual([]);
  });
});
