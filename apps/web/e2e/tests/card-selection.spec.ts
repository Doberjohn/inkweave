import {test, expect} from '../fixtures';

test.describe('Card Selection and Synergies', () => {
  // Skip on mobile - synergy panel requires navigation
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
  });

  test('should show home state at root URL', async ({appPage, page}) => {
    await expect(appPage.heroSection).toBeVisible();
    await expect(appPage.featuredCards).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('should display card detail panel when card is selected', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Should navigate to /card/:id
    await expect(page).toHaveURL(/\/card\/\d+/);

    // Card detail panel should be visible
    const detailPanel = page.getByTestId('card-detail-panel');
    await expect(detailPanel).toBeVisible();

    // Compact header should be visible
    const compactHeader = page.getByTestId('compact-header');
    await expect(compactHeader).toBeVisible();
  });

  test('should show synergy results area when card is selected', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Synergies are fetched async — wait for header, empty state, or error banner
    const hasSynergies = page.getByTestId('synergy-header');
    const noSynergies = page.getByText('No synergies found for this card');
    const errorBanner = page.getByRole('alert');

    await expect(hasSynergies.or(noSynergies).or(errorBanner)).toBeVisible({timeout: 10000});
  });

  test('should clear selection and return to home', async ({appPage, synergyResultsPage, page}) => {
    await appPage.selectFeaturedCard();

    // Clear selection via back button
    await synergyResultsPage.clearSelection();

    // Should return to home
    await expect(appPage.heroSection).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('should return to home when clicking logo', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Click the logo in compact header
    const logoButton = page.getByLabel('Go to home page');
    await logoButton.click();
    await page.waitForTimeout(100);

    // Should return to home state with correct URL
    await expect(appPage.heroSection).toBeVisible();
    await expect(page).toHaveURL('/');
  });
});
