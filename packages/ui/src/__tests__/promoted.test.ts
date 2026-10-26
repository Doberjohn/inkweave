// @vitest-environment node
import {existsSync, readFileSync} from 'node:fs';

// The admin primitives promoted into the package, as components under src/, in the order the
// owner picked them:
// https://github.com/Doberjohn/inkweave/issues/982#issuecomment-6417313865
// Admin keeps its own copies until Doberjohn/inkweave-admin#103 bridges these.
const PROMOTED = [
  'components/SegmentedControl',
  'components/Tag',
  'components/Notice',
];

/** Admin's classes, theme and bridge: package source names none of them. */
const ADMIN_REACH = /\badm-|ADMIN_|app-bridge/;

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => (existsSync(at(path)) ? readFileSync(at(path), 'utf8') : '');

// Read at module scope (tests.md): each pick's files, and its source with its stylesheet.
const PICKS = PROMOTED.map((path) => {
  const slash = path.lastIndexOf('/');
  const tests = `${path.slice(0, slash)}/__tests__/${path.slice(slash + 1)}.test.tsx`;
  return {
    path,
    module: existsSync(at(`${path}.tsx`)),
    story: existsSync(at(`${path}.stories.tsx`)),
    test: existsSync(at(tests)),
    source: read(`${path}.tsx`) + read(`${path}.css`),
  };
});

describe.each(PICKS)('promoted $path', (pick) => {
  it('is a module with a story beside it and a test in its folder', () => {
    expect(pick).toMatchObject({module: true, story: true, test: true});
  });

  it("names none of admin's classes, theme or bridge", () => {
    expect(pick.source).not.toMatch(ADMIN_REACH);
  });
});
