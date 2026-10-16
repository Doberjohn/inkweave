import {test, expect} from '../fixtures';

test.describe('Card Search and Filtering', () => {
  // Desktop-only: tests hero search and browse page routing
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
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

  test('should toggle the docked filters panel on browse page', async ({page}) => {
    // Navigate to browse page via "Browse all cards" CTA
    await page.getByTestId('cta-browse').click();
    await expect(page).toHaveURL(/\/browse/);

    // On desktop the filters are a panel docked beside the cards, open by default (owner,
    // 2026-10-07), and the Filters button closes and reopens it; the dialog is for narrower
    // screens. Ink Cost is one of the sections the panel opens unfolded.
    const panel = page.getByRole('complementary', {name: 'Filters'});
    await expect(panel.getByRole('button', {name: 'Cost 1'})).toBeVisible();

    const filtersButton = page.getByRole('button', {name: /Filters/});
    await filtersButton.click();
    await expect(panel).toHaveCount(0);

    await filtersButton.click();
    await expect(panel.getByRole('button', {name: 'Cost 1'})).toBeVisible();
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

  test('should filter a playstyle page in place without navigating to browse', async ({page}) => {
    await page.goto('/playstyles/ramp');

    // The search now lives in the toolbar on the playstyle page too
    const search = page.getByPlaceholder('Search cards...');
    await expect(search).toBeVisible({timeout: 10000});

    await search.fill('elsa');

    // Filtering happens in place: stays on the playstyle page (no jump to /browse)
    // and the query syncs to the URL.
    await expect(page).toHaveURL(/\/playstyles\/ramp/);
    await expect(page).toHaveURL(/q=elsa/);
  });
});
