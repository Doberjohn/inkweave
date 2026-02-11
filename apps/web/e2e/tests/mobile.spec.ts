import {test, expect} from '../fixtures';

test.describe('Mobile Viewport', () => {
  // This test file should only run on mobile-chrome project
  test.beforeEach(async ({page, appPage}, testInfo) => {
    // Skip on non-mobile projects
    if (testInfo.project.name !== 'mobile-chrome') {
      test.skip();
    }

    await page.goto('/');
    await appPage.waitForCardsLoaded();
  });

  test('should display hero home page on mobile', async ({appPage}) => {
    // Mobile now shows hero home just like desktop
    await expect(appPage.heroSection).toBeVisible();
    await expect(appPage.heroSearch).toBeVisible();
    await expect(appPage.featuredCards).toBeVisible();
  });

  test('should show search input on home', async ({page}) => {
    // Search input should be visible on home hero
    await expect(page.getByPlaceholder('Search for a card...')).toBeVisible();
  });

  test('should navigate to synergies when selecting a featured card', async ({appPage, page}) => {
    // Click a featured card
    await appPage.selectFeaturedCard();

    // Should show synergy results (card detail + synergies)
    const hasSynergies = page.getByText(/Found \d+ synergistic cards/);
    const noSynergies = page.getByText('No synergies found for this card');

    const synergiesVisible = await hasSynergies.isVisible().catch(() => false);
    const noSynergiesVisible = await noSynergies.isVisible().catch(() => false);

    expect(synergiesVisible || noSynergiesVisible).toBe(true);
  });

  test('should return to home when clearing selection on mobile', async ({
    appPage,
    synergyResultsPage,
  }) => {
    // Select a card
    await appPage.selectFeaturedCard();

    // Clear selection
    await synergyResultsPage.clearSelection();

    // Should return to home state with hero
    await expect(appPage.heroSection).toBeVisible();
  });

  test('should transition to browsing view when pressing Enter in hero search', async ({appPage, page}) => {
    // Type in the hero search and press Enter to navigate
    await appPage.heroSearch.fill('Elsa');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Should transition away from home — hero and featured cards disappear
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(appPage.featuredCards).not.toBeVisible();

    // CardList sidebar should be visible with search results
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should transition to browsing view when clicking Search button', async ({appPage, page}) => {
    // Type in the hero search
    await appPage.heroSearch.fill('Elsa');

    // Click the Search button
    await page.getByRole('button', {name: 'Search'}).click();
    await page.waitForTimeout(200);

    // Should transition to browsing
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });
});
