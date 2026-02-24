import {test, expect} from '../fixtures';

test.describe('Search Autocomplete', () => {
  // Desktop-only: tests autocomplete dropdown on hero and browse pages
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
    // Ensure cards have loaded before testing autocomplete
    await expect(appPage.featuredCards.getByTestId('card-tile').first()).toBeVisible();
  });

  test('should show autocomplete dropdown when typing 2+ characters', async ({appPage, page}) => {
    await appPage.heroSearch.click();
    await appPage.heroSearch.pressSequentially('El', {delay: 50});

    // Autocomplete dropdown should appear after debounce
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({timeout: 2000});
    await expect(listbox.getByRole('option').first()).toBeVisible();
  });

  test('should navigate to card page when clicking a suggestion', async ({appPage, page}) => {
    await appPage.heroSearch.click();
    await appPage.heroSearch.pressSequentially('Elsa', {delay: 50});

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({timeout: 2000});

    // Click the first suggestion
    await listbox.getByRole('option').first().click();

    // Should navigate to a card page
    await expect(page).toHaveURL(/\/card\/\d+/);
  });

  test('should navigate to card via keyboard (ArrowDown + Enter)', async ({appPage, page}) => {
    await appPage.heroSearch.click();
    await appPage.heroSearch.pressSequentially('Elsa', {delay: 50});

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({timeout: 2000});

    // Use keyboard to select
    await appPage.heroSearch.press('ArrowDown');
    await appPage.heroSearch.press('Enter');

    // Should navigate to a card page
    await expect(page).toHaveURL(/\/card\/\d+/);
  });

  test('should close dropdown on Escape', async ({appPage, page}) => {
    await appPage.heroSearch.click();
    await appPage.heroSearch.pressSequentially('Elsa', {delay: 50});

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({timeout: 2000});

    await appPage.heroSearch.press('Escape');

    await expect(listbox).not.toBeVisible();
  });

  test('should show autocomplete on browse page search', async ({page}) => {
    // Navigate to browse page
    await page.getByRole('button', {name: /See all cards/}).click();
    await expect(page).toHaveURL(/\/browse/);

    // Wait for browse page cards to load (heroSearch doesn't exist here)
    const browseSearch = page.getByPlaceholder('Search cards...');
    await expect(browseSearch).toBeVisible({timeout: 10000});
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 10000});

    // Type in the browse search bar
    await browseSearch.click();
    await browseSearch.pressSequentially('Ariel', {delay: 50});

    // Autocomplete should appear after debounce
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({timeout: 10000});
  });
});
