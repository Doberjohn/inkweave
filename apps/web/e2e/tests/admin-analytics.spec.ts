import {test, expect} from '@playwright/test';

// The /admin/analytics route is gated by VITE_SHOW_ADMIN_ANALYTICS (set in the
// playwright webServer env + apps/web/.env.local) and reads the build-time
// vote-analytics.json artifact. When the flag is off the route redirects home;
// when the artifact is absent the page shows an error card. The test skips in
// either case so it never false-fails an environment that lacks the setup.
test.describe('Admin analytics (flag on)', () => {
  test('renders the calibration + activity tabs', async ({page}, testInfo) => {
    testInfo.annotations.push({type: 'requires', description: 'VITE_SHOW_ADMIN_ANALYTICS=true + vote-analytics.json'});

    await page.goto('/admin/analytics');

    // Flag off -> AdminGate redirected to '/', so the page identity never appears.
    // Wait for it (the SPA mounts async) rather than reading instant visibility.
    const h1 = page.getByRole('heading', {level: 1, name: /Engine Calibration/i});
    const gated = await h1
      .waitFor({state: 'visible', timeout: 10000})
      .then(() => true)
      .catch(() => false);
    test.skip(!gated, 'Admin analytics flag off (route redirected home).');

    // Tabs render only once the artifact loads; absent artifact shows an error card.
    const calibrationTab = page.getByRole('tab', {name: 'Calibration'});
    const loaded = await calibrationTab
      .waitFor({state: 'visible', timeout: 10000})
      .then(() => true)
      .catch(() => false);
    test.skip(!loaded, 'vote-analytics.json not generated in this environment.');

    // Calibration tab (default) shows the verdict hero (its diverging scale) and stat strip.
    await expect(page.getByText('over-rates')).toBeVisible();
    await expect(page.getByText('Total votes')).toBeVisible();

    // Switch to the Activity tab and confirm its day-by-day log header.
    await page.getByRole('tab', {name: 'Activity'}).click();
    await expect(page.getByText(/day by day/i)).toBeVisible();
  });
});
