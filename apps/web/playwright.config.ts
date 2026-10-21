import {execFileSync} from 'node:child_process';
import {defineConfig, devices} from '@playwright/test';
import {E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_ORIGIN} from './e2e/fixtures/supabaseStub';

// Local E2E servers live here, clear of the dev-server ports (5173 and up), Storybook and
// Chrome's blocked ports. Not the OS's own free-port pick: this machine's dynamic range
// starts at 1024, so that could land on any of them.
const FIRST_PORT = 5200;
const PORT_COUNT = 100;

// Runs in a child process so this file needs no top-level await (binding a socket is
// asynchronous). Tries each port from a random offset, so two runs starting together rarely
// pick the same one.
const FIND_FREE_PORT = `
const [first, count] = process.argv.slice(1).map(Number);
const start = Math.floor(Math.random() * count);
const tryPort = (i) => {
  if (i === count) throw new Error('No free E2E port in ' + first + '-' + (first + count - 1));
  const port = first + ((start + i) % count);
  const server = require('net').createServer();
  server.once('error', () => tryPort(i + 1));
  server.listen(port, () => server.close(() => process.stdout.write(String(port))));
};
tryPort(0);
`;

/**
 * The port for this run's own Vite. Local runs used to reuse whatever answered on 5173, which
 * was often another checkout's dev server: the run tested the wrong code, then failed with
 * ERR_CONNECTION_REFUSED when that server's owner shut it down. A local run now takes a free
 * port of its own (or E2E_PORT, if set). The main process picks it once and stores it in the
 * env; the test workers re-import this file with that env, so they all agree. CI keeps 5173.
 */
function resolvePort(): number {
  if (process.env.CI) return 5173;
  process.env.E2E_PORT ||= execFileSync(process.execPath, [
    '-e',
    FIND_FREE_PORT,
    String(FIRST_PORT),
    String(PORT_COUNT),
  ]).toString();
  const port = Number(process.env.E2E_PORT);
  const isUsablePort = Number.isInteger(port) && port >= 1024 && port <= 65535;
  if (!isUsablePort) {
    throw new Error(`E2E_PORT must be a port from 1024 to 65535, got "${process.env.E2E_PORT}"`);
  }
  return port;
}

/**
 * CI runs two workers on its 4-vCPU runners (#854). On the chromium project in a 4-vCPU
 * container, one worker took 8.9 min, two 6.0, three 5.4 and four 5.3: the browsers' renderers
 * fill the CPUs at two, so a third or fourth worker saves under a minute and adds contention.
 *
 * Local Windows runs cap at 3: Playwright's default (half the logical CPUs, 6 on the dev box)
 * needs an estimated 4.4 GB of commit memory against the 2.7 GB measured for 3, and with other
 * sessions open this machine often lacks it, so headless Chrome crashed out of memory mid-run.
 * The cap lives here rather than in the pre-push hook because this file always comes from the
 * branch under test, whichever copy of the hook runs (a worktree's push enters through the main
 * checkout's copy; see .husky/handoff.sh), and it also covers runs outside the hook. `--workers`
 * (or PRE_PUSH_E2E_WORKERS in the hook) overrides it.
 */
function resolveWorkers(): number | undefined {
  if (process.env.CI) return 2;
  return process.platform === 'win32' ? 3 : undefined;
}

/**
 * The server this run tests (#869). `dev`, the default, is Vite's dev server, where React logs
 * its development-only errors and the console guard (e2e/fixtures/test-fixtures.ts) fails a test
 * on them. `preview` builds the app into PREVIEW_OUT_DIR and serves that production bundle with
 * `vite preview`: a page arrives as a few chunks instead of hundreds of modules compiled on
 * request, so the chromium project ran in about half the time (184 s against 358 on two workers
 * in a 4-vCPU container), and the tests run the code that ships. CI runs chromium and
 * mobile-chrome on `dev` and the other three projects on `preview` (ci.yml). Unlike the dev
 * server (ensureSynergiesPlugin), the build never refreshes synergy data, so after an engine
 * change run `pnpm precompute-synergies` first.
 */
function resolveServer(): 'dev' | 'preview' {
  const server = process.env.E2E_SERVER || 'dev';
  if (server !== 'dev' && server !== 'preview') {
    throw new Error(`E2E_SERVER must be "dev" or "preview", got "${server}"`);
  }
  return server;
}

/**
 * Where `preview` builds: inside `dist`, so git and ESLint already ignore it, but beside the
 * deploy build's `dist/assets`, so a local run never swaps the build `pnpm size` weighs for one
 * made with E2E's flags.
 */
const PREVIEW_OUT_DIR = 'dist/e2e';

const port = resolvePort();
const origin = `http://localhost:${port}`;
const server = resolveServer();

/**
 * --strictPort: if the port was taken after it was picked, fail loudly instead of drifting to the
 * next one while Playwright waits on this URL. `vite preview` takes --port in CI too, since its
 * own default is 4173.
 */
function webServerCommand(): string {
  if (server === 'preview') {
    const outDir = `--outDir ${PREVIEW_OUT_DIR}`;
    return `npx vite build ${outDir} && npx vite preview ${outDir} --port ${port} --strictPort`;
  }
  return process.env.CI ? 'npx vite' : `npx vite --port ${port} --strictPort`;
}

export default defineConfig({
  testDir: './e2e',
  // Opens the first spec's pages on the fresh dev server before any test starts, so the app shell
  // and those pages compile outside the first wave's timeouts (#664). A production build has
  // nothing left to compile.
  globalSetup: server === 'dev' ? './e2e/global-setup.ts' : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: resolveWorkers(),
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  use: {
    baseURL: origin,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The production build registers a service worker (main.tsx). Left to run, it would precache
    // the app in every test's fresh context and answer requests that page.route() never sees.
    // The dev server registers none.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'firefox',
      use: {...devices['Desktop Firefox']},
    },
    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
    },
    {
      name: 'mobile-chrome',
      use: {...devices['Pixel 5']},
    },
    {
      name: 'mobile-safari',
      use: {...devices['iPhone 14']},
    },
  ],
  webServer: {
    command: webServerCommand(),
    url: origin,
    // Never attach to a server this run did not start (CI never did).
    reuseExistingServer: false,
    // Local runs print Vite's own output (its banner, synergy regeneration, dependency
    // re-optimization). Playwright stops watching the server once it is up, so without this a
    // server that dies mid-run leaves nothing behind but connection errors. stderr is piped by
    // default.
    stdout: process.env.CI ? 'ignore' : 'pipe',
    // Startup can include ensureSynergiesPlugin's engine rebuild and precompute (28 s measured),
    // and the first `GET /` on a cold server took 17 to 19 s; both run slower while other
    // sessions load this machine (#664). On `preview` it includes the build instead (26 s in a
    // 4-vCPU container).
    timeout: 240000,
    env: {
      // Exercise the accounts surface in E2E; production default stays off via .env.example.
      VITE_SHOW_ACCOUNTS: 'true',
      // Exercise collection mode (#553 Phase C). It requires the accounts flag above
      // (the Collection button asks a signed-out visitor to sign in), so both are on.
      VITE_SHOW_COLLECTION: 'true',
      // Exercise the Friends section on /account (#852). It requires the accounts flag too.
      // e2e/fixtures/supabaseStub.ts answers its claim_friend_code call.
      VITE_SHOW_FRIENDS: 'true',
      // Placeholder Supabase config, so `enabled` is true and the auth control RENDERS.
      // Two reasons this is pinned rather than inherited:
      //   1. CI supplies no Supabase env, so `isSupabaseConfigured()` is false, `enabled` is
      //      false and AuthButton renders nothing. Without this the 5-browser matrix
      //      exercises none of the auth surface, and axe never scans it.
      //   2. Process env beats .env files, so a developer's real credentials in
      //      .env.local cannot change what E2E sees. Same state everywhere.
      // Auth itself reaches no network: with no stored session and no code in the URL,
      // getSession() resolves locally. Signing IN is not covered here and cannot be,
      // since it needs a real provider round-trip.
      // Being configured DOES switch on the other Supabase paths (voting), whose REST
      // calls would hit a host that does not resolve — `e2e/fixtures/supabaseStub.ts`
      // answers them in the browser. Keep the origin below in step with that module.
      VITE_SUPABASE_URL: E2E_SUPABASE_ORIGIN,
      VITE_SUPABASE_ANON_KEY: E2E_SUPABASE_ANON_KEY,
      // Exercise the reveal-season active code paths in E2E.
      VITE_IS_REVEAL_SEASON: 'true',
      // Show Strategy Tips block so the `playstyle-detail.spec.ts` toggle test has
      // a rendered button to interact with. Production default stays off via .env.example.
      VITE_SHOW_STRATEGY_TIPS: 'true',
      // Suppress the beta notice in E2E so existing home-page tests don't see an
      // unexpected floating card. If a future test covers the notice itself, flip
      // to 'true' and clear localStorage in beforeEach.
      VITE_SHOW_BETA_NOTICE: 'false',
      // A production build (`preview`) starts Sentry and PostHog when it has their keys
      // (shared/lib/sentry.ts, posthog.ts), and with SENTRY_AUTH_TOKEN vite.config.ts uploads its
      // source maps, then deletes dist/**/*.map, the deploy build's included. Blank all three, so
      // neither a developer's .env.local nor their shell can send a run's errors, events or maps
      // to the real projects. CI sets none of them.
      VITE_SENTRY_DSN: '',
      VITE_POSTHOG_KEY: '',
      SENTRY_AUTH_TOKEN: '',
    },
  },
});
