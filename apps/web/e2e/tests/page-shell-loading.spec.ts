import {test, expect} from '../fixtures';

/**
 * Regression guard for issue #268: during the card-data loading window, each
 * page must keep its chrome (CompactHeader or equivalent) mounted and render
 * skeleton placeholders where real content will appear — not a full-page spinner
 * that unmounts the whole page tree.
 *
 * Strategy: intercept `/data/allCards.json` and hold the response long enough
 * that the loading window is a stable assertion target. Assert (a) a chrome
 * landmark is visible early and (b) at least one aria-busy skeleton is visible
 * in the same render. Then let the fetch complete and confirm happy-path
 * content renders normally.
 *
 * Before this PR landed, these tests would fail — the old LoadingSpinner
 * branch unmounted the header during the loading window.
 */

const LOAD_DELAY_MS = 1500;

test.describe('Page shell + skeleton during card-data loading', () => {
  test.beforeEach(async ({page}, testInfo) => {
    // Skip on mobile browsers — the routes under test here use desktop-leaning
    // layouts (CompactHeader + aside + grid). Mobile skeletons are covered by
    // component-level stories (CardDetailSkeleton, VoteFormSkeleton, CardGridSkeleton).
    if (testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
    // Delay both allCards.json (CardDataContext) and synergies/*.json (usePairQueue /
    // useSpecificPair) so every page's loading branch has a stable assertion window.
    await page.route(/\/data\/(allCards|synergies\/).*\.json/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
      await route.continue();
    });
  });

  test('CardPage renders skeleton + CompactHeader while card data loads', async ({page}) => {
    await page.goto('/card/1041');
    await expect(page.getByTestId('compact-header')).toBeVisible({timeout: 3000});
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible({timeout: 3000});
    await expect(page.getByTestId('card-detail-panel')).toBeVisible({timeout: 15000});
  });

  test('PlaystyleDetailPage renders skeleton + CompactHeader while card data loads', async ({page}) => {
    await page.goto('/playstyles/lore-denial');
    await expect(page.getByTestId('compact-header')).toBeVisible({timeout: 3000});
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible({timeout: 3000});
    await expect(page.getByRole('heading', {level: 1, name: /lore/i})).toBeVisible({timeout: 15000});
  });

  test('PlaystyleGalleryPage renders skeleton inside preserved shell', async ({page}) => {
    await page.goto('/playstyles');
    // Gallery shell (title + description) was already preserved before #268 —
    // the regression we catch here is the grid-area skeleton replacing the inner spinner.
    await expect(page.getByRole('heading', {level: 1, name: /playstyles/i})).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator('[aria-label="Loading playstyles"]')).toBeVisible({timeout: 3000});
    // Once data loads, the loading-skeleton region is gone
    await expect(page.locator('[aria-label="Loading playstyles"]')).toBeHidden({timeout: 15000});
  });

  test('VotePage renders pair + score picker skeleton while queue loads', async ({page}) => {
    await page.goto('/vote');
    await expect(page.getByTestId('compact-header')).toBeVisible({timeout: 3000});
    await expect(page.getByLabel('Loading vote pair')).toBeVisible({timeout: 3000});
  });

  test('InDepthVotePage renders pair + form skeleton while pair data loads', async ({page}) => {
    await page.goto('/vote/1041/957');
    await expect(page.getByTestId('compact-header')).toBeVisible({timeout: 3000});
    await expect(page.getByLabel('Loading vote pair and form')).toBeVisible({timeout: 3000});
  });
});
