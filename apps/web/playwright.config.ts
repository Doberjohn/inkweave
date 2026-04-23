import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
    },
  },
});
