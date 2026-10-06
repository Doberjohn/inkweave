/**
 * Delete this checkout's throwaway files, by tier, without asking (#742).
 *
 *   pnpm clean:transient [--dry-run]
 *
 * /close-session runs it. Every path it looks at is decided by `classify`, from facts gathered
 * first, into one of:
 * - delete: removed without asking.
 * - ask:    listed for the owner, never removed. A path that failed a guard, or whose origin
 *           is unknown.
 * - skip:   protected; neither removed nor listed.
 *
 * | Tier          | Paths (checkout root)                                  | Deleted when                     |
 * |---------------|--------------------------------------------------------|----------------------------------|
 * | E2E artifacts | apps/web/test-results/, apps/web/playwright-report/    | no live E2E run, newest file     |
 * |               |                                                        | over 30 minutes old, ignored     |
 * | Scratch       | .tmp-* and tmp-* folders, *.log, apps/web/*.log        | ignored, newest file over a day  |
 * | Unknown       | screenshots/                                           | never: ask                       |
 * | Protected     | PROTECTED below                                        | never: skip                      |
 *
 * A tracked or non-ignored path is always ask. Parallel sessions share the main checkout, so
 * its E2E artifacts may belong to another session's run, and a failed run's report is the
 * evidence for what broke: hence the live-run check and the 30-minute floor. The live-run check
 * is machine-wide (any Playwright process, any listener on the E2E ports 5200-5299) and a check
 * that fails counts as a live run.
 *
 * A folder is renamed to .tmp-clean-transient-<stamp>/ before it is deleted. The rename is
 * atomic, so a run that starts mid-delete gets a fresh folder; Windows refuses it while a
 * process holds a file inside, which keeps the folder (ask); and a delete that fails leaves an
 * ignored scratch folder that a later run sweeps.
 *
 * Unlike scripts/remove-worktree.mjs this is not a git operation, so the git-write-protection
 * hook must not block it. Node built-ins only.
 */
import {execFileSync} from 'node:child_process';
import {lstatSync, readdirSync, renameSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const MINUTE = 60 * 1000;
// How long an E2E report must sit untouched before it counts as abandoned rather than fresh.
export const E2E_QUIET_MS = 30 * MINUTE;
export const SCRATCH_AGE_MS = 24 * 60 * MINUTE;

// Never deleted, never listed. Matched against checkout-relative paths with a trailing slash
// on folders. node_modules/ matches at any depth.
export const PROTECTED = [
  /^\.knowledge\//,
  /^\.worktrees\//,
  /^\.claude\/worktrees\//,
  /^apps\/web\/public\/mockups\//,
  /^(dist|coverage|reports)\//,
  /(^|\/)node_modules\//,
];

const E2E_DIRS = ['apps/web/test-results', 'apps/web/playwright-report'];
const ASIDE_PREFIX = '.tmp-clean-transient-';
const E2E_PORTS = [5200, 5299];

const USAGE = `Usage: pnpm clean:transient [--dry-run]

Deletes this checkout's git-ignored throwaway files that pass their guards: E2E artifacts
untouched for 30 minutes while no E2E run is live, and scratch folders and logs older than a
day. Lists everything else it found for the owner. --dry-run prints the plan and deletes
nothing.`;

/** The tier of a checkout-relative path, folders with a trailing slash. */
export function tierOf(path) {
  if (PROTECTED.some((pattern) => pattern.test(path))) return 'protected';
  if (E2E_DIRS.some((dir) => path === `${dir}/`)) return 'e2e';
  if (path === 'screenshots/') return 'unknown';
  return 'scratch';
}

/**
 * Decides one path. `entry` is {path, kind, newestMs, ignored, tracked}, with newestMs the
 * mtime of the newest thing inside (or of the file); `env` is {now, e2e}, with e2e.live true,
 * false, or null when the check failed. Returns {action: 'delete' | 'ask' | 'skip', reason}.
 */
export function classify(entry, {now, e2e}) {
  const tier = tierOf(entry.path);
  if (tier === 'protected') return {action: 'skip', reason: 'protected'};
  if (tier === 'unknown') return {action: 'ask', reason: 'unknown origin'};
  if (entry.tracked) return {action: 'ask', reason: 'tracked by git'};
  if (!entry.ignored) return {action: 'ask', reason: 'not git-ignored'};

  const age = now - entry.newestMs;
  if (tier === 'e2e') {
    if (e2e.live !== false) return {action: 'ask', reason: e2e.reason};
    if (age <= E2E_QUIET_MS) return {action: 'ask', reason: `newest file ${ago(age)} old`};
    return {action: 'delete', reason: `E2E artifacts, newest file ${ago(age)} old`};
  }
  if (age <= SCRATCH_AGE_MS) return {action: 'ask', reason: `newest file ${ago(age)} old`};
  return {action: 'delete', reason: `scratch, newest file ${ago(age)} old`};
}

/**
 * Reads the live-run probe's JSON ({processes: [{pid, name}], ports: [n]}). Returns {live,
 * reason}; live is null when the output can't be read, which callers treat as live.
 */
export function liveRunFrom(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return {live: null, reason: 'live-run check failed: unreadable output'};
  }
  // Object() so that null or a bare number reads as incomplete instead of throwing.
  const complete = ['processes', 'ports'].every((key) => Object.hasOwn(Object(report), key));
  if (!complete) return {live: null, reason: 'live-run check failed: incomplete output'};
  const processes = [report.processes ?? []].flat();
  const ports = [report.ports ?? []].flat();
  if (processes.length) {
    const first = processes[0];
    return {live: true, reason: `E2E run live (pid ${first.pid} ${first.name})`};
  }
  if (ports.length) return {live: true, reason: `E2E run live (port ${ports[0]} listening)`};
  return {live: false, reason: 'no E2E run'};
}

// Windows PowerShell 5.1. Excludes itself ($PID) and this script: the filter text would
// otherwise match its own command line. Get-NetTCPConnection stops on error so that a failed
// lookup fails the check instead of reading as "no listeners".
function probeScript(ownPid) {
  const [low, high] = E2E_PORTS;
  return `$ErrorActionPreference = 'Stop'
$own = @($PID, ${ownPid})
$processes = @(Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^(node|chrome-headless-shell)' -and
  $_.CommandLine -match 'playwright|chrome-headless-shell' -and
  $own -notcontains $_.ProcessId
} | ForEach-Object { @{ pid = $_.ProcessId; name = $_.Name } })
$ports = @(Get-NetTCPConnection -State Listen | Where-Object {
  $_.LocalPort -ge ${low} -and $_.LocalPort -le ${high}
} | ForEach-Object { $_.LocalPort } | Sort-Object -Unique)
ConvertTo-Json -Compress -Depth 3 @{ processes = $processes; ports = $ports }`;
}

/** Looks for a live E2E run anywhere on this machine. */
export function probeLiveRun() {
  if (process.platform !== 'win32') {
    return {live: null, reason: 'live-run check failed: only implemented for Windows'};
  }
  const encoded = Buffer.from(probeScript(process.pid), 'utf16le').toString('base64');
  try {
    const stdout = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60 * 1000},
    );
    return liveRunFrom(stdout.trim());
  } catch (error) {
    return {live: null, reason: `live-run check failed: ${firstLine(error.message)}`};
  }
}

// --- facts --------------------------------------------------------------------------

function git(cwd, args, input) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  });
}

/** The candidate paths that exist, checkout-relative, folders with a trailing slash. */
function candidates(root) {
  return SOURCES.flatMap(({dir, match}) =>
    readdirSafe(join(root, dir))
      .filter(match)
      .map((item) => `${dir ? `${dir}/` : ''}${item.name}${item.isDirectory() ? '/' : ''}`),
  );
}

const isLog = (item) => item.isFile() && item.name.endsWith('.log');
const isDirNamed = (pattern) => (item) => item.isDirectory() && pattern.test(item.name);

// Where candidates are looked for (one level, never deeper) and which entries qualify.
const SOURCES = [
  {dir: '', match: isDirNamed(/^\.?tmp-/)},
  {dir: '', match: isDirNamed(/^screenshots$/)},
  {dir: '', match: isLog},
  {dir: 'apps/web', match: isLog},
  {dir: 'apps/web', match: isDirNamed(/^(test-results|playwright-report)$/)},
];

function readdirSafe(dir) {
  try {
    return readdirSync(dir, {withFileTypes: true});
  } catch {
    return [];
  }
}

/**
 * Bytes, file count and the newest file's mtime under `path`, without following links. Folder
 * mtimes count only for a folder that holds no files: moving a folder can touch its own.
 */
function measure(path) {
  const stat = lstatSync(path);
  if (!stat.isDirectory()) return {bytes: stat.size, files: 1, newestMs: stat.mtimeMs};
  const totals = {bytes: 0, files: 0, newestMs: -Infinity};
  for (const name of readdirSync(path)) {
    const inner = measure(join(path, name));
    totals.bytes += inner.bytes;
    if (!inner.files) continue;
    totals.files += inner.files;
    totals.newestMs = Math.max(totals.newestMs, inner.newestMs);
  }
  if (!totals.files) totals.newestMs = stat.mtimeMs;
  return totals;
}

/**
 * The ignored subset of `paths`. Each one exists, and folders carry their trailing slash: a
 * `dir/` rule only matches a path git sees as a folder, so a missing path or a folder without
 * the slash reads as "not ignored". Tracked paths are never reported ignored.
 */
function ignoredOf(root, paths) {
  if (!paths.length) return new Set();
  try {
    const out = git(root, ['check-ignore', '--stdin', '-z'], paths.join('\0'));
    return new Set(out.split('\0').filter(Boolean));
  } catch (error) {
    if (error.status === 1) return new Set(); // nothing ignored
    throw error;
  }
}

function isTracked(root, path) {
  return git(root, ['ls-files', '-z', '--', path]).length > 0;
}

/** Every candidate with its facts and verdict. */
function plan(root, {now, probeLive}) {
  const paths = candidates(root).filter((path) => tierOf(path) !== 'protected');
  const ignored = ignoredOf(root, paths);
  // Only probe when there is an E2E folder to decide: the probe takes a few seconds.
  const needsProbe = paths.some((path) => tierOf(path) === 'e2e');
  const e2e = needsProbe ? probeLive() : {live: false, reason: 'no E2E run'};
  const time = now();
  return paths
    .map((path) => {
      const facts = measure(join(root, path));
      const entry = {
        path,
        kind: path.endsWith('/') ? 'dir' : 'file',
        newestMs: facts.newestMs,
        ignored: ignored.has(path),
        tracked: isTracked(root, path),
      };
      return {...entry, ...facts, ...classify(entry, {now: time, e2e})};
    })
    .filter((row) => row.action !== 'skip');
}

// --- delete -------------------------------------------------------------------------

// What Windows reports when a process holds the file, or a file inside the folder.
const IN_USE = ['EPERM', 'EBUSY', 'EACCES'];

/** Deletes one row. Returns 'deleted', 'kept' (in use or changed) or 'failed', with a note. */
function remove(root, row, {rename, rm, now}) {
  const target = join(root, row.path);
  if (row.kind === 'file') {
    try {
      rm(target, {force: false});
      return {outcome: 'deleted'};
    } catch (error) {
      if (IN_USE.includes(error.code)) return {outcome: 'kept', note: 'in use by a process'};
      return {outcome: 'failed', note: firstLine(error.message)};
    }
  }
  const aside = join(root, `${ASIDE_PREFIX}${now()}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    rename(target, aside);
  } catch (error) {
    if (IN_USE.includes(error.code)) {
      return {outcome: 'kept', note: 'in use: a process holds a file inside'};
    }
    return {outcome: 'failed', note: firstLine(error.message)};
  }
  // The guards were decided at plan time. A run that started since then may have written into
  // the folder before the rename; after it, nothing can (Windows refuses the rename while a
  // handle is open inside), so this measure is final. Anything newer puts the folder back.
  if (measure(aside).newestMs > row.newestMs) {
    try {
      rename(aside, target);
      return {outcome: 'kept', note: 'changed since the plan'};
    } catch (error) {
      const left = aside.slice(root.length + 1);
      return {outcome: 'failed', note: `changed since the plan, left at ${left}: ${error.code}`};
    }
  }
  try {
    rm(aside, {recursive: true, force: true, maxRetries: 3});
    return {outcome: 'deleted'};
  } catch (error) {
    const left = aside.slice(root.length + 1);
    return {outcome: 'failed', note: `left at ${left}: ${firstLine(error.message)}`};
  }
}

// --- output -------------------------------------------------------------------------

function ago(ms) {
  const minutes = Math.floor(Math.max(ms, 0) / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} days`;
}

function size(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit ? value.toFixed(1) : value} ${units[unit]}`;
}

function firstLine(text) {
  return String(text).split(/\r?\n/)[0];
}

function describe(row) {
  const files = row.kind === 'dir' ? `, ${row.files} files` : '';
  return `${row.path.padEnd(32)} ${size(row.bytes)}${files}: ${row.reason}`;
}

// --- entry point ----------------------------------------------------------------------

/**
 * Runs the command line `args` and returns its exit code: 1 on a usage error or a failed
 * delete, otherwise 0, even when rows are left to ask about. The options inject the I/O
 * for scripts/clean-transient.test.mjs.
 */
export function run(
  args,
  {
    cwd = process.cwd(),
    log = console.log,
    now = () => Date.now(),
    probeLive = probeLiveRun,
    rename = renameSync,
    rm = rmSync,
  } = {},
) {
  const {help, dryRun, unknown} = parseArgs(args);
  if (help) {
    log(USAGE);
    return 0;
  }
  if (unknown) {
    log(`unknown argument ${unknown}\n\n${USAGE}`);
    return 1;
  }
  const root = toplevel(cwd);
  if (!root) {
    log(`not inside a git checkout: ${cwd}`);
    return 1;
  }
  const rows = plan(root, {now, probeLive});
  if (!rows.length) {
    log('no transient files found');
    return 0;
  }
  return dryRun ? printPlan(rows, log) : execute(root, rows, {log, now, rename, rm});
}

function parseArgs(args) {
  return {
    help: args.includes('--help') || args.includes('-h'),
    dryRun: args.includes('--dry-run'),
    unknown: args.find((arg) => !['--dry-run', '--help', '-h', '--'].includes(arg)),
  };
}

function toplevel(cwd) {
  try {
    return resolve(git(cwd, ['rev-parse', '--show-toplevel']).trim());
  } catch {
    return null;
  }
}

const byAction = (rows, action) => rows.filter((row) => row.action === action);

function printPlan(rows, log) {
  const deletable = byAction(rows, 'delete');
  for (const row of deletable) log(`delete  ${describe(row)}`);
  for (const row of byAction(rows, 'ask')) log(`ask     ${describe(row)}`);
  log(`dry run: would free ${size(deletable.reduce((total, row) => total + row.bytes, 0))}`);
  return 0;
}

/** Deletes the delete rows, then lists the ask rows and any it had to keep. */
function execute(root, rows, {log, ...io}) {
  const asks = byAction(rows, 'ask');
  let freed = 0;
  let failed = 0;
  for (const row of byAction(rows, 'delete')) {
    const {outcome, note} = remove(root, row, io);
    if (outcome === 'deleted') {
      freed += row.bytes;
      log(`deleted ${describe(row)}`);
    } else if (outcome === 'kept') {
      asks.push({...row, reason: note});
    } else {
      failed += 1;
      log(`FAILED  ${row.path}: ${note}`);
    }
  }
  for (const row of asks) log(`ask     ${describe(row)}`);
  log(`freed ${size(freed)}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
