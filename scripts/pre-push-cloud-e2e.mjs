#!/usr/bin/env node
/**
 * The pre-push hook's E2E step in a Claude Code cloud session (#983).
 *
 * Cloud containers ship no WebKit, so the default chromium + webkit + mobile-chrome run
 * always failed there, and every cloud push skipped all of the hook's gates with
 * `--no-verify`. This runs what a container can: chromium and mobile-chrome, on the specs
 * changed since origin/master (Playwright's --only-changed follows the helpers a spec
 * imports, not app source). CI still runs all five browsers on every PR.
 *
 * `.husky/pre-push` calls it when CLAUDE_CODE_REMOTE=true, after its Windows branch. It
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

/** Playwright's browsers.json, found through the web app's own `playwright`. */
function readBrowsersJson() {
  const fromWeb = createRequire(join(ROOT, 'apps', 'web', 'package.json'));
  const fromPlaywright = createRequire(fromWeb.resolve('playwright/package.json'));
  const corePackage = fromPlaywright.resolve('playwright-core/package.json');
  return JSON.parse(readFileSync(join(dirname(corePackage), 'browsers.json'), 'utf8'));
}

const {browsersPath, linked} = linkShippedBrowsers({
  shippedDir: process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache', 'ms-playwright'),
  linkDir: join(tmpdir(), 'inkweave-pw-browsers'),
  wanted: wantedBrowsers(readBrowsersJson()),
});

console.log(
  `pre-push: cloud session, no WebKit here: chromium + mobile-chrome on specs changed since ${BASE_REF}. CI runs all five browsers.`,
);
for (const line of linked) console.log(`pre-push: using ${line}`);

const run = spawnSync(
  'pnpm',
  [
    '--filter',
    'inkweave-web',
    'test:e2e',
    '--project',
    'chromium',
    '--project',
    'mobile-chrome',
    `--only-changed=${BASE_REF}`,
    '--pass-with-no-tests',
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: {...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath, E2E_SERVER: 'dev'},
  },
);
process.exit(run.status ?? 1);
