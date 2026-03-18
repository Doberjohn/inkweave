import {test, expect} from '../fixtures';

// Anna - Diplomatic Queen: discard group has 34 cards (truncated on both viewports)
const CARD_URL = '/card/1041';

test.describe('Synergy Expanded View — Desktop', () => {
  test.beforeEach(async ({page, synergyResultsPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') test.skip();
    await page.goto(CARD_URL);
    await synergyResultsPage.waitForSynergiesLoaded();
  });

  test('should show toolbar in expanded view', async ({page, synergyResultsPage}) => {
    // Click "+N more" on the discard group to expand
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    // Expanded view should render
    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // Sort select should be present in the expanded view
    const sortSelect = page.getByLabel('Sort synergies');
    await expect(sortSelect).toBeVisible();
  });

  test('should show all cards without truncation in expanded view', async ({
    page,
    synergyResultsPage,
  }) => {
    // Expand the discard group
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await moreTile.click();

    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // All 34 cards should be visible (no truncation, no more tile)
    const tiles = expandedView.locator('button.card-tile');
    const count = await tiles.count();
    expect(count).toBe(34);

    // No more tile in expanded view
    const expandedMoreTile = expandedView.locator('[data-testid="more-tile"]');
    await expect(expandedMoreTile).toHaveCount(0);
  });

  test('should navigate back from expanded view', async ({page, synergyResultsPage}) => {
    // Expand the discard group
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await moreTile.click();

    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // Click "Back to all synergies"
    const backButton = page.getByRole('button', {name: /Back to all synergies/});
    await expect(backButton).toBeInViewport({timeout: 3000});
    await backButton.click();

    // Expanded view should be gone, both groups visible again
    await expect(expandedView).not.toBeVisible();
    await expect(synergyResultsPage.getSynergyGroupByKey('shift-targets')).toBeVisible();
    await expect(synergyResultsPage.getSynergyGroupByKey('discard')).toBeVisible();
  });
});

test.describe('Synergy Expanded View — Mobile', () => {
  test.beforeEach(async ({page, synergyResultsPage}, testInfo) => {
    if (testInfo.project.name !== 'mobile-chrome') test.skip();
    await page.goto(CARD_URL);
    await synergyResultsPage.waitForSynergiesLoaded();
  });

  test('should expand playstyle group on mobile', async ({page, synergyResultsPage}) => {
    // Discard group should be truncated on mobile (5 cards shown)
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    // Expanded view should render
    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // All 34 cards should be shown
    const tiles = expandedView.locator('button.card-tile');
    const count = await tiles.count();
    expect(count).toBe(34);
  });
});
