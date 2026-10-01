import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  cleanPrerenderedHtml,
  crawlRoute,
  hasReadyContent,
  isCleanShell,
  isRevealSeasonActive,
  READY_SELECTORS,
} from './prerender.mjs';

const SHELL = 'Inkweave — Master Lorcana Synergies';
const ORIGIN = 'http://localhost:4179';

/** A capture as Playwright returns it: shell title still present, origin baked into hints. */
const capture = (hintCount) =>
  `<!doctype html><html><head>` +
  `<title>${SHELL}</title>` +
  `<title>Elsa - Snow Queen | Lorcana Synergies | Inkweave</title>` +
  Array.from(
    {length: hintCount},
    (_, i) => `<link rel="modulepreload" as="script" crossorigin href="${ORIGIN}/assets/c${i}.js">`,
  ).join('') +
  `</head><body><h1>Elsa - Snow Queen</h1></body></html>`;

describe('cleanPrerenderedHtml', () => {
  it('strips the shell title, leaving exactly one', () => {
    const out = cleanPrerenderedHtml(capture(0), SHELL, ORIGIN);
    expect(out).not.toContain(`<title>${SHELL}</title>`);
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out).toContain('Elsa - Snow Queen | Lorcana Synergies');
  });

  it('removes EVERY origin occurrence, not just the first', () => {
    // The regression this guards: `.replace()` instead of `.replaceAll()` would strip
    // one hint and leave 13, which no spot check of the built output would catch.
    const out = cleanPrerenderedHtml(capture(14), SHELL, ORIGIN);
    expect(out).not.toContain('localhost');
    expect(out.match(/href="\/assets\/c\d+\.js"/g)).toHaveLength(14);
  });

  it('makes the hints root-relative rather than deleting them', () => {
    const out = cleanPrerenderedHtml(capture(1), SHELL, ORIGIN);
    expect(out).toContain('href="/assets/c0.js"');
    expect(out).toContain('rel="modulepreload"');
  });

  it('leaves a capture with no origin references unchanged apart from the title', () => {
    const html = `<html><head><title>${SHELL}</title><title>Real</title></head><body>x</body></html>`;
    expect(cleanPrerenderedHtml(html, SHELL, ORIGIN)).toBe(
      '<html><head><title>Real</title></head><body>x</body></html>',
    );
  });

  it('does not corrupt content that merely contains the word localhost', () => {
    // Only the full origin is rewritten. A card name or prose mentioning the word must
    // survive — the strip is anchored on `http://localhost:PORT`, not on `localhost`.
    const html = `<html><head><title>Real</title></head><body>Running on localhost is fine</body></html>`;
    expect(cleanPrerenderedHtml(html, SHELL, ORIGIN)).toContain('Running on localhost is fine');
  });

  it('is a no-op when the shell title is absent (already-clean input)', () => {
    const html = `<html><head><title>Real</title></head><body>x</body></html>`;
    expect(cleanPrerenderedHtml(html, SHELL, ORIGIN)).toBe(html);
  });

  it('ships the static hero logo even though the crawl captured the animated one', () => {
    // The capture happens after `load`, when HeroSection has already swapped to the
    // animated logo (#639). The shipped page must paint the static file first.
    const html =
      `<html><head><title>Real</title></head><body><h1>` +
      `<img src="/brand/logo-animated.svg" alt="Inkweave"></h1></body></html>`;
    const out = cleanPrerenderedHtml(html, SHELL, ORIGIN);
    expect(out).toContain('<img src="/brand/logo-static.svg" alt="Inkweave">');
    expect(out).not.toContain('logo-animated');
  });
});

describe('isCleanShell', () => {
  it('accepts an untouched build shell', () => {
    const shell = `<!doctype html><html><head><title>${SHELL}</title></head><body><div id="root"></div></body></html>`;
    expect(isCleanShell(shell, SHELL)).toBe(true);
  });

  it('rejects what a previous crawl wrote to dist/index.html', () => {
    // The bug (#542): the home route's outDir IS dist, so crawling `/` replaces the shell.
    // A second process then serves this as every route's shell, and every capture inherits
    // HomePage's <Seo> metadata.
    const crawledHome = cleanPrerenderedHtml(
      `<!doctype html><html><head><title>${SHELL}</title>` +
        `<title>Inkweave | Disney Lorcana Synergy Finder &amp; Deck Builder</title>` +
        `<link rel="canonical" href="${ORIGIN}/"></head><body><h1>Inkweave</h1></body></html>`,
      SHELL,
      ORIGIN,
    );
    expect(isCleanShell(crawledHome, SHELL)).toBe(false);
  });

  it('rejects every output cleanPrerenderedHtml produces', () => {
    // Ties the guard to its real producer rather than to a hand-written fixture: the
    // cleaner's job is to strip the shell title, so its output is by definition never a
    // clean shell. If that ever stopped holding, the guard would silently pass on
    // corrupted input — which is the exact failure this issue exists to prevent.
    expect(isCleanShell(cleanPrerenderedHtml(capture(3), SHELL, ORIGIN), SHELL)).toBe(false);
  });

  it('is not fooled by the exact shell title sitting inside an HTML comment', () => {
    // index.html documents the shell title in prose right beside it ("<title> above is a
    // fallback for routes without <Seo>"). A comment carrying the FULL literal would
    // otherwise make a crawled shell look clean — so the marker here is byte-for-byte what
    // the predicate searches for, not a near-miss that would pass either way.
    const crawled = `<html><head><!-- <title>${SHELL}</title> --><title>Real</title></head><body>x</body></html>`;
    expect(isCleanShell(crawled, SHELL)).toBe(false);
  });

  it('still accepts a clean shell that carries commentary about the title', () => {
    // The comment strip must not be so eager that a real build is rejected: index.html
    // ships both the live <title> and comments discussing it.
    const shell =
      `<!doctype html><html><head><!-- <title> above is a fallback for routes without <Seo> -->` +
      `<title>${SHELL}</title></head><body><div id="root"></div></body></html>`;
    expect(isCleanShell(shell, SHELL)).toBe(true);
  });
});

/**
 * Gates whether `/reveals` is crawled. Off-season the route redirects to '/', so
 * crawling it then would write the HOME page's render to /reveals/index.html — the
 * exact failure prerendering it is meant to fix.
 */
describe('isRevealSeasonActive', () => {
  const NOW = new Date('2026-09-23T00:00:00Z');

  it('is active while a set is still unreleased', () => {
    const preview = {sets: {14: {releaseDate: '2026-10-23'}}};
    expect(isRevealSeasonActive(preview, NOW)).toBe(true);
  });

  it('is over once the release date has passed', () => {
    const preview = {sets: {13: {releaseDate: '2026-07-24'}}};
    expect(isRevealSeasonActive(preview, NOW)).toBe(false);
  });

  it('stays active when any one set is still unreleased', () => {
    const preview = {sets: {13: {releaseDate: '2026-07-24'}, 14: {releaseDate: '2026-10-23'}}};
    expect(isRevealSeasonActive(preview, NOW)).toBe(true);
  });

  it('treats absent, empty or dateless preview data as no season', () => {
    expect(isRevealSeasonActive(undefined, NOW)).toBe(false);
    expect(isRevealSeasonActive({sets: {}}, NOW)).toBe(false);
    expect(isRevealSeasonActive({sets: {14: {}}}, NOW)).toBe(false);
  });
});

describe('READY_SELECTORS', () => {
  it('makes /browse wait for the card links the render guard requires', () => {
    // check-rendered-html fails the deploy unless browse/index.html contains href="/card/
    expect(READY_SELECTORS['/browse']).toBe('a[href^="/card/"]');
  });

  it('keeps every other route on the title check alone', () => {
    expect(Object.keys(READY_SELECTORS)).toEqual(['/browse']);
  });
});

/**
 * The content wait inside one attempt (#584), against a stand-in page. A route without a
 * ready selector must never wait, and a wait that times out must report "no content"
 * instead of throwing out of the attempt.
 */
describe('hasReadyContent', () => {
  const pageWhoseWait = (outcome) => ({waitForSelector: vi.fn(outcome)});

  it('passes a route without a ready selector at once, without waiting', async () => {
    const page = pageWhoseWait(async () => {});
    expect(await hasReadyContent(page, undefined)).toBe(true);
    expect(page.waitForSelector).not.toHaveBeenCalled();
  });

  it('reports content once the selector attaches', async () => {
    const page = pageWhoseWait(async () => ({}));
    expect(await hasReadyContent(page, READY_SELECTORS['/browse'])).toBe(true);
    expect(page.waitForSelector).toHaveBeenCalledWith(
      READY_SELECTORS['/browse'],
      expect.objectContaining({state: 'attached'}),
    );
  });

  it('reports no content when the wait times out, instead of throwing', async () => {
    const page = pageWhoseWait(async () => {
      throw new Error('page.waitForSelector: Timeout 15000ms exceeded.');
    });
    expect(await hasReadyContent(page, READY_SELECTORS['/browse'])).toBe(false);
  });
});

/**
 * The re-crawl around a single attempt (#584). The attempt is a stand-in that returns
 * scripted outcomes in order, so the retry rules are checked without a browser.
 */
describe('crawlRoute', () => {
  const MISS = {ok: false, error: 'content never rendered (a[href^="/card/"])'};
  const attemptsReturning = (...outcomes) => vi.fn(async (route) => ({route, ...outcomes.shift()}));

  let warn;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('re-crawls /browse after a miss and stops at the first success', async () => {
    const crawlOnce = attemptsReturning(MISS, {ok: true}, {ok: true});
    expect(await crawlRoute('/browse', crawlOnce)).toEqual({route: '/browse', ok: true});
    expect(crawlOnce).toHaveBeenCalledTimes(2);
    expect(crawlOnce).toHaveBeenCalledWith('/browse', READY_SELECTORS['/browse']);
  });

  it('gives up after 3 misses and returns the last failure', async () => {
    const crawlOnce = attemptsReturning(
      {ok: false, error: 'first'},
      {ok: false, error: 'second'},
      {ok: false, error: 'third'},
      {ok: true},
    );
    expect(await crawlRoute('/browse', crawlOnce)).toEqual({
      route: '/browse',
      ok: false,
      error: 'third',
    });
    expect(crawlOnce).toHaveBeenCalledTimes(3);
  });

  it('crawls a route without a ready selector once, even if a retry would succeed', async () => {
    // Blanket retries would make a genuinely broken crawl take up to 3x longer to reach
    // main()'s failure-rate guard.
    const crawlOnce = attemptsReturning(
      {ok: false, error: 'title never left the shell'},
      {ok: true},
    );
    expect((await crawlRoute('/about', crawlOnce)).ok).toBe(false);
    expect(crawlOnce).toHaveBeenCalledTimes(1);
    expect(crawlOnce).toHaveBeenCalledWith('/about', undefined);
  });

  it('logs each retry, leaving the final failure for main() to report', async () => {
    await crawlRoute('/browse', attemptsReturning(MISS, MISS, MISS));
    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      `[prerender] retry /browse (1/3): ${MISS.error}`,
      `[prerender] retry /browse (2/3): ${MISS.error}`,
    ]);
  });
});
