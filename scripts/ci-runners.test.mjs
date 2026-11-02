// While the repo is private, a job on GitHub's runners spends the account's free minutes, which
// run out in days at the app's pace, so the app's jobs run on the owner's PC (#1086,
// docs/SELF_HOSTED_RUNNER.md). A new job that names a GitHub-hosted label, or a runs-on that drops
// the fork guard and so would let a fork's pull request run code on the PC, fails here. So does an
// E2E layout that puts the cross-browser jobs back on every push.
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
  `\${{ vars.CI_ON_PC == 'true' && !github.event.pull_request.head.repo.fork && '${pcLabel}' || '${githubLabel}' }}`;
const LINUX = onPc('inkweave-linux', 'ubuntu-latest');
const WINDOWS = onPc('inkweave-windows', 'windows-latest');

// These stay on GitHub's runners on purpose. Claude review installs bubblewrap with sudo and lifts
// an AppArmor sysctl, which must not touch the owner's PC. The drift alarm is the watchdog that
// notices when deploys stall, so it has to run while the PC is off.
const STAYS_ON_GITHUB = {'claude-review.yml': 'ubuntu-latest', 'deploy-drift.yml': 'ubuntu-latest'};
const ON_WINDOWS = new Set(['script-tests-windows.yml']);

const runsOn = (text) => [...text.matchAll(/^\s+runs-on:\s*(.+?)\s*$/gm)].map((match) => match[1]);

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
});

describe('the E2E layout', () => {
  const ci = WORKFLOWS['ci.yml'];
  const full = WORKFLOWS['full-e2e.yml'];

  it('runs only chromium and mobile-chrome on a pull request push, and no E2E on master', () => {
    expect(ci).toMatch(
      /^ {2}e2e:\n {4}if: github\.event_name == 'pull_request'\n {4}uses: \.\/\.github\/workflows\/e2e\.yml$/m,
    );
    expect(ci).toContain(
      `matrix: '[{"projects": ["chromium", "mobile-chrome"], "server": "dev"}]'`,
    );
    expect(ci.match(/^\s+matrix:/gm)).toHaveLength(1);
  });

  it('runs the other browsers once per pull request, never on its later pushes', () => {
    expect(full).toContain('types: [opened, reopened, ready_for_review, labeled]');
    expect(full).not.toMatch(/synchronize/);
    for (const project of ['firefox', 'webkit', 'mobile-safari'])
      expect(full).toContain(`["${project}"]`);
  });
});
