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

  test('should navigate to card page when selecting a featured card', async ({appPage, page}) => {
    // Click a featured card
    await appPage.selectFeaturedCard();

    // Should navigate to /card/:id
    await expect(page).toHaveURL(/\/card\/\d+/);

    // Should show synergy results (card detail + synergies)
    const hasSynergies = page.getByText(/Found \d+ synergistic cards/);
    const noSynergies = page.getByText('No synergies found for this card');

    const synergiesVisible = await hasSynergies.isVisible().catch(() => false);
    const noSynergiesVisible = await noSynergies.isVisible().catch(() => false);

    expect(synergiesVisible || noSynergiesVisible).toBe(true);
  });

  test('should show filter drawer on mobile browse', async ({page}) => {
    // Navigate to browse page first
    await page.goto('/browse');
    await page.waitForTimeout(500);

    // Click filter button in CardList
    const filterButton = page.getByRole('button', {name: /Filters/});
    await filterButton.click();

    // Filter drawer should show ink options
    await expect(page.getByRole('button', {name: 'Amber', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sapphire', exact: true})).toBeVisible();
  });

  test('should return to home when clearing selection on mobile', async ({
    appPage,
    synergyResultsPage,
    page,
  }) => {
    // Select a card
    await appPage.selectFeaturedCard();

    // Clear selection
    await synergyResultsPage.clearSelection();

    // Should return to home state with hero
    await expect(appPage.heroSection).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('should navigate to browse when typing in hero search', async ({appPage, page}) => {
    // Typing in hero search navigates to /browse immediately (React Router)
    await appPage.heroSearch.fill('Elsa');
    await page.waitForTimeout(300);

    // Should navigate to browse with query param
    await expect(page).toHaveURL(/\/browse\?q=Elsa/);

    // Hero should be gone, card list visible
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should navigate to browsing view via See all cards button', async ({page, appPage}) => {
    // Click "See all cards" button
    await page.getByRole('button', {name: /See all cards/}).click();
    await page.waitForTimeout(200);

    // Should transition to browsing — hero gone, search visible
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should open filter drawer in mobile browsing view', async ({page}) => {
    // Navigate to browsing view
    await page.getByRole('button', {name: /See all cards/}).click();
    await page.waitForTimeout(200);

    // Click filter button in mobile browsing header
    const filterButton = page.getByRole('button', {name: /Filters/});
    await filterButton.click();
    await page.waitForTimeout(200);

    // Filter drawer should be visible with title
    await expect(page.getByText('Filters', {exact: true})).toBeVisible();
    
    // Should show ink filter options
    await expect(page.getByRole('button', {name: 'Amber', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sapphire', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Steel', exact: true})).toBeVisible();
  });
});
