import {describe, it, expect} from 'vitest';
import {cleanPrerenderedHtml} from './prerender.mjs';

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
