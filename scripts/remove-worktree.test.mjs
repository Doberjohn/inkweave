import {execFileSync, spawn} from 'node:child_process';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {duration, run} from './remove-worktree.mjs';

const WINDOWS = process.platform === 'win32';
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true, maxRetries: 3});
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

// Paths as `git worktree list --porcelain` prints them, compared the way Windows does.
function norm(path) {
  const slashed = path.replace(/\\/g, '/').replace(/\/$/, '');
  return WINDOWS ? slashed.toLowerCase() : slashed;
}

// An ignored folder the Claude app copies from the main checkout into every worktree it makes
// (#718), ignored by name as in the real .gitignore.
const SKILL = '.claude/skills/supabase-postgres-best-practices';
const SKILL_FILES = {'SKILL.md': 'skill\n', 'references/query.md': 'query\n'};

/** Writes `files` into `base`'s copy of the skill folder and returns that folder. */
function writeSkill(base, files = SKILL_FILES) {
  const folder = join(base, SKILL);
  for (const [file, text] of Object.entries(files)) write(join(folder, file), text);
  return folder;
}

/** A main checkout with a bare `origin` and one pushed commit on master. */
function makeRepo() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'rmwt-')));
  roots.push(root);
  const origin = join(root, 'origin.git');
  const main = join(root, 'main');
  git(root, 'init', '-q', '--bare', '-b', 'master', origin);
  git(root, 'init', '-q', '-b', 'master', main);
  const ignored = [
    'node_modules',
    'dist',
    '.env*.local',
    'apps/web/public/card-images-raw/',
    'reports/',
    `${SKILL}/`,
  ];
  write(join(main, '.gitignore'), `${[...ignored, '.claude/worktrees/'].join('\n')}\n`);
  write(join(main, 'README.md'), 'readme\n');
  git(main, 'add', '.');
  git(main, 'commit', '-q', '-m', 'init');
  git(main, 'remote', 'add', 'origin', origin);
  git(main, 'push', '-q', 'origin', 'master');
  return {root, main};
}

function addWorktree(repo, name, {dir, detach = false} = {}) {
  const path = dir ?? join(repo.main, '.claude', 'worktrees', name);
  const how = detach ? ['--detach'] : ['--no-track', '-b', `wt/${name}`];
  git(repo.main, 'worktree', 'add', '-q', ...how, path, 'origin/master');
  return path;
}

function registered(repo) {
  return git(repo.main, 'worktree', 'list', '--porcelain')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => norm(line.slice('worktree '.length)));
}

function branchExists(repo, branch) {
  return git(repo.main, 'branch', '--list', branch) !== '';
}

function remove(repo, args, options = {}) {
  const lines = [];
  const code = run(args, {cwd: repo.main, log: (line) => lines.push(line), ...options});
  return {code, output: lines.join('\n')};
}

/**
 * Runs with a clock that reads `times` in turn, and records the log lines and each delete in one
 * list, so a test can tell what was printed before the delete started.
 */
function removeTimed(repo, args, times) {
  const events = [];
  const code = run(args, {
    cwd: repo.main,
    log: (line) => events.push(line),
    rm: (dir, options) => {
      events.push('<rm>');
      rmSync(dir, options);
    },
    now: () => times.shift(),
  });
  return {code, events};
}

// The two lines around a delete: before it starts, and after it ends.
const DELETE_LINES = /^(wait {4}deleting|ok {6}deleted)/m;

/** node_modules shaped like pnpm's: links inside the tree, a junction and a hard link out of it. */
function pnpmTree(repo, wt) {
  const outsideDir = join(repo.root, 'canary-dir');
  const outsideFile = join(repo.root, 'canary-file.txt');
  write(join(outsideDir, 'keep.txt'), 'outside dir');
  write(outsideFile, 'outside file');
  const pkg = join(wt, 'node_modules', '.pnpm', 'pkg@1.0.0', 'node_modules', 'pkg');
  write(join(pkg, 'index.js'));
  symlinkSync(pkg, join(wt, 'node_modules', 'pkg'), 'junction');
  symlinkSync(outsideDir, join(wt, 'node_modules', 'escape'), 'junction');
  linkSync(outsideFile, join(pkg, 'linked.txt'));
  return {outsideDir, outsideFile};
}

// A process with its working directory at `cwd`, for as long as `use` runs.
async function withProcessIn(cwd, use) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    cwd,
    stdio: 'ignore',
  });
  await new Promise((resolve) => child.once('spawn', resolve));
  try {
    return use();
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await exited;
    }
  }
}

describe('remove-worktree', {timeout: 60_000}, () => {
  it('prints usage: exit 0 with --help, exit 1 without a target', () => {
    expect(run(['--help'], {log: () => {}})).toBe(0);
    expect(run([], {log: () => {}})).toBe(1);
  });

  it.each([
    [0, '0s'],
    [59_499, '59s'],
    [59_500, '1m 0s'],
    [60_000, '1m 0s'],
    [192_000, '3m 12s'],
  ])('writes a %i ms delete as %s', (ms, text) => {
    expect(duration(ms)).toBe(text);
  });

  describe('which worktree', () => {
    it('refuses the main checkout, run from outside it', () => {
      const repo = makeRepo();
      // From inside the main checkout, the "running from inside" refusal would answer first.
      const elsewhere = addWorktree(repo, 'elsewhere', {dir: join(repo.root, 'elsewhere')});
      const {code, output} = remove(repo, [repo.main], {cwd: elsewhere});
      expect(code).toBe(1);
      expect(output).toMatch(/only linked worktrees/);
      expect(existsSync(join(repo.main, 'README.md'))).toBe(true);
    });

    it('refuses a locked worktree', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'held');
      git(repo.main, 'worktree', 'lock', wt);
      // The reason matters: prune skips locked entries too, so a missing check still "refuses".
      const {code, output} = remove(repo, ['held']);
      expect(code).toBe(1);
      expect(output).toMatch(/locked/);
      expect(existsSync(join(wt, 'README.md'))).toBe(true);
      expect(registered(repo)).toContain(norm(wt));
    });

    it('refuses a folder that is not a registered worktree, outside --leftovers', () => {
      const repo = makeRepo();
      const stray = join(repo.main, '.claude', 'worktrees', 'stray');
      write(join(stray, 'file.txt'));
      expect(remove(repo, ['stray']).code).toBe(1);
      expect(existsSync(join(stray, 'file.txt'))).toBe(true);
    });

    it('refuses to run from inside the worktree it removes, naming the main checkout', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'self');
      const {code, output} = remove(repo, ['self'], {cwd: wt});
      expect(code).toBe(1);
      expect(output).toMatch(/main checkout/);
      expect(registered(repo)).toContain(norm(wt));
    });
  });

  describe('safety gates', () => {
    it.each([
      ['a modified tracked file', 'README.md'],
      ['an untracked file', 'notes.txt'],
    ])('refuses %s and leaves it intact', (_, file) => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'dirty');
      write(join(wt, file), 'unsaved work\n');
      expect(remove(repo, ['dirty']).code).toBe(1);
      expect(readFileSync(join(wt, file), 'utf8')).toBe('unsaved work\n');
      expect(registered(repo)).toContain(norm(wt));
    });

    it('refuses a worktree whose HEAD is on no origin ref', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'local');
      write(join(wt, 'feature.txt'));
      git(wt, 'add', '.');
      git(wt, 'commit', '-q', '-m', 'local only');
      expect(remove(repo, ['local']).code).toBe(1);
      expect(existsSync(join(wt, 'feature.txt'))).toBe(true);
      expect(registered(repo)).toContain(norm(wt));
    });

    it.each([
      ['the main checkout lacks', null],
      ["differs from the main checkout's copy", 'VITE_FLAG=false\n'],
    ])('refuses an ignored .env.local that %s, and names it', (_, mainCopy) => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'env');
      write(join(wt, 'apps', 'web', '.env.local'), 'VITE_FLAG=true\n');
      if (mainCopy) write(join(repo.main, 'apps', 'web', '.env.local'), mainCopy);
      const {code, output} = remove(repo, ['env']);
      expect(code).toBe(1);
      expect(output).toContain('apps/web/.env.local');
      expect(readFileSync(join(wt, 'apps', 'web', '.env.local'), 'utf8')).toBe('VITE_FLAG=true\n');
    });

    it.each([
      ['raw card scans', 'apps/web/public/card-images-raw/14001.png'],
      ['hand-made reports', 'reports/META_REPORT.html'],
    ])('refuses ignored files that are not build output: %s', (_, file) => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'local-work');
      write(join(wt, file));
      const {code, output} = remove(repo, ['local-work']);
      expect(code).toBe(1);
      expect(output).toContain(file.split('/').slice(0, -1).join('/'));
      expect(existsSync(join(wt, file))).toBe(true);
    });

    it("allows build output and a .env.local identical to the main checkout's copy", () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'built');
      write(join(wt, 'node_modules', 'pkg', 'index.js'));
      write(join(wt, 'packages', 'synergy-engine', 'dist', 'index.js'));
      write(join(wt, 'apps', 'web', '.env.local'), 'VITE_FLAG=true\n');
      write(join(repo.main, 'apps', 'web', '.env.local'), 'VITE_FLAG=true\n');
      expect(remove(repo, ['built']).code).toBe(0);
      expect(existsSync(wt)).toBe(false);
    });

    it("allows an ignored folder identical to the main checkout's, and names it as a copy", () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'skill');
      writeSkill(repo.main);
      writeSkill(wt);
      const {code, output} = remove(repo, ['skill']);
      expect(code).toBe(0);
      expect(output).toContain(`plus copies of the main checkout's ${SKILL}/`);
      expect(existsSync(wt)).toBe(false);
    });

    it.each([
      ['a file that differs', {...SKILL_FILES, 'SKILL.md': 'edited\n'}],
      ['an extra file', {...SKILL_FILES, 'notes.md': 'only here\n'}],
      ['a missing file', {'SKILL.md': 'skill\n'}],
    ])("refuses an ignored folder that is not the main checkout's copy: %s", (_, files) => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'skill');
      writeSkill(repo.main);
      const folder = writeSkill(wt, files);
      const {code, output} = remove(repo, ['skill']);
      expect(code).toBe(1);
      expect(output).toContain(`${SKILL}/`);
      expect(existsSync(join(folder, 'SKILL.md'))).toBe(true);
    });

    it('refuses an ignored folder holding a repository, even when the main checkout has the same', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'skill');
      const files = {...SKILL_FILES, '.git/HEAD': 'ref: refs/heads/main\n'};
      writeSkill(repo.main, files);
      const folder = writeSkill(wt, files);
      const {code, output} = remove(repo, ['skill']);
      expect(code).toBe(1);
      expect(output).toContain(`${SKILL}/`);
      expect(existsSync(join(folder, '.git', 'HEAD'))).toBe(true);
    });

    it('never follows a link inside an ignored folder, even one back into it', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'skill');
      for (const base of [repo.main, wt]) {
        const folder = writeSkill(base);
        symlinkSync(folder, join(folder, 'loop'), 'junction');
      }
      expect(remove(repo, ['skill']).code).toBe(0);
      expect(existsSync(wt)).toBe(false);
    });

    // Git for Windows lists an ignored junction as `name/`, as if it were a folder. Elsewhere git
    // treats any link as a file, never as a folder entry.
    it.runIf(WINDOWS)('refuses a junction that git lists as an ignored folder', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'skill');
      const mains = writeSkill(repo.main);
      mkdirSync(dirname(join(wt, SKILL)), {recursive: true});
      symlinkSync(mains, join(wt, SKILL), 'junction');
      const {code, output} = remove(repo, ['skill']);
      expect(code).toBe(1);
      expect(output).toContain(`${SKILL}/`);
      expect(existsSync(join(mains, 'SKILL.md'))).toBe(true);
    });

    // A closed app session empties its worktree's skill folder to a bare skeleton (#727).
    it.each([
      ['the main checkout has the skill', true],
      ['the main checkout has no copy', false],
    ])('allows an ignored folder that holds only empty folders: %s', (_, mainHasIt) => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'skeleton');
      if (mainHasIt) writeSkill(repo.main);
      mkdirSync(join(wt, SKILL, 'references'), {recursive: true});
      const {code, output} = remove(repo, ['skeleton']);
      expect(code).toBe(0);
      expect(output).not.toContain(`${SKILL}/`);
      expect(existsSync(wt)).toBe(false);
    });

    it('still refuses an ignored folder whose only file is empty', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'zero');
      const folder = writeSkill(wt, {'notes.md': ''});
      const {code, output} = remove(repo, ['zero']);
      expect(code).toBe(1);
      expect(output).toContain(`${SKILL}/`);
      expect(existsSync(join(folder, 'notes.md'))).toBe(true);
    });

    // Git counts a nested repository as content even before its first file, so a folder holding
    // one is still judged, and refused, however empty it looks.
    it('still refuses an ignored folder whose only content is a fresh repository', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'nested');
      const nested = join(wt, SKILL, 'sub');
      mkdirSync(nested, {recursive: true});
      git(nested, 'init', '-q', '-b', 'main');
      const {code, output} = remove(repo, ['nested']);
      expect(code).toBe(1);
      expect(output).toContain(`${SKILL}/`);
      expect(existsSync(join(nested, '.git'))).toBe(true);
    });

    it.runIf(WINDOWS).each([
      ['an empty folder', false],
      ['a missing folder', true],
    ])('removes a junction to %s as a link, never its target', (_, dangling) => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'empty-link');
      const target = join(repo.root, 'empty-target');
      mkdirSync(target);
      mkdirSync(dirname(join(wt, SKILL)), {recursive: true});
      symlinkSync(target, join(wt, SKILL), 'junction');
      if (dangling) rmSync(target, {recursive: true});
      expect(remove(repo, ['empty-link']).code).toBe(0);
      expect(existsSync(wt)).toBe(false);
      expect(existsSync(target)).toBe(!dangling);
    });
  });

  describe('removal', () => {
    it('removes a clean, pushed worktree and nothing its links point at outside it', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'done');
      const {outsideDir, outsideFile} = pnpmTree(repo, wt);
      expect(remove(repo, ['done']).code).toBe(0);
      expect(existsSync(wt)).toBe(false);
      expect(existsSync(`${wt}.removing`)).toBe(false);
      expect(registered(repo)).not.toContain(norm(wt));
      expect(readFileSync(join(outsideDir, 'keep.txt'), 'utf8')).toBe('outside dir');
      expect(readFileSync(outsideFile, 'utf8')).toBe('outside file');
    });

    it.runIf(WINDOWS)('removes a tree holding a file path over 260 characters', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'deep');
      let dir = join(wt, 'node_modules');
      while (dir.length < 270) dir = join(dir, 'a-rather-long-package-directory-name');
      write(join(dir, 'file.js'));
      expect(remove(repo, ['deep']).code).toBe(0);
      expect(existsSync(wt)).toBe(false);
    });

    it('takes a worktree outside .claude/worktrees by its path', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'sibling', {dir: join(repo.root, 'sibling')});
      expect(remove(repo, [wt]).code).toBe(0);
      expect(existsSync(wt)).toBe(false);
      expect(registered(repo)).not.toContain(norm(wt));
    });

    it('names other missing worktrees that the prune also unregisters', () => {
      const repo = makeRepo();
      const gone = addWorktree(repo, 'gone');
      rmSync(gone, {recursive: true, force: true});
      addWorktree(repo, 'target');
      const {code, output} = remove(repo, ['target']);
      expect(code).toBe(0);
      expect(output).toContain('worktrees/gone');
    });

    it('says how to recover when the rename back after a failed prune fails', () => {
      const repo = makeRepo();
      addWorktree(repo, 'stuck');
      // The claim "renames" without moving anything, so the prune keeps the entry; the rename
      // back then fails, as when a process grabs the folder mid-run.
      let renames = 0;
      const rename = () => {
        renames++;
        if (renames > 1) throw Object.assign(new Error('EBUSY: resource busy'), {code: 'EBUSY'});
      };
      const {code, output} = remove(repo, ['stuck'], {rename});
      expect(code).toBe(1);
      expect(output).toMatch(/rename it back by hand/i);
      expect(output).toContain('stuck.removing');
      // The marker stays, so --leftovers can still finish the removal.
      expect(readdirSync(join(repo.main, '.git', 'worktree-removals'))).toHaveLength(1);
    });

    it('says it is deleting before the delete starts, and how long the delete took', () => {
      const repo = makeRepo();
      addWorktree(repo, 'slow');
      const {code, events} = removeTimed(repo, ['slow'], [0, 192_000]);
      expect(code).toBe(0);
      const wait = events.findIndex((line) => /^wait {4}deleting .*slow\.removing: /.test(line));
      expect(wait).toBeGreaterThan(-1);
      expect(wait).toBeLessThan(events.indexOf('<rm>'));
      expect(events).toContainEqual(
        expect.stringMatching(/^ok {6}deleted .*slow\.removing in 3m 12s$/),
      );
    });

    it('--dry-run deletes and unregisters nothing', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'plan');
      const {code, output} = remove(repo, ['plan', '--dry-run']);
      expect(code).toBe(0);
      expect(output).not.toMatch(DELETE_LINES);
      expect(existsSync(join(wt, 'README.md'))).toBe(true);
      expect(registered(repo)).toContain(norm(wt));
      expect(branchExists(repo, 'wt/plan')).toBe(true);
    });

    it.runIf(WINDOWS).each([
      ['its root', ''],
      ['a subfolder', 'node_modules'],
    ])('refuses a worktree that a process uses as its working directory (%s)', async (_, sub) => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'busy');
      write(join(wt, 'node_modules', 'pkg', 'index.js'));
      const {code, output} = await withProcessIn(join(wt, sub), () => remove(repo, ['busy']));
      expect(code).toBe(1);
      expect(output).toMatch(/in use/);
      expect(existsSync(join(wt, 'README.md'))).toBe(true);
      expect(registered(repo)).toContain(norm(wt));
    });
  });

  describe('branch', () => {
    it('deletes a merged branch', () => {
      const repo = makeRepo();
      addWorktree(repo, 'merged');
      expect(remove(repo, ['merged']).code).toBe(0);
      expect(branchExists(repo, 'wt/merged')).toBe(false);
    });

    it('keeps a pushed branch that is not merged, and says so', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'open');
      write(join(wt, 'feature.txt'));
      git(wt, 'add', '.');
      git(wt, 'commit', '-q', '-m', 'pushed, not merged');
      git(wt, 'push', '-q', '-u', 'origin', 'wt/open');
      const {code, output} = remove(repo, ['open']);
      expect(code).toBe(0);
      expect(existsSync(wt)).toBe(false);
      expect(branchExists(repo, 'wt/open')).toBe(true);
      expect(output).toMatch(/kept/);
    });

    it('keeps a merged branch with --keep-branch', () => {
      const repo = makeRepo();
      addWorktree(repo, 'keep');
      expect(remove(repo, ['keep', '--keep-branch']).code).toBe(0);
      expect(branchExists(repo, 'wt/keep')).toBe(true);
    });

    it('never deletes the base branch, even from a worktree on it', () => {
      const repo = makeRepo();
      git(repo.main, 'switch', '-q', '-c', 'trunk'); // frees master for a worktree
      const wt = join(repo.main, '.claude', 'worktrees', 'on-master');
      git(repo.main, 'worktree', 'add', '-q', wt, 'master');
      const {code, output} = remove(repo, ['on-master']);
      expect(code).toBe(0);
      expect(existsSync(wt)).toBe(false);
      expect(branchExists(repo, 'master')).toBe(true);
      expect(output).toMatch(/kept/);
    });

    it('keeps a branch that another worktree also has checked out', () => {
      const repo = makeRepo();
      addWorktree(repo, 'first');
      const second = join(repo.root, 'second');
      git(repo.main, 'worktree', 'add', '-q', '--force', second, 'wt/first'); // same branch
      const {code, output} = remove(repo, ['first']);
      expect(code).toBe(0);
      expect(branchExists(repo, 'wt/first')).toBe(true);
      expect(output).toMatch(/kept/);
      expect(existsSync(join(second, 'README.md'))).toBe(true);
    });

    it('removes a detached worktree, which has no branch to delete', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'parked', {detach: true});
      expect(remove(repo, ['parked']).code).toBe(0);
      expect(existsSync(wt)).toBe(false);
    });

    // The merge check runs before the folder delete, which takes minutes for node_modules, and
    // once the worktree is unregistered nothing protects its branch (#727).
    it('says the branch was already deleted when it goes during the folder delete', () => {
      const repo = makeRepo();
      addWorktree(repo, 'raced');
      // Another session deletes the merged branch while the folder is still being deleted.
      const rm = (dir, options) => {
        git(repo.main, 'branch', '-D', 'wt/raced');
        rmSync(dir, options);
      };
      const {code, output} = remove(repo, ['raced'], {rm});
      expect(code).toBe(0);
      expect(output).toMatch(/branch wt\/raced was already deleted/);
    });

    it('keeps a branch that points elsewhere by the time the folder delete ends', () => {
      const repo = makeRepo();
      addWorktree(repo, 'reused');
      // The name comes back during the delete, on a commit origin/master does not have.
      const rm = (dir, options) => {
        rmSync(dir, options);
        git(repo.main, 'commit', '-q', '--allow-empty', '-m', 'new work');
        git(repo.main, 'branch', '-f', 'wt/reused', 'HEAD');
      };
      const {code, output} = remove(repo, ['reused'], {rm});
      expect(code).toBe(0);
      expect(output).toMatch(/kept/);
      expect(git(repo.main, 'rev-parse', 'wt/reused')).toBe(git(repo.main, 'rev-parse', 'HEAD'));
    });

    it('keeps a branch checked out again by the time the folder delete ends', () => {
      const repo = makeRepo();
      addWorktree(repo, 'again');
      const other = join(repo.root, 'again-2');
      // The same branch, still at the same commit, goes back into a worktree during the delete.
      const rm = (dir, options) => {
        rmSync(dir, options);
        git(repo.main, 'worktree', 'add', '-q', other, 'wt/again');
      };
      const {code, output} = remove(repo, ['again'], {rm});
      expect(code).toBe(0);
      expect(output).toMatch(/kept/);
      expect(branchExists(repo, 'wt/again')).toBe(true);
    });
  });

  describe('--leftovers', () => {
    // A half-deleted worktree: committed content plus build output, as git's failed remove leaves.
    function leftover(repo, name, extra = {}) {
      const dir = join(repo.main, '.claude', 'worktrees', name);
      const files = {'README.md': 'readme\n', 'node_modules/pkg/index.js': 'x', ...extra};
      for (const [file, text] of Object.entries(files)) write(join(dir, file), text);
      return dir;
    }

    it('removes unregistered and *.removing folders, and no registered worktree', () => {
      const repo = makeRepo();
      const live = addWorktree(repo, 'live');
      write(join(repo.main, 'apps', 'web', '.env.local'), 'VITE_FLAG=true\n');
      const orphan = leftover(repo, 'orphan', {'apps/web/.env.local': 'VITE_FLAG=true\n'});
      const interrupted = leftover(repo, 'old.removing');
      expect(remove(repo, ['--leftovers']).code).toBe(0);
      expect(existsSync(orphan)).toBe(false);
      expect(existsSync(interrupted)).toBe(false);
      expect(existsSync(join(live, 'README.md'))).toBe(true);
    });

    it.each([
      ['a .env.local the main checkout lacks', 'apps/web/.env.local'],
      ['a mockup', 'apps/web/public/mockups/hero.html'],
      ['an edited tracked file', 'README.md'],
    ])('refuses a leftover holding content git lacks: %s, and keeps it', (_, file) => {
      const repo = makeRepo();
      const orphan = leftover(repo, 'local-work', {[file]: 'only here\n'});
      const {code, output} = remove(repo, ['--leftovers']);
      expect(code).toBe(1);
      expect(output).toContain(file);
      expect(readFileSync(join(orphan, file), 'utf8')).toBe('only here\n');
    });

    it.each([
      ['its own .git folder', (repo, dir) => write(join(dir, '.git', 'HEAD'))],
      ['a nested clone', (repo, dir) => write(join(dir, 'tools', 'x', '.git', 'HEAD'))],
      ['a registered worktree', (repo, dir) => addWorktree(repo, 'inner', {dir: join(dir, 'in')})],
    ])('refuses a leftover holding a repository or worktree: %s', (_, plant) => {
      const repo = makeRepo();
      const orphan = leftover(repo, 'outer');
      plant(repo, orphan);
      expect(remove(repo, ['--leftovers']).code).toBe(1);
      expect(existsSync(join(orphan, 'README.md'))).toBe(true);
    });

    it('finishes a removal stopped between its rename and its prune', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'halfway');
      renameSync(wt, `${wt}.removing`); // the in-use rename happened; the prune did not
      expect(remove(repo, ['--leftovers']).code).toBe(0);
      expect(existsSync(`${wt}.removing`)).toBe(false);
      expect(registered(repo)).not.toContain(norm(wt));
    });

    it('knows committed files checked out with CRLF line endings', () => {
      // On Windows autocrlf turns every checkout's LF into CRLF; the hash must undo it.
      const repo = makeRepo();
      git(repo.main, 'config', 'core.autocrlf', 'true');
      const orphan = leftover(repo, 'crlf', {'README.md': 'readme\r\n'});
      expect(remove(repo, ['--leftovers']).code).toBe(0);
      expect(existsSync(orphan)).toBe(false);
    });

    it('sweeps a .removing folder whose git admin name a newer worktree reuses', () => {
      const repo = makeRepo();
      const old = addWorktree(repo, 'reused');
      renameSync(old, `${old}.removing`);
      git(repo.main, 'worktree', 'prune');
      const fresh = addWorktree(repo, 'reused', {detach: true});
      expect(remove(repo, ['--leftovers']).code).toBe(0);
      expect(existsSync(`${old}.removing`)).toBe(false);
      expect(existsSync(join(fresh, 'README.md'))).toBe(true);
    });

    it('names an unreadable marker and still sweeps the rest', () => {
      const repo = makeRepo();
      const orphan = leftover(repo, 'orphan');
      write(join(repo.main, '.git', 'worktree-removals', 'broken.json'), '{"path": ');
      const {code, output} = remove(repo, ['--leftovers']);
      expect(code).toBe(1);
      expect(output).toContain('broken.json');
      expect(existsSync(orphan)).toBe(false);
    });

    it('says it is deleting before each delete, and how long it took', () => {
      const repo = makeRepo();
      leftover(repo, 'orphan');
      const {code, events} = removeTimed(repo, ['--leftovers'], [0, 14_000]);
      expect(code).toBe(0);
      const wait = events.findIndex((line) => /^wait {4}deleting .*orphan\.removing: /.test(line));
      expect(wait).toBeGreaterThan(-1);
      expect(wait).toBeLessThan(events.indexOf('<rm>'));
      expect(events).toContainEqual(
        expect.stringMatching(/^ok {6}deleted .*orphan\.removing in 14s$/),
      );
    });

    it('--dry-run deletes nothing', () => {
      const repo = makeRepo();
      const orphan = leftover(repo, 'orphan');
      const {code, output} = remove(repo, ['--leftovers', '--dry-run']);
      expect(code).toBe(0);
      expect(output).not.toMatch(DELETE_LINES);
      expect(existsSync(join(orphan, 'README.md'))).toBe(true);
    });

    it('finishes a removal interrupted mid-delete, outside .claude/worktrees too', () => {
      const repo = makeRepo();
      const wt = addWorktree(repo, 'sibling', {dir: join(repo.root, 'sibling')});
      const busy = () => {
        throw Object.assign(new Error('EBUSY: resource busy or locked'), {code: 'EBUSY'});
      };
      const interrupted = remove(repo, [wt], {rm: busy});
      expect(interrupted.code).toBe(1);
      // It said it was deleting, and never that the delete finished.
      expect(interrupted.output).toMatch(/^wait {4}deleting /m);
      expect(interrupted.output).not.toMatch(/^ok {6}deleted /m);
      expect(existsSync(`${wt}.removing`)).toBe(true);
      expect(remove(repo, ['--leftovers']).code).toBe(0);
      expect(existsSync(`${wt}.removing`)).toBe(false);
      expect(registered(repo)).not.toContain(norm(wt));
    });
  });
});
