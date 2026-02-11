import {test, expect} from '../fixtures';

test.describe('Card Search and Filtering', () => {
  // Desktop-only: tests hero search on home page
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
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

  test('should stay on home when typing without pressing Enter', async ({appPage}) => {
    // Type in the hero search without pressing Enter
    await appPage.heroSearch.fill('Elsa');

    // Should remain on home — hero and featured cards still visible
    await expect(appPage.heroSection).toBeVisible();
    await expect(appPage.featuredCards).toBeVisible();
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

  test('should navigate to browsing view via See all cards', async ({appPage, page}) => {
    // Click "See all cards" button
    await page.getByRole('button', {name: /See all cards/}).click();
    await page.waitForTimeout(200);

    // Should transition to browsing — hero gone, CardList visible
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });
});
