import {describe, it, expect} from 'vitest';
import {compareProblems, readShape, shapeProblems, sizeDeltas} from './check-bundle-shape.mjs';

const CRITICAL_CSS =
  'body{margin:0}:focus-visible{outline:2px solid}.inset-focus-ring{outline-offset:-2px}' +
  '@keyframes inkweave-foil-sweep{to{background-position:160% 0}}' +
  '@keyframes inkweave-qty-pop{50%{scale:1.2}}.overlay-transition{transition:opacity .2s}' +
  '.touch-target{min-width:44px}@media (prefers-reduced-motion:reduce){' +
  '.inkweave-foil-shimmer{animation:none!important}.overlay-transition{transition:none!important}}';

/** index.html as the build writes it: the entry, its modulepreloads and the inlined CSS. */
function indexHtml({
  preloads = ['rolldown-runtime', 'startup-vendor', 'startup-shared'],
  css = CRITICAL_CSS,
} = {}) {
  const links = preloads.map(
    (name) => `<link rel="modulepreload" crossorigin href="/assets/${name}.js">`,
  );
  return [
    '<!doctype html><html><head>',
    '<script type="application/ld+json">{}</script>',
    '<script type="module" crossorigin src="/assets/index.js"></script>',
    ...links,
    '<style>#root{display:block}</style>',
    `<style>${css}</style>`,
    '</head><body><div id="root"></div><script>window.x = 1;</script></body></html>',
  ].join('');
}

const ROWS = [
  {name: 'User-facing JS', size: 419_000},
  {name: 'Entry chunk', size: 27_000},
  {name: 'Card data JSON', size: 113_000},
];
const build = (sizes = ROWS, html = indexHtml()) => ({sizes, html});
const grow = (name, bytes) =>
  ROWS.map((row) => (row.name === name ? {...row, size: row.size + bytes} : row));

describe('shapeProblems', () => {
  it('passes four startup JS files and the critical CSS', () => {
    expect(shapeProblems(indexHtml())).toEqual([]);
    expect(readShape(indexHtml())).toMatchObject({jsFiles: expect.any(Array), styleBlocks: 2});
  });

  it('counts only the module entry and its modulepreloads', () => {
    expect(readShape(indexHtml()).jsFiles).toEqual([
      '/assets/index.js',
      '/assets/rolldown-runtime.js',
      '/assets/startup-vendor.js',
      '/assets/startup-shared.js',
    ]);
  });

  it('fails a module split into a fifth startup file', () => {
    const html = indexHtml({
      preloads: ['rolldown-runtime', 'startup-vendor', 'startup-shared', 'CtaButton'],
    });
    expect(shapeProblems(html)).toEqual([
      expect.stringContaining('startup loads 5 JS files, not 4'),
    ]);
  });

  it('names each critical rule the inlined CSS lacks', () => {
    expect(shapeProblems(indexHtml({css: '.card-tile{color:red}'}))).toHaveLength(7);
    expect(
      shapeProblems(indexHtml({css: CRITICAL_CSS.replace('.overlay-transition{', '.x{')})),
    ).toEqual([expect.stringContaining('overlay-transition')]);
  });

  it('takes the reduced-motion overlay override only inside its media query', () => {
    const outside = CRITICAL_CSS.replace(
      '@media (prefers-reduced-motion:reduce){',
      '@media print{',
    );
    expect(shapeProblems(indexHtml({css: outside}))).toEqual([
      expect.stringContaining('prefers-reduced-motion'),
    ]);
  });

  it('takes only a bare :focus-visible rule, not one for a single class', () => {
    const css = CRITICAL_CSS.replace('}:focus-visible{', '}.inset-focus-ring:focus-visible{');
    expect(shapeProblems(indexHtml({css}))).toEqual([expect.stringContaining(':focus-visible')]);
  });
});

describe('compareProblems', () => {
  it('passes a head equal to its base, with every delta zero', () => {
    expect(compareProblems(build(), build())).toEqual([]);
    expect(sizeDeltas(ROWS, ROWS).map((row) => row.delta)).toEqual([0, 0, 0]);
  });

  it('allows a watched row to grow by the allowance and fails one byte more', () => {
    expect(compareProblems(build(), build(grow('Entry chunk', 100)))).toEqual([]);
    expect(compareProblems(build(), build(grow('Entry chunk', 101)))).toEqual([
      'Entry chunk grew 101 B, more than 100 B',
    ]);
  });

  it('takes another allowance, and leaves unwatched rows to their budgets', () => {
    expect(compareProblems(build(), build(grow('User-facing JS', 400)), 500)).toEqual([]);
    expect(compareProblems(build(), build(grow('Card data JSON', 5_000)))).toEqual([]);
  });

  it('fails a row missing from either side', () => {
    const fewer = ROWS.filter((row) => row.name !== 'Card data JSON');
    expect(compareProblems(build(), build(fewer))).toEqual([
      expect.stringContaining('missing from the head'),
    ]);
    expect(compareProblems(build(fewer), build())).toEqual([
      expect.stringContaining('missing from the base'),
    ]);
  });

  it('fails a change in the JS file or style block counts', () => {
    const split = indexHtml({
      preloads: ['rolldown-runtime', 'startup-vendor', 'startup-shared', 'IconButton'],
    });
    expect(compareProblems(build(), build(ROWS, split))).toEqual([
      'startup JS files went from 4 to 5',
    ]);
    const extraStyle = indexHtml().replace('</head>', '<style>.x{}</style></head>');
    expect(compareProblems(build(), build(ROWS, extraStyle))).toEqual([
      'startup <style> blocks went from 2 to 3',
    ]);
  });
});
