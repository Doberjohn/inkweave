import {test, expect} from '../fixtures';

test.describe('App Loading', () => {
  // Skip on mobile - UI layout is different
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({appPage: _}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
  });

  test('should display card list when app loads', async ({appPage, cardListPage}) => {
    await appPage.goto();

    await expect(appPage.header).toBeVisible();
    await expect(cardListPage.searchInput).toBeVisible();
    // Verify card count is shown somewhere on the page
    await expect(cardListPage.cardCountText).toBeVisible();
  });

  test('should display header', async ({appPage}) => {
    await appPage.goto();

    await expect(appPage.header).toBeVisible();
  });

  test('should show card count after loading', async ({appPage, cardListPage}) => {
    await appPage.goto();

    // Wait for card count text to appear (shows "X of Y cards")
    await expect(cardListPage.cardCountText).toBeVisible();
    const text = await cardListPage.cardCountText.textContent();
    const match = text?.match(/\d+ of (\d+) cards/);
    expect(match).toBeTruthy();
    const totalCards = parseInt(match![1], 10);
    expect(totalCards).toBeGreaterThan(0);
  });

  test('should display search input and filters', async ({appPage, cardListPage}) => {
    await appPage.goto();

    await expect(cardListPage.searchInput).toBeVisible();
    await expect(cardListPage.getInkFilterButton('All')).toBeVisible();
    await expect(cardListPage.getInkFilterButton('Amber')).toBeVisible();
    await expect(cardListPage.getTypeFilterButton('Character')).toBeVisible();
  });
});
