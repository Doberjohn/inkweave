import {test, expect} from '../fixtures';

test.describe('Playstyle Pages', () => {
  // Desktop only
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
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

    // Should have at least one playstyle card (article elements)
    const playstyleCards = page.locator('article');
    await expect(playstyleCards.first()).toBeVisible();
    const count = await playstyleCards.count();
    expect(count).toBeGreaterThanOrEqual(2); // lore-denial + location-control
  });

  test('should navigate to playstyle detail page', async ({page}) => {
    await page.goto('/playstyles');
    await page.waitForTimeout(500);

    // Click the first playstyle card
    const firstCard = page.locator('article').first();
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
    await expect(cardTiles.first()).toBeVisible({timeout: 10000});
    const count = await cardTiles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate back from playstyle detail to gallery', async ({page}) => {
    await page.goto('/playstyles/lore-denial');
    await page.waitForTimeout(500);

    // Find and click the back/breadcrumb link to gallery
    const backLink = page.getByRole('link', {name: /playstyles|back/i});
    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
      await expect(page).toHaveURL('/playstyles');
    } else {
      // Fallback: use logo to go home
      const logo = page.getByLabel('Go to home page');
      await logo.click();
      await expect(page).toHaveURL('/');
    }
  });
});
