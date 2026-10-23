import {test, expect} from '../fixtures';

/** The collection files a search downloads: sets 1-8 and the promo catalog (#911). */
const PRE_CORE_FILES = ['1', '2', '3', '4', '5', '6', '7', '8', 'promos'].map((file) => `/data/collection/${file}.json`);

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

  test("a search lists the sets 1-8 cards Core doesn't have, opened in the card window (#911)", async ({page}) => {
    // The grid is virtual, rendering only the rows in view, so each search here names one card.
    await page.goto('/browse?q=Ariel+On+Human');
    const tiles = page.getByTestId('card-tile');

    // A Set 1 card has no page: its tile is a button, and its window says it is outside Core.
    await page.getByRole('button', {name: 'Ariel - On Human Legs', exact: true}).click();
    const modal = page.getByTestId('card-overview-modal');
    await expect(modal.locator('h1')).toHaveText('Ariel - On Human Legs');
    await expect(modal.getByTestId('card-overview-outside-core')).toBeVisible();
    // The dialog moves focus to its × 100ms after opening; a 100ms timer set now runs after it.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);

    // Set 4's Ariel - Singing Mermaid is the Core card Set 9 reprints: one tile, linking to its page.
    await page.getByTestId('browse-search').fill('Ariel Singing Mermaid');
    await expect(tiles).toHaveCount(1);
    await expect(tiles).toHaveAttribute('href', /^\/card\/\d+\/ariel-singing-mermaid$/);
  });

  test('a search downloads sets 1-8 and the promos once, and never sets 9-14 (#911)', async ({page}, testInfo) => {
    // One project is enough: this asserts what the network requests, as collection-mode.spec.ts's
    // request tests do, and the five-browser matrix would only repeat it.
    if (testInfo.project.name !== 'chromium') test.skip();
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    const collectionFiles = () => requests.filter((pathname) => pathname.startsWith('/data/collection/'));
    const tiles = page.getByTestId('card-tile');

    await page.goto('/browse');
    await expect(tiles.first()).toBeVisible();
    expect(collectionFiles()).toEqual([]);

    // The box shows the URL's query, which each change sets in a transition, and the URL moves
    // before the transition renders: each fill waits for the box to show it, or the next one
    // could land on the box while it still shows the query before ("ArielAriel On Human").
    const search = page.getByTestId('browse-search');
    await search.fill('Ariel');
    await expect(search).toHaveValue('Ariel');
    // A Set 1 card among the results: the search's cards have landed. A longer query, and a new
    // search once the box is emptied, reuse them.
    await search.fill('Ariel On Human');
    await expect(page.getByRole('button', {name: 'Ariel - On Human Legs', exact: true})).toBeVisible();
    await search.fill('');
    await expect(search).toHaveValue('');
    await search.fill('Stitch');
    await expect(search).toHaveValue('Stitch');
    await expect(tiles.first()).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(collectionFiles().sort()).toEqual([...PRE_CORE_FILES].sort());
  });
});
