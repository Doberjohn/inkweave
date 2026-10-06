import {execFileSync} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {classify, liveRunFrom, run} from './clean-transient.mjs';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = Date.UTC(2026, 9, 6, 12);
const QUIET = {live: false, reason: 'no E2E run'};

/** An entry whose newest file is `ageMs` old at NOW, ignored and untracked unless overridden. */
function entry(path, ageMs, overrides = {}) {
  return {
    path,
    kind: path.endsWith('/') ? 'dir' : 'file',
    newestMs: NOW - ageMs,
    ignored: true,
    tracked: false,
    ...overrides,
  };
}

function decide(path, ageMs, overrides, e2e = QUIET) {
  return classify(entry(path, ageMs, overrides), {now: NOW, e2e}).action;
}

describe('classify: E2E artifacts', () => {
  it('deletes a report whose newest file is 31 minutes old', () => {
    expect(decide('apps/web/playwright-report/', 31 * MINUTE)).toBe('delete');
  });

  it('keeps a report whose newest file is 29 minutes old', () => {
    expect(decide('apps/web/playwright-report/', 29 * MINUTE)).toBe('ask');
  });

  it('keeps old artifacts while an E2E run is live', () => {
    const live = {live: true, reason: 'E2E run live'};
    expect(decide('apps/web/test-results/', 5 * HOUR, {}, live)).toBe('ask');
  });

  it('treats a failed live-run check as a live run', () => {
    const unknown = {live: null, reason: 'live-run check failed'};
    const verdict = classify(entry('apps/web/test-results/', 5 * HOUR), {now: NOW, e2e: unknown});
    expect(verdict).toEqual({action: 'ask', reason: 'live-run check failed'});
  });
});

describe('classify: scratch', () => {
  it('deletes an ignored scratch folder older than a day', () => {
    expect(decide('tmp-probe/', 24 * HOUR + MINUTE)).toBe('delete');
  });

  it('keeps an ignored scratch folder just under a day old', () => {
    expect(decide('.tmp-probe/', 24 * HOUR - MINUTE)).toBe('ask');
  });

  it('applies the scratch rule to logs in the root and in apps/web', () => {
    expect(decide('vite.log', 2 * 24 * HOUR)).toBe('delete');
    expect(decide('apps/web/e2e.log', 2 * 24 * HOUR)).toBe('delete');
  });
});

describe('classify: guards', () => {
  it('never deletes a tracked file', () => {
    expect(decide('foo.log', 30 * 24 * HOUR, {tracked: true, ignored: false})).toBe('ask');
  });

  it('never deletes a path git does not ignore', () => {
    expect(decide('apps/web/test-results/', 5 * HOUR, {ignored: false})).toBe('ask');
  });

  it('always asks about screenshots/, however old', () => {
    expect(decide('screenshots/', 30 * 24 * HOUR)).toBe('ask');
  });

  it.each([
    '.knowledge/',
    '.worktrees/206/tmp-x/',
    '.claude/worktrees/742/tmp-x/',
    'apps/web/public/mockups/',
    'dist/',
    'coverage/',
    'reports/',
    'node_modules/',
    'apps/web/node_modules/.vite/',
  ])('skips protected %s', (path) => {
    expect(decide(path, 30 * 24 * HOUR)).toBe('skip');
  });
});

describe('liveRunFrom', () => {
  it('reports no run when nothing matches', () => {
    expect(liveRunFrom('{"processes":[],"ports":[]}').live).toBe(false);
  });

  it('reports a run from a Playwright process', () => {
    const report = '{"processes":[{"pid":42,"name":"node.exe"}],"ports":[]}';
    expect(liveRunFrom(report)).toEqual({live: true, reason: 'E2E run live (pid 42 node.exe)'});
  });

  it('reports a run from a lone listener in the E2E port range', () => {
    expect(liveRunFrom('{"processes":[],"ports":5231}').live).toBe(true);
  });

  it('treats output it cannot read as a failed check', () => {
    expect(liveRunFrom('').live).toBeNull();
    expect(liveRunFrom('{"processes":[]}').live).toBeNull();
    expect(liveRunFrom('5').live).toBeNull();
    expect(liveRunFrom('null').live).toBeNull();
  });
});

// Real git repositories: each test spawns several git processes, which takes seconds on a cold
// Windows disk.
describe('run', {timeout: 60_000}, () => {
  const roots = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});
  });

  function git(cwd, ...args) {
    const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'];
    return execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', '-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }

  function write(file, text = 'x') {
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, text);
  }

  /** A repository with this project's ignore rules for the tiers, and one commit. */
  function makeRepo() {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'clean-')));
    roots.push(root);
    git(root, 'init', '-q', '-b', 'master');
    write(
      join(root, '.gitignore'),
      ['*.log', 'tmp-*/', '.tmp-*/', 'screenshots/', '/apps/web/test-results/', ''].join('\n'),
    );
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'init');
    return root;
  }

  // Two days after the files were written: every scratch and E2E guard age has passed.
  const later = () => Date.now() + 2 * 24 * HOUR;

  function clean(root, args = [], probeLive = () => QUIET) {
    const lines = [];
    const code = run(args, {cwd: root, log: (line) => lines.push(line), now: later, probeLive});
    return {code, out: lines.join('\n')};
  }

  it('lists the plan on --dry-run and deletes nothing', () => {
    const root = makeRepo();
    write(join(root, 'tmp-probe/a.txt'));
    const {code, out} = clean(root, ['--dry-run']);
    expect(code).toBe(0);
    expect(out).toMatch(/delete\s+tmp-probe\//);
    expect(existsSync(join(root, 'tmp-probe'))).toBe(true);
  });

  it('deletes eligible paths and leaves git status unchanged', () => {
    const root = makeRepo();
    const before = git(root, 'status', '--porcelain');
    write(join(root, 'tmp-probe/a.txt'));
    write(join(root, 'apps/web/test-results/run/trace.zip'));
    write(join(root, 'vite.log'));
    expect(clean(root).code).toBe(0);
    for (const path of ['tmp-probe', 'apps/web/test-results', 'vite.log']) {
      expect(existsSync(join(root, path))).toBe(false);
    }
    expect(git(root, 'status', '--porcelain')).toBe(before);
  });

  it('keeps a tracked log and lists it', () => {
    const root = makeRepo();
    write(join(root, 'foo.log'));
    git(root, 'add', '-f', 'foo.log');
    git(root, 'commit', '-q', '-m', 'track foo.log');
    const {out} = clean(root);
    expect(existsSync(join(root, 'foo.log'))).toBe(true);
    expect(out).toMatch(/ask\s+foo\.log\s+.*tracked/);
  });

  it('keeps E2E artifacts while a run is live but still sweeps scratch', () => {
    const root = makeRepo();
    write(join(root, 'apps/web/test-results/trace.zip'));
    write(join(root, 'tmp-probe/a.txt'));
    clean(root, [], () => ({live: true, reason: 'E2E run live'}));
    expect(existsSync(join(root, 'apps/web/test-results/trace.zip'))).toBe(true);
    expect(existsSync(join(root, 'tmp-probe'))).toBe(false);
  });

  it('puts a folder back when a run wrote into it after the plan', () => {
    const root = makeRepo();
    write(join(root, 'apps/web/test-results/old.zip'));
    const fresh = join(root, 'apps/web/test-results/fresh.zip');
    const lines = [];
    let started = false;
    run([], {
      cwd: root,
      log: (line) => lines.push(line),
      now: later,
      probeLive: () => QUIET,
      // A run starting between the plan and the first rename.
      rename: (from, to) => {
        if (!started) write(fresh);
        started = true;
        renameSync(from, to);
      },
    });
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(join(root, 'apps/web/test-results/old.zip'))).toBe(true);
    expect(lines.join('\n')).toMatch(/ask\s+apps\/web\/test-results\/.*changed since the plan/);
  });

  it('rejects an unknown option', () => {
    expect(clean(makeRepo(), ['--force']).code).toBe(1);
  });
});
