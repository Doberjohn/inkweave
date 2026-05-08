import {test, expect} from '../fixtures';

test.describe('App Loading', () => {
  // Skip on mobile - UI layout is different
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({appPage: _}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
  });

  test('should display hero home page when app loads', async ({appPage}) => {
    await appPage.goto();

    await expect(appPage.heroSection).toBeVisible();
    await expect(appPage.heroSearch).toBeVisible();
    await expect(appPage.featuredCards).toBeVisible();
    await expect(appPage.etherealBackground).toBeVisible();
  });

  test('should display search input on home page', async ({appPage}) => {
    await appPage.goto();

    await expect(appPage.heroSearch).toBeVisible();
  });

  test('should show featured cards after loading', async ({appPage}) => {
    await appPage.goto();

    // Featured cards grid should have card tiles
    const cardTiles = appPage.featuredCards.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible();
    const count = await cardTiles.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(12);
  });

  test('should open the overview modal when a card is selected', async ({appPage, page}) => {
    await appPage.goto();

    // Home state: no header visible (hero-only layout)
    await expect(appPage.header).not.toBeVisible();

    await appPage.selectFeaturedCard();

    // Modal opens overlay-style — URL stays `/`, hero remains in DOM behind the backdrop.
    await expect(page).toHaveURL('/');
    await expect(appPage.cardOverviewModal).toBeVisible();
  });
});
