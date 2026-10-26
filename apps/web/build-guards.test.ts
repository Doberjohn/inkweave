// @vitest-environment node
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  type BuiltFiles,
  staleStartupEntries,
  uiCompilerReport,
  unresolvedCssUrls,
} from './build-guards.ts';

const GROUPS = {vendor: ['react', 'react-dom'], shared: ['apps/web/src/shared/hooks/useHover.ts']};
const REACT = '/r/node_modules/.pnpm/react@19.3.1/node_modules/react/index.js';
const REACT_DOM = '/r/node_modules/.pnpm/react-dom@19.3.1/node_modules/react-dom/client.js';
const USE_HOVER = '/r/apps/web/src/shared/hooks/useHover.ts';
const RUNTIME = '/r/node_modules/.pnpm/react@19.3.1/node_modules/react/compiler-runtime.js';
const component = (id: string, compiled: boolean) => ({
  id,
  importedIds: compiled ? [RUNTIME] : [REACT],
});

describe('staleStartupEntries', () => {
  it('finds nothing stale when every entry matches a module, on any OS', () => {
    expect(staleStartupEntries(GROUPS, [REACT, REACT_DOM, USE_HOVER])).toEqual([]);
    const windows = [REACT, REACT_DOM, USE_HOVER].map((id) => `C:${id.replaceAll('/', '\\')}`);
    expect(staleStartupEntries(GROUPS, windows)).toEqual([]);
  });

  it('names a package no module comes from, never taking react-dom for react', () => {
    expect(staleStartupEntries(GROUPS, [REACT_DOM, USE_HOVER])).toEqual(['react']);
  });

  it('names a shared file that moved', () => {
    const moved = '/r/packages/ui/src/hooks/useHover.ts';
    expect(staleStartupEntries(GROUPS, [REACT, REACT_DOM, moved])).toEqual([
      'apps/web/src/shared/hooks/useHover.ts',
    ]);
  });
});

describe('uiCompilerReport', () => {
  it('counts a package component that imports the compiler runtime as compiled', () => {
    const probe = '/r/packages/ui/src/components/Probe.tsx';
    expect(uiCompilerReport([component(probe, true)])).toEqual({compiled: [probe], skipped: []});
  });

  it('counts one without the runtime as skipped, linked or through node_modules', () => {
    const linked = '/r/packages/ui/src/components/Probe.tsx';
    const viaNodeModules = '/r/apps/web/node_modules/inkweave-ui/src/lorcana/Mark.tsx';
    const report = uiCompilerReport([component(linked, false), component(viaNodeModules, false)]);
    expect(report).toEqual({compiled: [], skipped: [linked, viaNodeModules]});
  });

  it("ignores the app's modules, the package's .ts files, stories and tests", () => {
    const report = uiCompilerReport([
      component('/r/apps/web/src/App.tsx', false),
      component('/r/packages/ui/src/hooks/useHover.ts', false),
      component('/r/packages/ui/src/components/Probe.stories.tsx', false),
      component('/r/packages/ui/src/components/Probe.test.tsx', false),
    ]);
    expect(report).toEqual({compiled: [], skipped: []});
  });
});

describe('unresolvedCssUrls', () => {
  const PUBLIC = path.join(import.meta.dirname, 'public');
  const SYMBOL = 'assets/amber-AAAA.svg';
  const asset = (fileName: string, source: string | Uint8Array) => ({
    type: 'asset' as const,
    fileName,
    source,
  });
  const build = (...assets: ReturnType<typeof asset>[]): BuiltFiles =>
    Object.fromEntries([[SYMBOL, asset(SYMBOL, '<svg/>')], ...assets.map((a) => [a.fileName, a])]);
  const html = (style: string) => asset('index.html', `<head><style>${style}</style></head>`);

  it('passes urls the bundle writes or the public folder holds, in a .css file or an inlined style', () => {
    const css = new TextEncoder().encode(
      `.a{background:url("/${SYMBOL}")}.b{mask:url(./amber-AAAA.svg)}`,
    );
    const bundle = build(
      html(`.c{background:url(/${SYMBOL})}.d{background:url('/brand/mark.svg?v=2#top')}`),
      asset('assets/Page-BBBB.css', css),
    );
    expect(unresolvedCssUrls(bundle, PUBLIC)).toEqual([]);
  });

  it('names each url no file backs once, with its stylesheet', () => {
    const missing = ".e{background:url('./assets/amber.svg?no-inline')}";
    const bundle = build(
      html(missing + missing),
      asset('assets/Page-BBBB.css', `.f{mask:url(./${SYMBOL})}.g{mask:url(/brand/gone.svg)}`),
    );
    expect(unresolvedCssUrls(bundle, PUBLIC)).toEqual([
      './assets/amber.svg?no-inline in index.html',
      `./${SYMBOL} in assets/Page-BBBB.css`,
      '/brand/gone.svg in assets/Page-BBBB.css',
    ]);
  });

  it("skips inline data, other origins and fragments, text outside a stylesheet, and another page's styles", () => {
    const bundle = build(
      html('.h{background:url(data:image/svg+xml,%3Csvg%3E)}.i{filter:url(#glow)}'),
      asset('assets/Page-BBBB.css', '.j{background:url(https://x.test/a.png),url(//x.test/b.png)}'),
      asset('assets/note.svg', '<svg><rect fill="url(./missing.png)"/></svg>'),
      asset('page.html', '<p>url(./missing.png)</p><style>.k{}</style>'),
      // Storybook's page, whose own fonts it copies in after the build.
      asset(
        'iframe.html',
        '<style>.m{src:url(./sb-common-assets/nunito-sans-regular.woff2)}</style>',
      ),
    );
    expect(unresolvedCssUrls(bundle, PUBLIC)).toEqual([]);
  });

  it('never takes a url above the root for a public file', () => {
    expect(
      unresolvedCssUrls(build(html('.l{background:url(../public/brand/mark.svg)}')), PUBLIC),
    ).toEqual(['../public/brand/mark.svg in index.html']);
  });
});
