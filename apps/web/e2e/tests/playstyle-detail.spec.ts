import {test, expect} from '../fixtures';
import {slidePointerOnto} from '../helpers/pointer';

test.describe('Playstyle Detail — Desktop', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto('/playstyles/discard');
    await page.waitForTimeout(500);
  });

  test('should render hero with name and breadcrumb', async ({page}) => {
    // Page heading (h1) with playstyle name
    const heading = page.getByRole('heading', {level: 1});
    await expect(heading).toBeVisible({timeout: 10000});
    await expect(heading).toContainText('Discard');

    // Breadcrumb nav with "Playstyles" link (exclude the main nav header)
    const breadcrumb = page.locator('section nav').filter({hasText: 'Playstyles'});
    await expect(breadcrumb).toBeVisible();
    const playstyleLink = breadcrumb.getByRole('link', {name: 'Playstyles'});
    await expect(playstyleLink).toBeVisible();
  });

  test('should show and use role filter chips', async ({page}) => {
    // Wait for cards to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Get initial card count
    const initialCount = await cardTiles.count();
    expect(initialCount).toBeGreaterThan(0);

    // Discard exposes Forced/Targeted/Random Discard + Payoff mechanic tiles.
    // "Forced Discard" is the broadest enabler — its tile is reliably present.
    // (Labels come from the shared mechanics catalog; "standard" → "Forced Discard".)
    const forcedDiscardChip = page.getByRole('button', {name: /Forced Discard/});
    await expect(forcedDiscardChip).toBeVisible();

    // Click to apply the filter — card grid should narrow to forced-discard enablers.
    await forcedDiscardChip.click();
    await page.waitForTimeout(200);

    const filteredCount = await cardTiles.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // Click the same chip again to toggle it off — grid restores to full set.
    await forcedDiscardChip.click();
    await page.waitForTimeout(200);

    const resetCount = await cardTiles.count();
    expect(resetCount).toBe(initialCount);
  });

  test('should render card tiles in grid', async ({page}) => {
    // Let discard's tiles render before leaving the page. Leaving while its playstyle data is
    // still loading aborts that fetch, and WebKit logs the abort as "TypeError: Load failed",
    // which fails the console guard (#854).
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});

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

  test('keeps a tile tooltip under the pointer, ignores clicks on it, and hides on Escape', async ({
    page,
  }) => {
    const tile = page.getByRole('button', {name: /Forced Discard/});
    await expect(tile).toBeVisible({timeout: 10000});
    const tooltip = page.getByRole('tooltip');

    // The pointer can cross from the tile onto its tooltip and stay there (WCAG 1.4.13, #836).
    await tile.hover();
    await expect(tooltip).toBeVisible();
    await slidePointerOnto(page, tooltip);
    await page.waitForTimeout(300); // past the tooltip's 150 ms close delay
    await expect(tooltip).toBeVisible();

    // The tooltip renders beside the tile's button, so a click on it doesn't toggle the filter.
    await tooltip.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
  });
});
