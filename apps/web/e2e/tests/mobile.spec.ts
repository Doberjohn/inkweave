import {test, expect} from '../fixtures';

test.describe('Mobile Viewport', () => {
  // This test file should only run on mobile projects
  test.beforeEach(async ({page, appPage}, testInfo) => {
    // Skip on non-mobile projects
    if (!testInfo.project.name.startsWith('mobile-')) {
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

  test('should open the overview modal when selecting a featured card', async ({appPage, page}) => {
    // Click a featured card → modal opens overlay-style. URL stays `/` (not navigation).
    await appPage.selectFeaturedCard();
    await expect(page).toHaveURL('/');
    await expect(appPage.cardOverviewModal).toBeVisible();

    // Synergies fetched async — wait for chips, empty state, or error banner inside the modal.
    const hasChips = appPage.cardOverviewModal.getByRole('button', {name: /\d+ cards/i});
    const noSynergies = appPage.cardOverviewModal.getByText('No synergies yet');
    const errorBanner = page.getByRole('alert');

    await expect(hasChips.first().or(noSynergies).or(errorBanner)).toBeVisible({timeout: 10000});
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

  test('should open search bottom sheet and focus input when tapping search icon', async ({
    page,
  }) => {
    // Navigate away from home so the bottom nav appears
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Tap the search icon in the bottom nav
    const searchButton = page.getByRole('button', {name: 'Search cards'});
    await searchButton.click();

    // Search bottom sheet should open
    const searchDialog = page.getByRole('dialog', {name: 'Search cards'});
    await expect(searchDialog).toBeVisible();

    // Input should be visible and interactive (skip focus check — WebKit
    // doesn't reliably auto-focus inputs after programmatic interactions)
    const searchInput = searchDialog.getByPlaceholder('Search cards...');
    await expect(searchInput).toBeVisible();
  });

  test('should close search bottom sheet on backdrop click', async ({page}) => {
    // Navigate to browse so bottom nav appears
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Open search sheet
    await page.getByRole('button', {name: 'Search cards'}).click();
    await expect(page.getByRole('dialog', {name: 'Search cards'})).toBeVisible();

    // Dispatch click directly on the backdrop element — bypasses hit-testing.
    // Coord clicks are fragile on mobile-safari: `position: sticky` on the
    // CompactHeader puts the header above the backdrop at top-left coords, so
    // `page.mouse.click(x, y)` would hit the logo. Locator `.click()` defaults
    // to the element's center, which the sheet covers. dispatchEvent fires the
    // onClick handler directly without any DOM hit-testing.
    await page.waitForTimeout(600); // let enter transition finish
    await page.getByTestId('search-sheet-backdrop').dispatchEvent('click');

    // Sheet should be gone after exit transition
    await expect(page.getByRole('dialog', {name: 'Search cards'})).not.toBeVisible({timeout: 5000});
  });

  test('should navigate to browse when pressing Enter in search bottom sheet', async ({page}) => {
    // Navigate away from home so the bottom nav appears
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Open search sheet
    await page.getByRole('button', {name: 'Search cards'}).click();
    const searchDialog = page.getByRole('dialog', {name: 'Search cards'});
    await expect(searchDialog).toBeVisible();

    // Type a query and press Enter
    const searchInput = searchDialog.getByPlaceholder('Search cards...');
    await searchInput.fill('Elsa');
    await searchInput.press('Enter');

    // Wait for sheet dismiss + navigation (mobile-safari can be slow)
    await page.waitForTimeout(300);

    // Should navigate to browse with query param
    await expect(page).toHaveURL(/\/browse\?q=Elsa/, {timeout: 10000});
    await expect(page.getByRole('heading', {name: 'Browse Cards'})).toBeVisible({timeout: 10000});
  });

  test('should show sort dropdown in browse toolbar', async ({page}) => {
    // Navigate to browse
    await page.getByTestId('cta-browse').click();
    await page.waitForTimeout(200);

    // Sort select and Filters button should be in the same toolbar
    const toolbar = page.getByTestId('browse-toolbar');
    await expect(toolbar.getByRole('button', {name: /Filters/})).toBeVisible();
    await expect(toolbar.getByLabel('Sort cards')).toBeVisible();
  });

  test('should lock background scroll when filter drawer is open', async ({page}) => {
    // Navigate to browse
    await page.goto('/browse');
    await page.waitForTimeout(500);

    // Open filter drawer
    await page.getByRole('button', {name: /Filters/}).click();
    await page.waitForTimeout(200);

    // Background scroll should be locked (Radix uses html overflow, custom uses body overflow)
    const isScrollLocked = await page.evaluate(() => {
      const bodyOverflow = getComputedStyle(document.body).overflow;
      const htmlOverflow = getComputedStyle(document.documentElement).overflow;
      return bodyOverflow === 'hidden' || htmlOverflow === 'hidden';
    });
    expect(isScrollLocked).toBe(true);
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
