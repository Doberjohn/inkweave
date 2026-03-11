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

    // Synergies are fetched async — wait for synergies heading, empty state, or error banner
    const hasSynergies = page.getByRole('heading', {name: 'Synergies'});
    const noSynergies = page.getByText('No synergies found for this card');
    const errorBanner = page.getByRole('alert');

    await expect(hasSynergies.or(noSynergies).or(errorBanner)).toBeVisible({timeout: 10000});
  });

  test('should show filter drawer on mobile browse', async ({page}) => {
    // Navigate to browse page first
    await page.goto('/browse');
    await page.waitForTimeout(500);

    // Click filter button in CardList
    const filterButton = page.getByRole('button', {name: /Filters/});
    await filterButton.click();

    // Filter drawer should show ink options
    await expect(page.getByRole('button', {name: 'Filter by Amber'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Filter by Sapphire'})).toBeVisible();
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

  test('should navigate to browse when searching from hero', async ({appPage, page}) => {
    // Type in hero search and press Enter to navigate
    await appPage.heroSearch.fill('Elsa');
    await appPage.heroSearch.press('Enter');

    // Should navigate to browse with query param
    await expect(page).toHaveURL(/\/browse\?q=Elsa/);

    // Hero should be gone, browse heading visible
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(page.getByRole('heading', {name: 'Browse Cards'})).toBeVisible();
  });

  test('should navigate to browsing view via Browse all cards CTA', async ({page, appPage}) => {
    // Click "Browse all cards" CTA button
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Should transition to browsing — hero gone, browse heading visible
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(page.getByRole('heading', {name: 'Browse Cards'})).toBeVisible();
  });

  test('should open filter drawer in mobile browsing view', async ({page}) => {
    // Navigate to browsing view via Browse CTA
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Click filter button in mobile browsing header
    const filterButton = page.getByRole('button', {name: /Filters/});
    await filterButton.click();
    await page.waitForTimeout(200);

    // Filter drawer should be visible
    await expect(page.getByRole('dialog', {name: 'Filters'})).toBeVisible();

    // Should show ink filter options
    await expect(page.getByRole('button', {name: 'Filter by Amber'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Filter by Sapphire'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Filter by Steel'})).toBeVisible();
  });
});
