import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';

// #641: the homepage renders its featured cards from a small prebuilt file
// (/data/featuredCards.json), so they never wait on the full card database. Holding
// allCards.json keeps that database from arriving.
const ALL_CARDS = '**/data/allCards.json';

/** Holds allCards.json until the returned release() is called. */
async function holdAllCards(page: Page): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(ALL_CARDS, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

test.describe('Card data on the homepage (#641)', () => {
  test('the featured cards render, each linking to its card page, while the card list is held', async ({
    appPage,
    page,
  }) => {
    const release = await holdAllCards(page);
    await appPage.goto();

    const tiles = appPage.featuredCards.getByTestId('card-tile');
    await expect(tiles).toHaveCount(6);
    const hrefs = await tiles.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    for (const href of hrefs) expect(href).toMatch(/^\/card\/\d+\/[a-z0-9-]+$/);

    release();
  });
});
