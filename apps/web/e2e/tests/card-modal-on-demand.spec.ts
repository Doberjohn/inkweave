import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {holdLazyModule} from '../helpers/lazyModule';

// The card overview modal loads on demand (#640). An open that beats its chunk shows
// CardOverviewModalFallback, which then hands over to the modal. Holding the modal's module
// request keeps the cold path deterministic.
const holdModalModule = (page: Page) => holdLazyModule(page, 'CardOverviewModal');

test.describe('Card modal on demand', () => {
  test('a cold open shows the loading shell, then the modal takes over', async ({appPage, page}) => {
    const {release} = await holdModalModule(page);
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
    const {release} = await holdModalModule(page);
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
