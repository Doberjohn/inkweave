import {test, expect} from '../fixtures';

// A published week never changes, so the spec reads the week of September 28, 2026 by name: it
// stays true as later weeks are added above it.
const WEEK = 'September 28 to October 4, 2026';

test.describe('Release notes page', () => {
  test('shows a week with its sections in order', async ({page}) => {
    await page.goto('/release-notes');

    await expect(page.getByRole('heading', {level: 1, name: 'Release notes'})).toBeVisible();
    const week = page.getByRole('region', {name: WEEK});
    await expect(week.getByRole('heading', {level: 3})).toHaveText([
      'New',
      'Improved',
      'Fixed',
      'Synergy engine',
    ]);
  });

  test('the footer links to it', async ({page}) => {
    await page.goto('/about');

    await page
      .locator('footer[aria-label="Site footer"]')
      .getByRole('link', {name: 'Release notes'})
      .click();

    await expect(page).toHaveURL('/release-notes');
    await expect(page.getByRole('heading', {level: 1, name: 'Release notes'})).toBeVisible();
  });

  // Runs on every project at a forced phone width, like card-detail's mobile layout tests.
  test('does not scroll sideways on a phone', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('/release-notes');
    await expect(page.getByRole('region', {name: WEEK})).toBeVisible();

    // documentElement.clientWidth, not window.innerWidth: mobile emulation zooms out to fit an
    // overflowing page, which inflates innerWidth to the overflowed width.
    const layout = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(layout.scroll).toBeLessThanOrEqual(layout.client);
  });
});
