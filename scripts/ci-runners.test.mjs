// While the repo is private, a job on GitHub's runners spends the account's free minutes, which
// run out in days at the app's pace, so the app's jobs run on the owner's PC (#1086,
// docs/SELF_HOSTED_RUNNER.md). This fails a job that names a GitHub-hosted label, a routing rule
// that would send another repository's pull request to the PC, and an E2E layout that runs other
// browsers than #1086 settled on, runs them on a draft, or lets one run cancel another kind.
import {describe, expect, it} from 'vitest';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const WORKFLOWS = Object.fromEntries(
  readdirSync(WORKFLOWS_DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => [name, readFileSync(join(WORKFLOWS_DIR, name), 'utf8')]),
);

const onPc = (pcLabel, githubLabel) =>
  `\${{ vars.CI_ON_PC == 'true' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && '${pcLabel}' || '${githubLabel}' }}`;
const LINUX = onPc('inkweave-linux', 'ubuntu-latest');
const WINDOWS = onPc('inkweave-windows', 'windows-latest');

// These stay on GitHub's runners on purpose. Claude review installs bubblewrap with sudo and lifts
// an AppArmor sysctl, which must not touch the owner's PC. The drift alarm is the watchdog that
// notices when deploys stall, so it has to run while the PC is off.
const STAYS_ON_GITHUB = {'claude-review.yml': 'ubuntu-latest', 'deploy-drift.yml': 'ubuntu-latest'};
const ON_WINDOWS = new Set(['script-tests-windows.yml']);

const runsOn = (text) => [...text.matchAll(/^\s+runs-on:\s*(.+?)\s*$/gm)].map((match) => match[1]);

// The value of the first `key:` at `indent` spaces, with a folded (>-) block joined into one line.
function field(text, indent, key) {
  const pad = ' '.repeat(indent);
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${pad}${key}:`));
  if (start < 0) throw new Error(`no "${key}:" at ${indent} spaces`);
  const value = lines[start].slice(pad.length + key.length + 1).trim();
  if (value !== '>-') return value;
  const block = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith(`${pad}  `)) break;
    block.push(line.trim());
  }
  return block.join(' ');
}

// Evaluates the GitHub Actions expressions these workflows use: paths into github and vars (a
// missing one is null, as in Actions), string literals, ==, !=, !, &&, || and format().
function evaluate(expression, {github, vars = {}}) {
  const js = expression
    .trim()
    .replace(/^\$\{\{|\}\}$/g, '')
    .replace(/\b(github|vars)((?:\.\w+)+)/g, (_, root, path) => root + path.replaceAll('.', '?.'))
    .replace(/([!=])=/g, '$1==');
  const format = (template, ...args) => template.replace(/\{(\d+)\}/g, (_, i) => String(args[i]));
  return new Function('github', 'vars', 'format', `return (${js});`)(github, vars, format);
}

const REPO = 'Doberjohn/inkweave';
const ON = {CI_ON_PC: 'true'};
const push = {event_name: 'push', repository: REPO, ref: 'refs/heads/master', event: {}};
const pullRequest = (headRepo, extra = {}) => ({
  event_name: 'pull_request',
  repository: REPO,
  ref: 'refs/pull/7/merge',
  run_id: 101,
  event: {action: 'synchronize', pull_request: {draft: false, head: {repo: headRepo}}, ...extra},
});
const OWN = {full_name: REPO};
const FORK = {full_name: 'someone/inkweave', fork: true};

describe('where the workflows run', () => {
  it('reads every workflow', () => {
    expect(Object.keys(WORKFLOWS)).toEqual(
      expect.arrayContaining(['ci.yml', 'e2e.yml', 'full-e2e.yml']),
    );
  });

  it.each(Object.keys(WORKFLOWS))('%s runs each job where it should', (name) => {
    const expected = STAYS_ON_GITHUB[name] ?? (ON_WINDOWS.has(name) ? WINDOWS : LINUX);
    for (const value of runsOn(WORKFLOWS[name])) expect(value).toBe(expected);
  });

  it.each([
    ['a push, with the switch off', push, {}, 'ubuntu-latest'],
    ['a push to master', push, ON, 'inkweave-linux'],
    ['the nightly run', {...push, event_name: 'schedule'}, ON, 'inkweave-linux'],
    ["this repository's own pull request", pullRequest(OWN), ON, 'inkweave-linux'],
    ["a fork's pull request", pullRequest(FORK), ON, 'ubuntu-latest'],
    ['a pull request whose fork was deleted', pullRequest(null), ON, 'ubuntu-latest'],
  ])('sends %s where it should', (_, github, vars, label) => {
    const onWindows = {'inkweave-linux': 'inkweave-windows', 'ubuntu-latest': 'windows-latest'};
    expect(evaluate(LINUX, {github, vars})).toBe(label);
    expect(evaluate(WINDOWS, {github, vars})).toBe(onWindows[label]);
  });
});

describe('the E2E layout', () => {
  const ci = WORKFLOWS['ci.yml'];
  const full = WORKFLOWS['full-e2e.yml'];
  const job = (projects, server) => ({projects, server});
  const PR_BROWSERS = [
    job(['firefox'], 'preview'),
    job(['webkit'], 'preview'),
    job(['mobile-safari'], 'preview'),
  ];
  const ALL_BROWSERS = [job(['chromium', 'mobile-chrome'], 'dev'), ...PR_BROWSERS];

  it('runs chromium and mobile-chrome on every push, to a pull request or to master', () => {
    const call = ci.match(
      /^ {2}e2e:\n {4}uses: \.\/\.github\/workflows\/e2e\.yml\n {4}with:\n {6}matrix: '(.+)'$/m,
    );
    expect(call).not.toBeNull();
    expect(JSON.parse(call[1])).toEqual([job(['chromium', 'mobile-chrome'], 'dev')]);
    expect(ci.match(/^\s+matrix:/gm)).toHaveLength(1);
  });

  it('gives each E2E job 30 minutes, room for a slow runner', () => {
    const job = WORKFLOWS['e2e.yml'].match(/^ {2}e2e-tests:\n((?: {4}.*\n|\n)+)/m);
    expect(job).not.toBeNull();
    expect(job[1].match(/^ {4}timeout-minutes: (\d+)$/m)?.[1]).toBe('30');
  });

  it('starts the other browsers on a pull request only when it opens, is ready or is labelled', () => {
    expect(full).toContain('types: [opened, reopened, ready_for_review, labeled]');
    expect(full).not.toMatch(/synchronize/);
    expect(full.match(/^\s+matrix:/gm)).toHaveLength(1);
  });

  const labeled = (name, draft = false) => ({
    ...pullRequest(OWN),
    event: {action: 'labeled', label: {name}, pull_request: {draft, head: {repo: OWN}}},
  });
  const opened = (action, draft) => ({
    ...pullRequest(OWN),
    event: {action, pull_request: {draft, head: {repo: OWN}}},
  });
  const PR_GROUP = 'full-e2e-pull_request-refs/pull/7/merge';
  const SKIP_GROUP = 'full-e2e-skip-101';

  it.each([
    ['a pull request opened ready', opened('opened', false), PR_GROUP, PR_BROWSERS],
    ['a draft marked ready', opened('ready_for_review', false), PR_GROUP, PR_BROWSERS],
    ['the full-e2e label', labeled('full-e2e'), PR_GROUP, PR_BROWSERS],
    ['a pull request opened as a draft', opened('opened', true), SKIP_GROUP, null],
    ['a draft reopened', opened('reopened', true), SKIP_GROUP, null],
    ['the full-e2e label on a draft', labeled('full-e2e', true), SKIP_GROUP, null],
    ['another label', labeled('infrastructure'), SKIP_GROUP, null],
    [
      'the nightly run',
      {...push, event_name: 'schedule'},
      'full-e2e-schedule-refs/heads/master',
      ALL_BROWSERS,
    ],
    [
      'Run workflow',
      {...push, event_name: 'workflow_dispatch'},
      'full-e2e-workflow_dispatch-refs/heads/master',
      ALL_BROWSERS,
    ],
  ])('on %s, runs in its group and tests the browsers it should', (_, github, group, browsers) => {
    expect(evaluate(field(full, 2, 'group'), {github})).toBe(group);
    expect(Boolean(evaluate(field(full, 4, 'if'), {github}))).toBe(browsers !== null);
    if (browsers)
      expect(JSON.parse(evaluate(field(full, 6, 'matrix'), {github}))).toEqual(browsers);
  });
});
