import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';

// The card overview modal loads on demand (#640). An open that beats its chunk shows
// CardOverviewModalFallback, which then hands over to the modal. Holding the modal's module
// request keeps the cold path deterministic (the dev server serves it as its source file).
const MODAL_MODULE = '**/components/CardOverviewModal.tsx*';

/** Holds the modal's module until the returned release() is called. */
async function holdModalModule(page: Page): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(MODAL_MODULE, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

test.describe('Card modal on demand', () => {
  test('a cold open shows the loading shell, then the modal takes over', async ({appPage, page}) => {
    const release = await holdModalModule(page);
    await appPage.goto();

    await appPage.featuredCards.getByTestId('card-tile').first().click();
    const shell = page.getByTestId('card-overview-fallback');
    await expect(shell).toBeVisible();
    await expect(appPage.cardOverviewModal).toHaveCount(0);

    release();
    await expect(appPage.cardOverviewModal).toBeVisible({timeout: 15000});
    await expect(shell).toHaveCount(0);
  });

  test('the loading shell closes on a scrim click, like the modal', async ({appPage, page}) => {
    const release = await holdModalModule(page);
    await appPage.goto();

    await appPage.featuredCards.getByTestId('card-tile').first().click();
    const shell = page.getByTestId('card-overview-fallback');
    await expect(shell).toBeVisible();

    await page.getByTestId('card-overview-fallback-backdrop').dispatchEvent('click');
    await expect(shell).toHaveCount(0);

    // The chunk arriving afterwards must not reopen anything.
    release();
    await page.waitForTimeout(500);
    await expect(appPage.cardOverviewModal).toHaveCount(0);
  });
});
