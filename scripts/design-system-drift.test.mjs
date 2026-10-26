// design-system-drift.yml (#978) reminds a PR to refresh the design-system mirror when it touches
// the files its `paths:` list names, and words the reminder by `bucket` regexes over the diff.
// A path or bucket that names no tracked file reminds no one once its file moves, and a file a
// bucket matches outside every path never starts the workflow. This holds both lists to the files
// git tracks.
import {describe, it, expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join, dirname, posix} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = readFileSync(
  join(ROOT, '.github', 'workflows', 'design-system-drift.yml'),
  'utf8',
);
const TRACKED = execFileSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'})
  .split('\n')
  .filter(Boolean);

// Paths that name no tracked file on purpose, each with why.
const PENDING = new Map([
  ['apps/web/public/mockups/**', 'git-ignored design scratch: it reaches a PR only when forced in'],
  ['packages/ui/src/assets/*.svg', "inkweave-ui's icons arrive with #979, which drops this line"],
]);

const PATHS = [...WORKFLOW.matchAll(/^ {6}- "([^"]+)"\r?$/gm)].map((match) => match[1]);
const BUCKETS = [...WORKFLOW.matchAll(/bucket '([^']+)'/g)].map((match) => match[1]);
/** A glob's part before its first wildcard, standing in for the files a pending path will name. */
const staticPrefix = (glob) => glob.split(/[*?[{]/)[0];
const inPaths = (file) => PATHS.some((glob) => posix.matchesGlob(file, glob));

describe('design-system-drift.yml', () => {
  it('reads its paths and buckets', () => {
    expect(PATHS.length).toBeGreaterThan(5);
    expect(BUCKETS.length).toBeGreaterThan(5);
  });

  it('lists only pending paths that it still lists', () => {
    expect([...PENDING.keys()].filter((glob) => !PATHS.includes(glob))).toEqual([]);
  });

  it('keeps no pending path that now names a tracked file', () => {
    const arrived = [...PENDING.keys()].filter((glob) =>
      TRACKED.some((file) => posix.matchesGlob(file, glob)),
    );
    expect(arrived).toEqual([]);
  });

  it('names a tracked file in each path but the pending ones', () => {
    const stale = PATHS.filter(
      (glob) => !PENDING.has(glob) && !TRACKED.some((file) => posix.matchesGlob(file, glob)),
    );
    expect(stale).toEqual([]);
  });

  it('matches a tracked file, or a pending path, with each bucket', () => {
    const pending = [...PENDING.keys()].map(staticPrefix);
    const stale = BUCKETS.filter((source) => {
      const bucket = new RegExp(source);
      return (
        !TRACKED.some((file) => bucket.test(file)) && !pending.some((prefix) => bucket.test(prefix))
      );
    });
    expect(stale).toEqual([]);
  });

  it('starts on every tracked file a bucket matches', () => {
    const buckets = BUCKETS.map((source) => new RegExp(source));
    const unwatched = TRACKED.filter(
      (file) => buckets.some((bucket) => bucket.test(file)) && !inPaths(file),
    );
    expect(unwatched).toEqual([]);
  });

  it('words a reminder for each tracked icon, in the app or the package', () => {
    const buckets = BUCKETS.map((source) => new RegExp(source));
    const icons = TRACKED.filter((file) =>
      /^(apps\/web|packages\/ui)\/src\/assets\/.*\.svg$/.test(file),
    );
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.filter((file) => !buckets.some((bucket) => bucket.test(file)))).toEqual([]);
  });
});
