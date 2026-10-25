// @vitest-environment node
import {readFileSync} from 'node:fs';

const readManifest = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const pkg = readManifest('../../package.json');
const app = readManifest('../../../../apps/web/package.json');
const SUBPATHS = [
  './tokens/*',
  './components/*',
  './lorcana/*',
  './hooks/*',
  './utils/*',
  './lib/*',
  './assets/*',
];

describe('inkweave-ui manifest', () => {
  it('exports its subpaths and no root, each into src/', () => {
    expect(Object.keys(pkg.exports)).toEqual(SUBPATHS);
    expect(
      Object.values(pkg.exports).filter((target) => !String(target).startsWith('./src/')),
    ).toEqual([]);
  });

  it('is private and ships source, with no build step', () => {
    expect(pkg.private).toBe(true);
    expect(pkg.scripts.build).toBeUndefined();
    expect(pkg.main).toBeUndefined();
    expect(pkg.sideEffects).toEqual(['**/*.css']);
  });

  it("names every dependency it shares with the app at the app's version", () => {
    const appVersions = {...app.dependencies, ...app.devDependencies};
    const own = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies};
    const mismatched = Object.entries(own).filter(
      ([name, version]) => name in appVersions && appVersions[name] !== version,
    );
    expect(mismatched).toEqual([]);
  });

  it('takes React from the app that imports it', () => {
    expect(Object.keys(pkg.peerDependencies)).toEqual(['react', 'react-dom']);
    expect(pkg.dependencies?.react).toBeUndefined();
  });
});
