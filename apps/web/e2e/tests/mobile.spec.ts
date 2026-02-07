import {test, expect} from '../fixtures';
import {clearStoredDecks} from '../helpers/storage';

test.describe('Mobile Viewport', () => {
  // This test file should only run on mobile-chrome project
  test.beforeEach(async ({page, appPage}, testInfo) => {
    // Skip on non-mobile projects
    if (testInfo.project.name !== 'mobile-chrome') {
      test.skip();
    }

    await page.goto('/');
    await clearStoredDecks(page);
    await page.reload();
    await appPage.waitForCardsLoaded();
  });

  test('should display mobile navigation', async ({page}) => {
    const mobileNav = page.locator('nav');
    await expect(mobileNav).toBeVisible();

    // Check nav buttons - use nav locator to avoid matching card buttons
    await expect(mobileNav.getByRole('button', {name: 'Cards'})).toBeVisible();
    await expect(mobileNav.getByRole('button', {name: 'Synergies'})).toBeVisible();
    await expect(mobileNav.getByRole('button', {name: 'Deck'})).toBeVisible();
  });

  test('should start on Cards view', async ({page}) => {
    await expect(page.getByRole('button', {name: 'Cards'})).toHaveAttribute('aria-pressed', 'true');

    // Search input should be visible (Cards view)
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible();
  });

  test('should switch to Synergies view', async ({page}) => {
    const mobileNav = page.locator('nav');
    await mobileNav.getByRole('button', {name: 'Synergies'}).click();

    await expect(mobileNav.getByRole('button', {name: 'Synergies'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Should show empty state
    await expect(page.getByText('Select a card to see synergies')).toBeVisible();
  });

  test('should switch to Deck view', async ({page}) => {
    const mobileNav = page.locator('nav');
    await mobileNav.getByRole('button', {name: 'Deck'}).click();

    await expect(mobileNav.getByRole('button', {name: 'Deck'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Should show empty deck state
    await expect(page.getByText('No cards in deck')).toBeVisible();
  });

  test('should show filter drawer on mobile', async ({page}) => {
    // Click filter button
    const filterButton = page.getByRole('button', {name: /Filters/});
    await filterButton.click();

    // Filter drawer should show ink options
    await expect(page.getByRole('button', {name: 'Amber', exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Sapphire', exact: true})).toBeVisible();
  });

  test('should show mobile header', async ({page}) => {
    // Header should be visible
    await expect(page.locator('header')).toBeVisible();
  });

  test('should search for cards on mobile', async ({cardListPage, page}) => {
    // Search should work on mobile
    await cardListPage.searchFor('Elsa');

    // Should show filtered results
    const counts = await cardListPage.getDisplayedCardCount();
    expect(counts.shown).toBeGreaterThan(0);

    // At least one Elsa card should be visible
    await expect(page.getByText('Elsa').first()).toBeVisible();
  });

  test('should add card to deck on mobile', async ({page}) => {
    const mobileNav = page.locator('nav');

    // Find first add button and click it
    const addButton = page.getByLabel(/Add .* to deck/i).first();
    await addButton.click();

    // Switch to Deck view
    await mobileNav.getByRole('button', {name: 'Deck'}).click();

    // Should show deck count
    await expect(page.locator('span').filter({hasText: /1\/60/})).toBeVisible();
  });

  test('should maintain search state when switching views', async ({cardListPage, page}) => {
    const mobileNav = page.locator('nav');

    // Search for a card
    await cardListPage.searchFor('Elsa');

    // Switch to Deck view and back
    await mobileNav.getByRole('button', {name: 'Deck'}).click();
    await mobileNav.getByRole('button', {name: 'Cards'}).click();

    // Search should still be there
    await expect(cardListPage.searchInput).toHaveValue('Elsa');
  });
});
