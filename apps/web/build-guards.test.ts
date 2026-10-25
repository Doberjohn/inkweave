// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {staleStartupEntries, uiCompilerReport} from './build-guards.ts';

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
