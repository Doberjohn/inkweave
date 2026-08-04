import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI runs SERIAL with 2 retries; local runs fully parallel across every core with
  // none, which made the pre-push gate strictly harsher than the merge gate. A spec
  // that is merely slow lost locally while passing CI comfortably: card-detail.spec
  // failed two consecutive pushes with different tests each time, and passed every
  // time in isolation. CardOverviewModal alone exceeds the 16ms frame budget by 4x
  // (see its RenderProfiler warnings), so under N workers its title and visibility
  // waits time out. One local retry matches CI's existing tolerance for slow-but-
  // correct without hiding real breakage: a genuinely broken test fails both tries.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  use: {
    baseURL: 'http://localhost:5173',
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
    command: 'npx vite',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
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
