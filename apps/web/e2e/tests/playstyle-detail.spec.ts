import {test, expect} from '../fixtures';
import {slidePointerOnto} from '../helpers/pointer';

test.describe('Playstyle Detail — Desktop', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto('/playstyles/discard');
    await page.waitForTimeout(500);
  });

  test('should render hero with name and breadcrumb', async ({page}) => {
    // Page heading (h1) with playstyle name
    const heading = page.getByRole('heading', {level: 1});
    await expect(heading).toBeVisible({timeout: 10000});
    await expect(heading).toContainText('Discard');

    // Breadcrumb nav with "Playstyles" link (exclude the main nav header)
    const breadcrumb = page.locator('section nav').filter({hasText: 'Playstyles'});
    await expect(breadcrumb).toBeVisible();
    const playstyleLink = breadcrumb.getByRole('link', {name: 'Playstyles'});
    await expect(playstyleLink).toBeVisible();
  });

  test('should show and use role filter chips', async ({page}) => {
    // Wait for cards to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Get initial card count
    const initialCount = await cardTiles.count();
    expect(initialCount).toBeGreaterThan(0);

    // Discard exposes Forced/Targeted/Random Discard + Payoff mechanic tiles.
    // "Forced Discard" is the broadest enabler — its tile is reliably present.
    // (Labels come from the shared mechanics catalog; "standard" → "Forced Discard".)
    const forcedDiscardChip = page.getByRole('button', {name: /Forced Discard/});
    await expect(forcedDiscardChip).toBeVisible();

    // Click to apply the filter — card grid should narrow to forced-discard enablers.
    await forcedDiscardChip.click();
    await page.waitForTimeout(200);

    const filteredCount = await cardTiles.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // Click the same chip again to toggle it off — grid restores to full set.
    await forcedDiscardChip.click();
    await page.waitForTimeout(200);

    const resetCount = await cardTiles.count();
    expect(resetCount).toBe(initialCount);
  });

  test('should render card tiles in grid', async ({page}) => {
    // Let discard's tiles render before leaving the page. Leaving while its playstyle data is
    // still loading aborts that fetch, and WebKit logs the abort as "TypeError: Load failed",
    // which fails the console guard (#854).
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});

    // Navigate to a different playstyle (location-control)
    await page.goto('/playstyles/location-control');
    await page.waitForTimeout(500);

    // Card tiles should render
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    const count = await cardTiles.count();
    expect(count).toBeGreaterThan(5);
  });

  test('should open the card overview modal from playstyle detail', async ({page}) => {
    // Wait for card tiles to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Click a card tile → opens the global modal (URL stays on the playstyle page).
    await cardTiles.first().click();
    // Modal open = React mount + per-card synergy fetch + visibility transition; slow CI
    // webkit can exceed 5s before the overlay-visible class settles. Match the 15s used above.
    await expect(page.getByTestId('card-overview-modal')).toBeVisible({timeout: 15000});
  });

  test('keeps a tile tooltip under the pointer, ignores clicks on it, and hides on Escape', async ({
    page,
  }) => {
    const tile = page.getByRole('button', {name: /Forced Discard/});
    await expect(tile).toBeVisible({timeout: 10000});
    const tooltip = page.getByRole('tooltip');

    // The pointer can cross from the tile onto its tooltip and stay there (WCAG 1.4.13, #836).
    await tile.hover();
    await expect(tooltip).toBeVisible();
    await slidePointerOnto(page, tooltip);
    await page.waitForTimeout(300); // past the tooltip's 150 ms close delay
    await expect(tooltip).toBeVisible();

    // The tooltip renders beside the tile's button, so a click on it doesn't toggle the filter.
    await tooltip.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
  });
});

/**
 * A playstyle page waits for its own card list, `_playstyles.json`, as well as the card list
 * (#913): until both are in, it shows its loading view, never "No cards match your filters."
 * It waits for its cards' mechanic tiles too, `_playstyleMechanics.json` (#930), so the tiles
 * never arrive after the cards.
 */
test.describe('Playstyle Detail — loading', () => {
  const LOADING_VIEW = '[aria-label="Loading playstyle cards"]';
  const EMPTY_GRID = 'No cards match your filters.';

  test("shows its loading view, not an empty grid, until the playstyle's cards arrive", async ({page}) => {
    // Notes any moment the empty message is on the page, from the first byte on.
    await page.addInitScript((text) => {
      const seen = window as Window & {sawEmptyGrid?: boolean};
      seen.sawEmptyGrid = false;
      new MutationObserver(() => {
        if (document.body?.textContent?.includes(text)) seen.sawEmptyGrid = true;
      }).observe(document, {childList: true, subtree: true, characterData: true});
    }, EMPTY_GRID);
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/data/synergies/_playstyles.json', async (route) => {
      await held;
      await route.continue();
    });
    const cardList = page.waitForResponse((response) => response.url().includes('/data/allCards.json'));

    await page.goto('/playstyles/lore-denial');
    await cardList;
    // Time for the card list to land in the page, which on its own drew the empty grid.
    await page.waitForTimeout(1000);
    await expect(page.locator(LOADING_VIEW)).toBeVisible();

    release();
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    await expect(page.locator(LOADING_VIEW)).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & {sawEmptyGrid?: boolean}).sawEmptyGrid)).toBe(false);
  });

  test('draws its mechanic tiles in the same render as its cards', async ({page}, testInfo) => {
    // A phone keeps the tiles in a sheet; the desktop row shows them beside the cards.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    // Notes any moment a card is on the page with no mechanic tile, from the first byte on.
    await page.addInitScript(() => {
      const seen = window as Window & {sawCardsWithoutTiles?: boolean};
      seen.sawCardsWithoutTiles = false;
      new MutationObserver(() => {
        const card = document.querySelector('[data-testid="card-tile"]');
        const tile = document.querySelector('section[aria-label="Mechanics"] button');
        if (card && !tile) seen.sawCardsWithoutTiles = true;
      }).observe(document, {childList: true, subtree: true});
    });
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/data/synergies/_playstyleMechanics.json', async (route) => {
      await held;
      await route.continue();
    });
    const cardList = page.waitForResponse((response) => response.url().includes('/data/allCards.json'));
    const cardIds = page.waitForResponse((response) => response.url().includes('/data/synergies/_playstyles.json'));

    await page.goto('/playstyles/discard');
    await Promise.all([cardList, cardIds]);
    // Time for both lists to land in the page, which could then draw its cards without their tiles.
    await page.waitForTimeout(1000);
    await expect(page.locator(LOADING_VIEW)).toBeVisible();

    release();
    await expect(page.getByRole('button', {name: /Forced Discard/})).toBeVisible({timeout: 15000});
    await expect(page.getByTestId('card-tile').first()).toBeVisible();
    expect(
      await page.evaluate(() => (window as Window & {sawCardsWithoutTiles?: boolean}).sawCardsWithoutTiles),
    ).toBe(false);
  });

  test('the gallery asks for the mechanic ids only once it has drawn with its own card ids', async ({page}) => {
    let mechanicsAsked = false;
    page.on('request', (request) => {
      if (request.url().includes('/data/synergies/_playstyleMechanics.json')) mechanicsAsked = true;
    });
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/data/synergies/_playstyles.json', async (route) => {
      await held;
      await route.continue();
    });

    await page.goto('/playstyles');
    await expect(page.locator('a[href="/playstyles/lore-denial"]').first()).toBeVisible({timeout: 15000});
    // Time for a request the gallery would make before its card ids, competing with them.
    await page.waitForTimeout(1000);
    expect(mechanicsAsked).toBe(false);

    const mechanics = page.waitForResponse((response) =>
      response.url().includes('/data/synergies/_playstyleMechanics.json'),
    );
    release();
    await mechanics;
  });

  test('opened from the gallery, a playstyle shows its cards with no loading view between', async ({page}) => {
    // The gallery reads both files a playstyle page waits for: the mechanic ids once it has drawn.
    const playstyleFiles = Promise.all(
      ['_playstyles.json', '_playstyleMechanics.json'].map((file) =>
        page.waitForResponse((response) => response.url().includes(`/data/synergies/${file}`)),
      ),
    );
    await page.goto('/playstyles');
    await playstyleFiles;
    const link = page.locator('a[href="/playstyles/lore-denial"]').first();
    await expect(link).toBeVisible({timeout: 15000});

    // The gallery's read of the list answers the playstyle page's first render (#913).
    await page.evaluate((selector) => {
      const seen = window as Window & {sawLoadingView?: boolean};
      seen.sawLoadingView = false;
      new MutationObserver(() => {
        if (document.querySelector(selector)) seen.sawLoadingView = true;
      }).observe(document.body, {childList: true, subtree: true});
    }, LOADING_VIEW);
    await link.click();

    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    expect(await page.evaluate(() => (window as Window & {sawLoadingView?: boolean}).sawLoadingView)).toBe(false);
  });
});
