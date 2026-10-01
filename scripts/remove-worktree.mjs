/**
 * Remove a git worktree completely, or refuse and change nothing (#686).
 *
 *   pnpm worktree:remove <name|path> [--keep-branch] [--dry-run]
 *   pnpm worktree:remove --leftovers [--dry-run]
 *
 * `git worktree remove` fails on this repo's Windows checkouts. Git for Windows deletes through
 * its own path layer, which breaks on pnpm's node_modules (junction targets near 500
 * characters, file paths past 260), and git unregisters the worktree before it deletes, so
 * every failure left a half-deleted plain folder to clean up by hand. Here the gates run
 * first and Node deletes: fs.rmSync copes with long paths and removes junctions as links,
 * never following them out of the tree.
 *
 * A removal, in order. Nothing changes until every gate has passed:
 * 1. Gates: HEAD is on an origin/* ref (after a fetch), the tree is clean, and every ignored
 *    file is build output or a byte-identical copy of the main checkout's file.
 * 2. In use? Rename the folder to <path>.removing. Windows refuses while a process has its
 *    working directory (or an open file) inside it, so a refused rename means "in use".
 * 3. Unregister with `git worktree prune`, which drops entries whose folder is missing.
 * 4. Delete <path>.removing.
 * 5. Delete the branch once origin/master contains it, unless --keep-branch. The local master
 *    always stays.
 *
 * Before the rename, a marker under <git common dir>/worktree-removals/ records the path, so
 * --leftovers can finish an interrupted removal wherever the worktree lived. --leftovers
 * also deletes folders under <main>/.claude/worktrees/ that git no longer knows about, but
 * only when every file outside build output is content git already stores (or the main
 * checkout's same bytes), and no repository or worktree sits inside.
 *
 * Owner-run by design: git-write-protection hard-blocks Claude tool calls that run it. Node
 * built-ins only, so a checkout whose branch predates it can run master's copy directly.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {basename, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const WINDOWS = process.platform === 'win32';
const BASE = 'origin/master';
const MARKERS = 'worktree-removals';
const REMOVING = '.removing';
const RM_OPTIONS = {recursive: true, force: true, maxRetries: 3};

const USAGE = `Usage:
  pnpm worktree:remove <name|path> [--keep-branch] [--dry-run]
  pnpm worktree:remove --leftovers [--dry-run]

Removes a linked worktree completely: its folder, its registry entry, and its branch once
${BASE} contains it. Refuses, changing nothing, when it has uncommitted work, a HEAD on no
origin/* ref, ignored files that are not build output, or a process inside it.

--leftovers deletes folders under .claude/worktrees/ that git no longer knows about, and
finishes removals that were interrupted. It refuses a folder holding a repository, or a file
outside build output whose content git does not have and the main checkout does not match.`;

// Ignored paths that an install, build, precompute or test run regenerates. Anything else that
// is ignored (raw card scans, mockups, notes, .env files) may exist only in this worktree.
// reports/ is not here: generate-docs.mjs keeps hand-made reports in it.
const BUILD_OUTPUT = [
  /(^|\/)node_modules\//,
  /(^|\/)(dist|dist-ssr|coverage|storybook-static)\/$/,
  /\.tsbuildinfo$/,
  /^\.husky\/_\//,
  /^apps\/web\/(test-results|playwright-report|playwright\/\.cache)\/$/,
  /^apps\/web\/public\/(card-images|data\/synergies)\/$/,
  /^apps\/web\/public\/(data\/featuredCards|version)\.json$/,
];

// The longest list a refusal prints before it summarizes the rest.
const LIST_LIMIT = 20;

const FLAGS = {
  '--help': 'help',
  '-h': 'help',
  '--keep-branch': 'keepBranch',
  '--dry-run': 'dryRun',
  '--leftovers': 'leftovers',
};

/** Ends a run with exit 1, printing `label: message`. */
class Stop extends Error {
  constructor(label, message) {
    super(`${label}: ${message}`);
  }
}

// Before anything has changed.
function refuse(message) {
  throw new Stop('refused', message);
}

// After something has changed; the message says how to finish.
function fail(message) {
  throw new Stop('failed', message);
}

/**
 * Runs the command line `args` and returns its exit code: 0 only when everything it set out
 * to do is done. `cwd` resolves the repository and relative paths; `rm` deletes a folder and
 * `rename` moves one (fs.rmSync's and fs.renameSync's signatures). Exported for
 * scripts/remove-worktree.test.mjs.
 */
export function run(
  args,
  {cwd = process.cwd(), log = console.log, rm = rmSync, rename = renameSync} = {},
) {
  const options = parse(args);
  if (options.help) {
    log(USAGE);
    return 0;
  }
  if (options.error) {
    log(`${options.error}\n\n${USAGE}`);
    return 1;
  }
  try {
    const repo = repoAt(cwd);
    const context = {...options, cwd, log, rm, rename};
    return options.leftovers ? sweepLeftovers(repo, context) : removeWorktree(repo, context);
  } catch (error) {
    log(error instanceof Stop ? error.message : `failed: ${error.message}`);
    return 1;
  }
}

function parse(args) {
  const options = {target: null};
  for (const arg of args) {
    if (arg === '--') continue;
    if (FLAGS[arg]) options[FLAGS[arg]] = true;
    else if (arg.startsWith('-')) return {error: `unknown option ${arg}`};
    else if (options.target) return {error: `one worktree at a time: ${options.target}, ${arg}`};
    else options.target = arg;
  }
  return {...options, error: usageError(options)};
}

function usageError({help, leftovers, target, keepBranch}) {
  if (help) return null;
  if (leftovers)
    return target || keepBranch ? '--leftovers takes no worktree or --keep-branch' : null;
  return target ? null : 'which worktree? pass its name or path';
}

// --- git and paths ------------------------------------------------------------------

function git(cwd, args, input) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}

function gitSucceeds(cwd, args) {
  try {
    git(cwd, args);
    return true;
  } catch {
    return false;
  }
}

// A path as Windows compares them: absolute, forward slashes, no trailing slash, any case.
function pathKey(path) {
  const slashed = resolve(path).replace(/\\/g, '/').replace(/\/+$/, '');
  return WINDOWS ? slashed.toLowerCase() : slashed;
}

function isInside(path, dir) {
  const [inner, outer] = [pathKey(path), pathKey(dir)];
  return inner === outer || inner.startsWith(`${outer}/`);
}

function sameBytes(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

function isBuildOutput(path) {
  return BUILD_OUTPUT.some((pattern) => pattern.test(path));
}

function indent(lines) {
  const shown = lines.slice(0, LIST_LIMIT).map((line) => `  ${line}`);
  if (lines.length > LIST_LIMIT) shown.push(`  ... and ${lines.length - LIST_LIMIT} more`);
  return shown.join('\n');
}

/** The repository around `cwd`: its git common dir and its worktrees, the main one first. */
function repoAt(cwd) {
  let common;
  try {
    common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  } catch {
    refuse(`not inside a git checkout: ${cwd}`);
  }
  const all = worktreesOf(cwd);
  return {common, all, main: all[0].path};
}

/** `git worktree list --porcelain`, parsed. */
function worktreesOf(cwd) {
  return git(cwd, ['worktree', 'list', '--porcelain'])
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const fields = new Map(
        block.split(/\r?\n/).map((line) => {
          const at = line.indexOf(' ');
          return at === -1 ? [line, ''] : [line.slice(0, at), line.slice(at + 1)];
        }),
      );
      return {
        path: fields.get('worktree'),
        head: fields.get('HEAD') ?? '',
        branch: fields.get('branch')?.replace(/^refs\/heads\//, '') ?? null,
        locked: fields.has('locked'),
      };
    })
    .filter((worktree) => worktree.path);
}

// --- one worktree ---------------------------------------------------------------------

function removeWorktree(repo, context) {
  const {dryRun, log} = context;
  const worktree = findWorktree(repo, context);
  const what = worktree.branch ? `branch ${worktree.branch}` : 'detached';
  log(`target  ${worktree.path} (${what}, HEAD ${worktree.head.slice(0, 8)})`);
  // The fetch is the slow gate, so it goes first: the tree checks then run just before the rename.
  checkHead(repo, worktree, log);
  const branch = branchPlan(repo, worktree, context.keepBranch);
  checkTree(repo, worktree, log);
  if (dryRun) {
    log(
      `would   rename it to ${basename(worktree.path)}${REMOVING} (the in-use check), unregister it and delete it`,
    );
    log(`would   ${branch.remove ? `delete branch ${worktree.branch}` : branch.note}`);
    return 0;
  }
  const marker = claim(repo, worktree.path, context.rename);
  unregister(repo, worktree, marker, context);
  destroy(`${worktree.path}${REMOVING}`, marker, context.rm, log);
  if (branch.remove) git(repo.main, ['branch', '-D', worktree.branch]);
  log(`removed ${worktree.path} (${branch.note})`);
  return 0;
}

function findWorktree(repo, {target, cwd}) {
  const matches = repo.all.filter(namedBy(target, cwd));
  if (matches.length > 1) {
    refuse(
      `"${target}" names ${matches.length} worktrees; pass a path:\n${indent(matches.map((w) => w.path))}`,
    );
  }
  const [worktree] = matches;
  if (!worktree)
    refuse(`not a registered worktree: ${target} (for leftover folders, use --leftovers)`);
  if (worktree === repo.all[0])
    refuse('that is the main checkout; only linked worktrees can be removed');
  if (worktree.locked) refuse(`${worktree.path} is locked; unlock it first if it is really done`);
  for (const dir of new Set([cwd, process.cwd()])) {
    if (isInside(dir, worktree.path)) {
      refuse(
        `this is running from inside ${worktree.path}, which keeps it in use: run it from the main checkout (${repo.main})`,
      );
    }
  }
  return worktree;
}

// A bare word names a worktree by its folder name; anything with a slash is a path.
function namedBy(target, cwd) {
  if (isAbsolute(target) || /[\\/]/.test(target)) {
    const wanted = pathKey(resolve(cwd, target));
    return (worktree) => pathKey(worktree.path) === wanted;
  }
  const fold = (name) => (WINDOWS ? name.toLowerCase() : name);
  return (worktree) => fold(basename(worktree.path)) === fold(target);
}

function checkHead(repo, worktree, log) {
  git(repo.main, ['fetch', '--quiet', '--prune', 'origin']);
  const refs = remoteRefsContaining(repo, worktree.head);
  if (!refs.length) {
    refuse(
      `HEAD ${worktree.head.slice(0, 8)} is on no origin/* ref: push it, or discard it on purpose with git worktree remove --force`,
    );
  }
  log(`ok      HEAD is on ${refs.includes(BASE) ? BASE : refs[0]}`);
}

function checkTree(repo, worktree, log) {
  // Explicit modes, so no status.showUntrackedFiles or submodule setting can hide a change.
  const status = ['status', '--porcelain', '--untracked-files=normal', '--ignore-submodules=none'];
  const dirty = git(worktree.path, status);
  if (dirty)
    refuse(`uncommitted or untracked changes in ${worktree.path}:\n${indent(dirty.split('\n'))}`);
  log('ok      the tree is clean');

  const {unique, copies} = classifyIgnored(repo, worktree);
  if (unique.length) {
    refuse(
      `ignored files that may exist only in this worktree (move or delete them, then retry):\n${indent(unique)}`,
    );
  }
  const extra = copies.length ? `, plus copies of the main checkout's ${copies.join(', ')}` : '';
  log(`ok      the ignored files are build output${extra}`);
}

function remoteRefsContaining(repo, head) {
  return git(repo.main, [
    'for-each-ref',
    '--contains',
    head,
    '--format=%(refname:short)',
    'refs/remotes/origin',
  ])
    .split('\n')
    .filter((ref) => ref && ref !== 'origin/HEAD' && ref !== 'origin');
}

// `--directory` lists an ignored folder as one entry, so node_modules costs one line, not a walk.
// An untracked folder that only holds ignored files is listed too, ahead of its entries; those
// entries are judged one by one, and the status gate has already ruled out anything else in it.
function classifyIgnored(repo, worktree) {
  const entries = git(worktree.path, [
    'ls-files',
    '-z',
    '-o',
    '-i',
    '--exclude-standard',
    '--directory',
  ])
    .split('\0')
    .filter(Boolean);
  const holdsOthers = (entry) =>
    entry.endsWith('/') && entries.some((other) => other !== entry && other.startsWith(entry));
  const unique = [];
  const copies = [];
  for (const entry of entries) {
    if (holdsOthers(entry) || isBuildOutput(entry)) continue;
    const copy =
      !entry.endsWith('/') && sameBytes(join(worktree.path, entry), join(repo.main, entry));
    (copy ? copies : unique).push(entry);
  }
  return {unique, copies};
}

// The branch goes only once origin/master has it: merged work is safe on origin, and a branch
// that is pushed but unmerged may still be wanted. The local master always stays.
function branchPlan(repo, worktree, keepBranch) {
  const {branch} = worktree;
  if (!branch) return {remove: false, note: 'detached, no branch to delete'};
  if (keepBranch) return {remove: false, note: `branch ${branch} kept: --keep-branch`};
  if (`origin/${branch}` === BASE) {
    return {remove: false, note: `branch ${branch} kept: it is the base branch`};
  }
  if (!gitSucceeds(repo.main, ['merge-base', '--is-ancestor', `refs/heads/${branch}`, BASE])) {
    return {remove: false, note: `branch ${branch} kept: ${BASE} does not contain it`};
  }
  return {remove: true, note: `branch ${branch} deleted`};
}

// --- markers and the destructive steps -------------------------------------------------

function markerFor(repo, path) {
  const id = createHash('sha256').update(pathKey(path)).digest('hex').slice(0, 16);
  return join(repo.common, MARKERS, `${id}.json`);
}

/**
 * The in-use check: rename `path` to `path.removing`, which Windows refuses while a process has
 * its working directory or an open file inside. Writes the marker first and returns it.
 */
function claim(repo, path, rename) {
  const removing = `${path}${REMOVING}`;
  if (existsSync(removing)) refuse(`${removing} already exists: finish it with --leftovers first`);
  const marker = markerFor(repo, path);
  mkdirSync(join(repo.common, MARKERS), {recursive: true});
  writeFileSync(marker, `${JSON.stringify({path})}\n`);
  try {
    rename(path, removing);
  } catch (error) {
    rmSync(marker, {force: true});
    if (['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) {
      refuse(
        `${path} is in use: a session, terminal or dev server has its working directory (or a file open) inside it; close it and retry`,
      );
    }
    throw error;
  }
  return marker;
}

function unregister(repo, worktree, marker, {log, rename}) {
  const missing = repo.all
    .slice(1)
    .filter((other) => other !== worktree && !other.locked && !existsSync(other.path));
  const pruned =
    gitSucceeds(repo.main, ['worktree', 'prune']) &&
    !worktreesOf(repo.main).some((entry) => pathKey(entry.path) === pathKey(worktree.path));
  if (!pruned) undoClaim(worktree.path, marker, rename);
  log('ok      unregistered');
  if (missing.length) {
    log(
      `ok      the prune also unregistered worktrees whose folder was missing:\n${indent(missing.map((w) => w.path))}`,
    );
  }
}

// After a failed prune: rename the folder back, or say exactly where things stand. The marker
// stays on failure, so --leftovers can still find the .removing folder.
function undoClaim(path, marker, rename) {
  const removing = `${path}${REMOVING}`;
  try {
    rename(removing, path);
  } catch (error) {
    fail(
      `git worktree prune left ${path} registered, and renaming ${removing} back failed (${error.code ?? error.message}). Rename it back by hand to keep the worktree, or run pnpm worktree:remove --leftovers to finish removing it`,
    );
  }
  rmSync(marker, {force: true});
  refuse(`git worktree prune left ${path} registered; it was renamed back, so nothing changed`);
}

function destroy(dir, marker, rm, log) {
  try {
    rm(dir, RM_OPTIONS);
  } catch (error) {
    fail(
      `could not finish deleting ${dir} (${error.code ?? error.message}). It is already unregistered: close whatever holds it, then run pnpm worktree:remove --leftovers`,
    );
  }
  if (marker) rmSync(marker, {force: true});
  log(`ok      deleted ${dir}`);
}

// --- --leftovers -------------------------------------------------------------------------

function sweepLeftovers(repo, context) {
  const {found, unreadable} = findLeftovers(repo, context);
  for (const marker of unreadable) {
    context.log(
      `refused: unreadable marker ${marker}: look for its .removing folder by hand, then delete the marker`,
    );
  }
  if (!found.length && !unreadable.length) {
    context.log('no leftovers');
    return 0;
  }
  let failures = unreadable.length;
  // One folder's trouble never stops the sweep of the others.
  for (const leftover of found) {
    try {
      sweepOne(repo, leftover, context);
    } catch (error) {
      context.log(
        error instanceof Stop ? error.message : `failed: ${leftover.path}: ${error.message}`,
      );
      failures++;
    }
  }
  return failures ? 1 : 0;
}

/**
 * Folders under .claude/worktrees/ that are not registered, plus the `.removing` folder of every
 * marker. A marker without its folder is stale and is cleared (unless this is a dry run); one
 * that cannot be read is reported, never guessed at.
 */
function findLeftovers(repo, {dryRun, log}) {
  const found = new Map(poolLeftovers(repo).map((path) => [pathKey(path), {path, marker: null}]));
  const unreadable = [];
  for (const {marker, path} of readMarkers(repo)) {
    if (!path) {
      unreadable.push(marker);
    } else if (existsSync(`${path}${REMOVING}`)) {
      found.set(pathKey(`${path}${REMOVING}`), {path: `${path}${REMOVING}`, marker});
    } else if (!dryRun) {
      rmSync(marker, {force: true});
      log(`ok      cleared a stale marker for ${path}`);
    }
  }
  return {found: [...found.values()], unreadable};
}

function poolLeftovers(repo) {
  const registered = new Set(repo.all.map((worktree) => pathKey(worktree.path)));
  const pool = join(repo.main, '.claude', 'worktrees');
  const entries = existsSync(pool) ? readdirSync(pool, {withFileTypes: true}) : [];
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(pool, entry.name))
    .filter((path) => !registered.has(pathKey(path)));
}

/** Every marker as {marker, path}; path is null when the marker cannot be read. */
function readMarkers(repo) {
  const dir = join(repo.common, MARKERS);
  const names = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
  return names.map((name) => {
    const marker = join(dir, name);
    try {
      const {path} = JSON.parse(readFileSync(marker, 'utf8'));
      return {marker, path: typeof path === 'string' && path ? path : null};
    } catch {
      return {marker, path: null};
    }
  });
}

function sweepOne(repo, {path, marker}, {dryRun, log, rm, rename}) {
  const unique = contentGitLacks(repo, path);
  if (unique.length) {
    refuse(
      `${path} holds files whose content git does not have (move or delete them, then retry):\n${indent(unique)}`,
    );
  }
  if (dryRun) {
    log(`would   delete ${path}`);
    return;
  }
  // A `.removing` folder passed the gates before its rename; anything else takes the in-use check.
  const dir = path.endsWith(REMOVING) ? path : claimLeftover(path, rename);
  destroy(dir, marker, rm, log);
}

function claimLeftover(path, rename) {
  const removing = `${path}${REMOVING}`;
  if (existsSync(removing)) refuse(`${removing} already exists; it is swept on its own`);
  try {
    rename(path, removing);
  } catch (error) {
    if (['EBUSY', 'EPERM', 'EACCES'].includes(error.code))
      refuse(`${path} is in use; close whatever holds it and retry`);
    throw error;
  }
  return removing;
}

/**
 * The files in a leftover that may exist nowhere else: outside build output, with content git
 * has never stored, and not byte-identical to the main checkout's file at the same path. A
 * failed `git worktree remove` checks untracked files but not ignored ones, so a leftover can
 * still hold mockups, scans or notes. A .git below the root (a clone, or a worktree nested
 * inside) refuses outright.
 */
function contentGitLacks(repo, root) {
  const {files, repositories} = walkContent(root);
  if (repositories.length) {
    refuse(
      `${root} holds a repository or worktree, so it is not a leftover:\n${indent(repositories)}`,
    );
  }
  return filesGitLacks(repo, root, files).filter(
    (file) => !sameBytes(join(root, file), join(repo.main, file)),
  );
}

// Links are never followed: Dirent reports a junction or symlink as neither file nor folder.
function walkContent(root) {
  const found = {file: [], repository: []};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const path = join(dir, entry.name);
      const rel = relative(root, path).replace(/\\/g, '/');
      const kind = entryKind(entry, rel, dir === root);
      if (kind === 'folder') walk(path);
      else found[kind]?.push(rel);
    }
  };
  walk(root);
  return {files: found.file, repositories: found.repository};
}

// What the content walk does with one entry: 'folder' (descend), 'file', 'repository' or 'skip'.
function entryKind(entry, rel, atRoot) {
  // A worktree's own .git file only points at its registry entry; any other .git is a repo.
  if (entry.name === '.git') return atRoot && !entry.isDirectory() ? 'skip' : 'repository';
  if (entry.isDirectory()) return isBuildOutput(`${rel}/`) ? 'skip' : 'folder';
  return entry.isFile() && !isBuildOutput(rel) ? 'file' : 'skip';
}

// Two batched calls. hash-object reads the leftover as a work tree of this repository, so it
// applies the same line-ending conversion a commit would; cat-file then names the missing blobs.
function filesGitLacks(repo, root, files) {
  if (!files.length) return [];
  const asWorkTree = ['--git-dir', repo.common, '--work-tree', root];
  const hashes = git(
    root,
    [...asWorkTree, 'hash-object', '--stdin-paths'],
    `${files.join('\n')}\n`,
  );
  const answers = git(
    root,
    ['--git-dir', repo.common, 'cat-file', '--batch-check'],
    `${hashes}\n`,
  ).split('\n');
  return files.filter((_, i) => !answers[i] || answers[i].endsWith(' missing'));
}

// Run only when invoked directly (never when imported by the test). pnpm runs scripts from the
// workspace root, so INIT_CWD, where the command was typed, resolves relative paths.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2), {cwd: process.env.INIT_CWD || process.cwd()});
}
