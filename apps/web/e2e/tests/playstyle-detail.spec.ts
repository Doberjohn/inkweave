import {test, expect} from '../fixtures';

test.describe('Playstyle Detail — Desktop', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') test.skip();
    await page.goto('/playstyles/discard');
    await page.waitForTimeout(500);
  });

  test('should render hero with name, description, and breadcrumb', async ({page}) => {
    // Page heading (h1) with playstyle name
    const heading = page.getByRole('heading', {level: 1});
    await expect(heading).toBeVisible({timeout: 10000});
    await expect(heading).toContainText('Discard');

    // Description paragraph should be visible
    const description = page.getByText(/discard cards/i).first();
    await expect(description).toBeVisible();

    // Breadcrumb nav with "Playstyles" link (exclude the main nav header)
    const breadcrumb = page.locator('section nav').filter({hasText: 'Playstyles'});
    await expect(breadcrumb).toBeVisible();
    const playstyleLink = breadcrumb.getByRole('link', {name: 'Playstyles'});
    await expect(playstyleLink).toBeVisible();
  });

  test('should toggle strategy tips section', async ({page}) => {
    // Strategy Tips toggle button
    const tipsButton = page.getByRole('button', {name: /Strategy Tips/});
    await expect(tipsButton).toBeVisible({timeout: 10000});

    // Click to open tips
    await tipsButton.click();
    await page.waitForTimeout(200);

    // After clicking, tips list should be visible (contains <li> elements)
    const visibleTips = page.locator('section ul li');
    await expect(visibleTips.first()).toBeVisible({timeout: 3000});

    // Click again to close
    await tipsButton.click();
    await page.waitForTimeout(200);

    // Tips should be hidden
    await expect(visibleTips.first()).not.toBeVisible();
  });

  test('should show and use role filter chips', async ({page}) => {
    // Wait for cards to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Get initial card count
    const initialCount = await cardTiles.count();
    expect(initialCount).toBeGreaterThan(0);

    // Discard has "Enabler" and "Payoff" role chips + "All" chip
    const enablerChip = page.getByRole('button', {name: /Enabler/});
    await expect(enablerChip).toBeVisible();

    // Click "Enabler" to filter
    await enablerChip.click();
    await page.waitForTimeout(200);

    // Card count should change (enablers are a subset of all discard cards)
    const filteredCount = await cardTiles.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // Click "All" to reset (chip includes count badge, e.g. "All 36")
    const allChip = page.getByRole('button', {name: /^All/});
    await allChip.click();
    await page.waitForTimeout(200);

    const resetCount = await cardTiles.count();
    expect(resetCount).toBe(initialCount);
  });

  test('should render card tiles in grid', async ({page}) => {
    // Navigate to a different playstyle (location-control)
    await page.goto('/playstyles/location-control');
    await page.waitForTimeout(500);

    // Card tiles should render
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    const count = await cardTiles.count();
    expect(count).toBeGreaterThan(5);
  });

  test('should navigate to card page from playstyle detail', async ({page}) => {
    // Wait for card tiles to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Click a card tile
    await cardTiles.first().click();

    // Should navigate to a card detail page
    await expect(page).toHaveURL(/\/card\/\d+/);
  });
});
