import {test, expect} from '../fixtures';

test.describe('Card Search and Filtering', () => {
  // Skip on mobile - filters are in a drawer
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
  });

  test('should search for a card by name', async ({cardListPage}) => {
    // Get initial card count
    const initialCounts = await cardListPage.getDisplayedCardCount();

    // Search for something specific
    await cardListPage.searchFor('Elsa');

    // Should show filtered results (fewer than total)
    const counts = await cardListPage.getDisplayedCardCount();
    expect(counts.shown).toBeGreaterThan(0);
    expect(counts.total).toBeLessThan(initialCounts.total);
  });

  test('should show matching cards in search results', async ({cardListPage}) => {
    await cardListPage.searchFor('Elsa');

    // Card with "Elsa" should be visible
    const isVisible = await cardListPage.isCardVisible('Elsa');
    expect(isVisible).toBe(true);
  });

  test('should clear search and show all cards', async ({cardListPage}) => {
    // Get initial count
    const initialCounts = await cardListPage.getDisplayedCardCount();

    // Search for something
    await cardListPage.searchFor('Elsa');
    const filteredCounts = await cardListPage.getDisplayedCardCount();
    expect(filteredCounts.total).toBeLessThan(initialCounts.total);

    // Then clear the search
    await cardListPage.clearSearch();
    const clearedCounts = await cardListPage.getDisplayedCardCount();

    // Should show all cards again
    expect(clearedCounts.total).toBe(initialCounts.total);
  });

  test('should filter cards by ink color', async ({cardListPage}) => {
    // Get initial count
    const initialCounts = await cardListPage.getDisplayedCardCount();

    // Filter by Sapphire
    await cardListPage.filterByInk('Sapphire');

    // Verify filter button is active
    await expect(cardListPage.getInkFilterButton('Sapphire')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Card count should be reduced
    const filteredCounts = await cardListPage.getDisplayedCardCount();
    expect(filteredCounts.total).toBeLessThan(initialCounts.total);
  });

  test('should filter cards by type', async ({cardListPage}) => {
    // Get initial count
    const initialCounts = await cardListPage.getDisplayedCardCount();

    // Filter by Action type
    await cardListPage.filterByType('Action');

    // Verify filter button is active
    await expect(cardListPage.getTypeFilterButton('Action')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Card count should be reduced
    const filteredCounts = await cardListPage.getDisplayedCardCount();
    expect(filteredCounts.total).toBeLessThan(initialCounts.total);
  });

  test('should combine multiple filters', async ({cardListPage}) => {
    // Apply ink filter
    await cardListPage.filterByInk('Amber');
    const amberCounts = await cardListPage.getDisplayedCardCount();

    // Add type filter
    await cardListPage.filterByType('Character');
    const combinedCounts = await cardListPage.getDisplayedCardCount();

    // Combined filters should show fewer cards
    expect(combinedCounts.total).toBeLessThanOrEqual(amberCounts.total);
  });

  test('should filter cards by keyword', async ({cardListPage}) => {
    // Get initial count
    const initialCounts = await cardListPage.getDisplayedCardCount();

    // Filter by Singer keyword
    await cardListPage.filterByKeyword('Singer');

    // Card count should be reduced
    const filteredCounts = await cardListPage.getDisplayedCardCount();
    expect(filteredCounts.total).toBeLessThan(initialCounts.total);
  });

  test('should clear all filters', async ({cardListPage}) => {
    // Apply filters
    await cardListPage.searchFor('test');
    await cardListPage.filterByInk('Ruby');

    // Clear all
    await cardListPage.clearAllFilters();

    // Verify search is cleared
    await expect(cardListPage.searchInput).toHaveValue('');

    // Verify ink filter is reset to All
    await expect(cardListPage.getInkFilterButton('All')).toHaveAttribute('aria-pressed', 'true');
  });
});
