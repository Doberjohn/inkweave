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

  // NOTE: CardPage is now a thin redirect (opens the global CardOverviewModal + navigates to `/`).
  // The "skeleton + CompactHeader during card load" assertion no longer applies — the modal lives
  // at the AppLayout level, not in a route-rendered page. Loading-window UX is now: home page
  // chrome (hero) renders first, modal renders inside backdrop once card data resolves.

  test('PlaystyleDetailPage renders skeleton + CompactHeader while card data loads', async ({page}) => {
    await page.goto('/playstyles/lore-denial');
    await expect(page.getByTestId('compact-header')).toBeVisible({timeout: 3000});
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible({timeout: 3000});
    await expect(page.getByRole('heading', {level: 1, name: /lore/i})).toBeVisible({timeout: 15000});
  });

  test('PlaystyleGalleryPage renders skeleton inside preserved shell', async ({page}) => {
    // The gallery grid is a heavy lazy tree, so under parallel-worker contention its first render
    // can eat the fixed LOAD_DELAY_MS window and let the skeleton vanish before we assert it (the
    // flake that blocked #444's pre-push). Instead of racing the clock, HOLD allCards.json open
    // until the skeleton is asserted, then release it — the loading state is then deterministic.
    // This per-test route is registered after the beforeEach one, so it wins for allCards.json
    // (Playwright resolves routes last-registered-first); synergies/*.json still use the delay.
    let releaseCardData = () => {};
    const cardDataHeld = new Promise<void>((resolve) => {
      releaseCardData = resolve;
    });
    await page.route(/\/data\/allCards.*\.json/, async (route) => {
      await cardDataHeld;
      await route.continue();
    });

    await page.goto('/playstyles');
    // Data is held open → the loading skeleton is guaranteed present, and the shell (title +
    // description) is preserved around it — the regression we catch here is the grid-area
    // skeleton replacing the inner spinner, not the shell itself.
    await expect(page.locator('[aria-label="Loading playstyles"]')).toBeVisible({timeout: 5000});
    await expect(page.getByRole('heading', {level: 1, name: /playstyles/i})).toBeVisible();

    // Release the data; once it loads, the loading-skeleton region is gone.
    releaseCardData();
    await expect(page.locator('[aria-label="Loading playstyles"]')).toBeHidden({timeout: 15000});
  });

  test('VotePage renders pair + score picker skeleton while queue loads', async ({page}) => {
    await page.goto('/vote');
    await expect(page.getByTestId('compact-header')).toBeVisible({timeout: 3000});
    await expect(page.getByLabel('Loading vote pair')).toBeVisible({timeout: 3000});
  });

  test('InDepthVotePage renders pair + form skeleton while pair data loads', async ({page}) => {
    await page.goto('/vote/1939/1945');
    await expect(page.getByTestId('compact-header')).toBeVisible({timeout: 3000});
    // Use role+name instead of getByLabel: the <main> landmark with aria-label
    // is more reliably matched via getByRole than getByLabel (Playwright's
    // getByLabel is primarily for form controls; landmark labels are an edge case).
    await expect(
      page.getByRole('main', {name: 'Loading vote pair and form'}),
    ).toBeVisible({timeout: 5000});
  });
});
