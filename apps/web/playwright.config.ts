import {execFileSync} from 'node:child_process';
import {defineConfig, devices} from '@playwright/test';

// Local E2E servers live here, clear of the dev-server ports (5173 and up), Storybook, the
// react-grab relay and Chrome's blocked ports. Not the OS's own free-port pick: this machine's
// dynamic range starts at 1024, so that could land on any of them.
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

const port = resolvePort();
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  use: {
    baseURL: origin,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
    // --strictPort: if the port was taken after it was picked, fail loudly instead of drifting
    // to the next one while Playwright waits on this URL.
    command: process.env.CI ? 'npx vite' : `npx vite --port ${port} --strictPort`,
    url: origin,
    // Never attach to a server this run did not start (CI never did).
    reuseExistingServer: false,
    // Local runs print Vite's own output (its banner, synergy regeneration, dependency
    // re-optimization). Playwright stops watching the server once it is up, so without this a
    // server that dies mid-run leaves nothing behind but connection errors. stderr is piped by
    // default.
    stdout: process.env.CI ? 'ignore' : 'pipe',
    timeout: 120000,
    env: {
      // Exercise the reveal-season active code paths in E2E.
      VITE_IS_REVEAL_SEASON: 'true',
      // Show Strategy Tips block so the `playstyle-detail.spec.ts` toggle test has
      // a rendered button to interact with. Production default stays off via .env.example.
      VITE_SHOW_STRATEGY_TIPS: 'true',
      // Suppress the beta notice in E2E so existing home-page tests don't see an
      // unexpected floating card. If a future test covers the notice itself, flip
      // to 'true' and clear localStorage in beforeEach.
      VITE_SHOW_BETA_NOTICE: 'false',
      // Render the flag-gated /admin/analytics route in E2E (production default
      // stays off via .env.example). The spec still skips gracefully if the
      // vote-analytics artifact was not generated in the environment.
      VITE_SHOW_ADMIN_ANALYTICS: 'true',
    },
  },
});
