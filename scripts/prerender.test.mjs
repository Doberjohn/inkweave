import {describe, it, expect} from 'vitest';
import {cleanPrerenderedHtml, isCleanShell} from './prerender.mjs';

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
