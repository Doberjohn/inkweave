import {test, expect} from '../fixtures';

test.describe('Playstyle Detail — Desktop', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
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

    // Discard playstyle exposes Standard/Targeted/Random/Payoff role tiles.
    // Standard is the broadest enabler role — its tile is reliably present.
    const standardChip = page.getByRole('button', {name: /Standard/});
    await expect(standardChip).toBeVisible();

    // Click to apply the filter — card grid should narrow to Standard-only enablers.
    await standardChip.click();
    await page.waitForTimeout(200);

    const filteredCount = await cardTiles.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // Click the same chip again to toggle it off — grid restores to full set.
    await standardChip.click();
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

  test('should open the card overview modal from playstyle detail', async ({page}) => {
    // Wait for card tiles to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Click a card tile → opens the global modal (URL stays on the playstyle page).
    await cardTiles.first().click();
    // Modal open = React mount + per-card synergy fetch + visibility transition; slow CI
    // webkit can exceed 5s before the overlay-visible class settles. Match the 15s used above.
    await expect(page.getByTestId('card-overview-modal')).toBeVisible({timeout: 15000});
  });
});
