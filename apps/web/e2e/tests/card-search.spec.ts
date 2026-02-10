import {test, expect} from '../fixtures';

test.describe('Card Search and Filtering', () => {
  // Desktop-only: tests hero search and FilterModal on home page
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
  });

  test('should transition to browsing view when searching from hero', async ({appPage, page}) => {
    // Type in the hero search
    await appPage.heroSearch.fill('Elsa');
    await page.waitForTimeout(200);

    // Should transition away from home — hero and featured cards disappear
    await expect(appPage.heroSection).not.toBeVisible();
    await expect(appPage.featuredCards).not.toBeVisible();

    // CardList sidebar should be visible with search results
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should open filter modal when clicking Filters button', async ({page}) => {
    // Click the Filters button on hero
    await page.getByRole('button', {name: /Filters/}).click();

    // FilterModal should appear
    const modal = page.getByTestId('filter-modal');
    await expect(modal).toBeVisible();

    // Should show ink filter options
    await expect(page.getByRole('button', {name: 'Amber', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sapphire', exact: true})).toBeVisible();
  });

  test('should close filter modal with Apply Filters', async ({page}) => {
    // Open modal
    await page.getByRole('button', {name: /Filters/}).click();
    await expect(page.getByTestId('filter-modal')).toBeVisible();

    // Click Apply Filters
    await page.getByRole('button', {name: 'Apply Filters'}).click();

    // Modal should be closed
    await expect(page.getByTestId('filter-modal')).not.toBeVisible();
  });

  test('should not filter featured cards when applying ink filter via modal', async ({page, appPage}) => {
    // Count initial featured tiles
    const initialCount = await appPage.featuredCards.locator('button[aria-pressed]').count();

    // Open filter modal and select Sapphire
    await page.getByRole('button', {name: /^Filters/}).click();
    await page.getByRole('button', {name: 'Sapphire', exact: true}).click();
    await page.getByRole('button', {name: 'Apply Filters'}).click();

    // Wait for modal to close
    await expect(page.getByTestId('filter-modal')).not.toBeVisible();
    await page.waitForTimeout(200);

    // Featured cards should remain unchanged (decoupled from filters)
    const afterCount = await appPage.featuredCards.locator('button[aria-pressed]').count();
    expect(afterCount).toBe(initialCount);
  });

  test('should filter by card type via modal', async ({page}) => {
    // Open filter modal and select Action
    await page.getByRole('button', {name: /^Filters/}).click();
    await page.getByRole('button', {name: 'Action', exact: true}).click();
    await page.getByRole('button', {name: 'Apply Filters'}).click();

    // Wait for modal to close
    await expect(page.getByTestId('filter-modal')).not.toBeVisible();

    // Filter button on hero should show active count
    await expect(page.getByRole('button', {name: /^Filters/})).toBeVisible();
  });

  test('should clear all filters via modal', async ({page}) => {
    // Apply some filters first
    await page.getByRole('button', {name: /^Filters/}).click();
    await page.getByRole('button', {name: 'Sapphire', exact: true}).click();
    await page.getByRole('button', {name: 'Apply Filters'}).click();
    await expect(page.getByTestId('filter-modal')).not.toBeVisible();

    // Reopen and clear
    await page.getByRole('button', {name: /^Filters/}).click();
    await page.getByRole('button', {name: 'Clear all'}).click();
    await page.getByRole('button', {name: 'Apply Filters'}).click();

    // Should be back to unfiltered state
    await expect(page.getByTestId('filter-modal')).not.toBeVisible();
  });

  test('should close filter modal with Escape key', async ({page}) => {
    // Open modal
    await page.getByRole('button', {name: /Filters/}).click();
    await expect(page.getByTestId('filter-modal')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should be closed
    await expect(page.getByTestId('filter-modal')).not.toBeVisible();
  });

  test('should close filter modal by clicking backdrop', async ({page}) => {
    // Open modal
    await page.getByRole('button', {name: /Filters/}).click();
    await expect(page.getByTestId('filter-modal')).toBeVisible();

    // Click backdrop
    await page.getByTestId('filter-modal-backdrop').click({position: {x: 5, y: 5}});

    // Modal should be closed
    await expect(page.getByTestId('filter-modal')).not.toBeVisible();
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
