#!/usr/bin/env node
/**
 * The pre-push hook's E2E step in a Claude Code cloud session (#983).
 *
 * Cloud containers ship no WebKit, so the default chromium + webkit + mobile-chrome run
 * always failed there, and every cloud push skipped all of the hook's gates with
 * `--no-verify`. This runs what a container can: chromium and mobile-chrome, on the specs
 * changed since the branch left origin/master (Playwright's --only-changed follows the files
 * a spec imports, not the app source it only visits). CI still runs all five browsers.
 *
 * `.husky/pre-push` calls it when CLAUDE_CODE_REMOTE=true, after its Windows branch, and
 * passes `--workers=<n>` when PRE_PUSH_E2E_WORKERS is set; any argument goes on to
 * Playwright. PRE_PUSH_FULL has nothing to add here, since the container has no WebKit. It
 * exits with Playwright's code.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {homedir, tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {linkShippedBrowsers, wantedBrowsers} from './lib/playwright-browsers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_REF = 'origin/master';

function fail(message) {
  console.error(`pre-push: ${message}`);
  process.exit(1);
}

/** playwright-core's folder, through the `@playwright/test` the web app runs its tests with. */
function playwrightCoreDir() {
  const fromWeb = createRequire(join(ROOT, 'apps', 'web', 'package.json'));
  const fromTest = createRequire(fromWeb.resolve('@playwright/test/package.json'));
  const fromPlaywright = createRequire(fromTest.resolve('playwright/package.json'));
  return dirname(fromPlaywright.resolve('playwright-core/package.json'));
}

/** Where Playwright looks for browsers, as it reads PLAYWRIGHT_BROWSERS_PATH. */
function shippedBrowsersDir(coreDir) {
  const configured = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (configured === '0') return join(coreDir, '.local-browsers');
  return configured ? resolve(ROOT, configured) : join(homedir(), '.cache', 'ms-playwright');
}

/** The commit the branch left origin/master at, so master's own later changes don't count. */
function mergeBase() {
  const run = spawnSync('git', ['merge-base', 'HEAD', BASE_REF], {cwd: ROOT, encoding: 'utf8'});
  if (run.status !== 0) {
    fail(
      `can't find where this branch left ${BASE_REF}; run \`git fetch origin master\` and push again.`,
    );
  }
  return run.stdout.trim();
}

function playwright(args, env, stdio) {
  const run = spawnSync('pnpm', ['--filter', 'inkweave-web', 'test:e2e', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio,
    env,
  });
  if (run.error) fail(`could not start pnpm: ${run.error.message}`);
  return run;
}

function linkBrowsers() {
  const coreDir = playwrightCoreDir();
  try {
    return linkShippedBrowsers({
      shippedDir: shippedBrowsersDir(coreDir),
      linkDir: join(tmpdir(), 'inkweave-pw-browsers'),
      wanted: wantedBrowsers(JSON.parse(readFileSync(join(coreDir, 'browsers.json'), 'utf8'))),
    });
  } catch (error) {
    return fail(error.message);
  }
}

const {browsersPath, linked} = linkBrowsers();
const env = {...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath, E2E_SERVER: 'dev'};
const args = [
  '--project',
  'chromium',
  '--project',
  'mobile-chrome',
  `--only-changed=${mergeBase()}`,
  '--pass-with-no-tests',
  ...process.argv.slice(2),
];

console.log(
  `pre-push: cloud session, no WebKit here: chromium + mobile-chrome on specs changed since the branch left ${BASE_REF}. CI runs all five browsers.`,
);
for (const line of linked) console.log(`pre-push: using ${line}`);

// Listing takes a second; a run starts Vite and warms 7 pages up even when it then finds no spec.
const listing = playwright([...args, '--list'], env, 'pipe');
if (listing.status === 0 && /^Total: 0 tests/m.test(listing.stdout)) {
  console.log('pre-push: no E2E spec changed, so none ran.');
  process.exit(0);
}
process.exit(playwright(args, env, 'inherit').status ?? 1);
