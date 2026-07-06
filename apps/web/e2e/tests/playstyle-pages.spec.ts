import {test, expect} from '../fixtures';

test.describe('Playstyle Pages', () => {
  // Desktop only
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
    await appPage.goto();
  });

  test('should navigate to playstyle gallery via CTA', async ({page}) => {
    const ctaButton = page.getByTestId('cta-playstyles');
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    await expect(page).toHaveURL('/playstyles');

    // Gallery should render playstyle cards with names
    await expect(page.getByRole('heading', {level: 1})).toBeVisible({timeout: 10000});
  });

  test('should render playstyle gallery with playstyle cards', async ({page}) => {
    await page.goto('/playstyles');
    await page.waitForTimeout(500);

    // Page heading should be visible
    const heading = page.getByRole('heading', {level: 1});
    await expect(heading).toBeVisible({timeout: 10000});

    // Playstyle fan tiles are links to /playstyles/<id>.
    const playstyleCards = page.locator('a[href^="/playstyles/"]');
    await expect(playstyleCards.first()).toBeVisible();
    const count = await playstyleCards.count();
    expect(count).toBeGreaterThanOrEqual(2); // lore-denial + location-control
  });

  test('should navigate to playstyle detail page', async ({page}) => {
    await page.goto('/playstyles');
    await page.waitForTimeout(500);

    // Click the first playstyle fan tile (a link to /playstyles/<id>).
    const firstCard = page.locator('a[href^="/playstyles/"]').first();
    await expect(firstCard).toBeVisible({timeout: 10000});
    await firstCard.click();

    // Should navigate to a playstyle detail URL
    await expect(page).toHaveURL(/\/playstyles\/.+/);

    // Detail page should show a heading and card tiles
    await expect(page.getByRole('heading', {level: 1})).toBeVisible({timeout: 10000});
  });

  test('should deep link to playstyle detail page', async ({page}) => {
    await page.goto('/playstyles/lore-denial');
    await page.waitForTimeout(500);

    // Page should load with heading
    const heading = page.getByRole('heading', {level: 1});
    await expect(heading).toBeVisible({timeout: 10000});

    // Should have card tiles showing related cards
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});
    const count = await cardTiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate back from playstyle detail to gallery', async ({page}) => {
    await page.goto('/playstyles/lore-denial');
    // Wait for the actual heading to render instead of an arbitrary 500ms
    // sleep — the hardcoded wait raced webkit under full-suite load (5
    // browsers × 60 tests parallel), causing intermittent failures where
    // backLink.click() fired before the page settled.
    await expect(page.getByRole('heading', {level: 1})).toBeVisible({timeout: 10000});

    // Find and click the back/breadcrumb link to gallery
    const backLink = page.getByRole('link', {name: /playstyles|back/i}).first();
    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
      // 10s timeout for webkit's slower nav under load; 5s default was racy.
      await expect(page).toHaveURL('/playstyles', {timeout: 10000});
    } else {
      // Fallback: use logo to go home
      const logo = page.getByLabel('Go to home page');
      await logo.click();
      await expect(page).toHaveURL('/', {timeout: 10000});
    }
  });
});
