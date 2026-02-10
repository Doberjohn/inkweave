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

  test('should show filter bottom sheet on mobile', async ({page}) => {
    // Click filter button on hero
    const filterButton = page.getByRole('button', {name: /Filters/});
    await filterButton.click();

    // Filter drawer should show ink options
    await expect(page.getByRole('button', {name: 'Amber', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sapphire', exact: true})).toBeVisible();
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
});
