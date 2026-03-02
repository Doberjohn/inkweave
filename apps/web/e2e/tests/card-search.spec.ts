import {test, expect} from '../fixtures';

test.describe('Card Search and Filtering', () => {
  // Desktop-only: tests hero search and browse page routing
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
  });

  test('should navigate to browse when searching from hero', async ({appPage, page}) => {
    // Type in the hero search and press Enter to navigate
    await appPage.heroSearch.fill('Elsa');
    await appPage.heroSearch.press('Enter');

    // Should navigate to /browse with query param
    await expect(page).toHaveURL(/\/browse\?q=Elsa/);

    // Hero and featured cards should be gone
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(appPage.featuredCards).not.toBeVisible();

    // CardList should be visible with search results
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should open filter modal on browse page', async ({page}) => {
    // Navigate to browse page via "Browse all cards" CTA
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Should be on /browse
    await expect(page).toHaveURL(/\/browse/);

    // Click the Filters button to open the filter modal
    await page.getByRole('button', {name: /Filters/}).click();
    await page.waitForTimeout(200);

    // Filter modal should be visible with ink options
    await expect(page.getByTestId('filter-modal')).toBeVisible();
    await expect(page.getByRole('button', {name: 'Filter by Amber'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Filter by Sapphire'})).toBeVisible();
  });

  test('should deep link to browse with ink filter in URL', async ({page}) => {
    // Navigate directly to browse with ink filter
    await page.goto('/browse?ink=Sapphire');
    await page.waitForTimeout(500);

    // URL should have ink filter
    await expect(page).toHaveURL(/ink=Sapphire/);

    // Should show card list (not hero)
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should navigate to browse via Browse all cards CTA', async ({appPage, page}) => {
    // Click "Browse all cards" CTA button
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Should navigate to /browse
    await expect(page).toHaveURL(/\/browse/);

    // Hero should be gone, CardList visible
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should preserve search query in URL on browse page', async ({page, appPage}) => {
    // Search from hero and submit
    await appPage.heroSearch.fill('Ariel');
    await appPage.heroSearch.press('Enter');

    // URL should contain the search query
    await expect(page).toHaveURL(/q=Ariel/);

    // Browse page search input should have the query
    await expect(page.getByPlaceholder('Search cards...')).toHaveValue('Ariel');
  });

  test('should deep link to browse with filters', async ({page}) => {
    // Navigate directly to browse with query params
    await page.goto('/browse?q=Elsa&ink=Sapphire');
    await page.waitForTimeout(500);

    // Search input should have the query
    await expect(page.getByPlaceholder('Search cards...')).toHaveValue('Elsa');
  });
});
