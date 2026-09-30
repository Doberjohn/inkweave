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

/** Records every allCards.json request the page makes. */
function recordAllCardsRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/allCards.json')) seen.push(request.url());
  });
  return seen;
}

/** An idle callback that never runs, so a deferred card list waits for the page to need it. */
async function neverIdle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.requestIdleCallback = () => 0;
    window.cancelIdleCallback = () => {};
  });
}

test.describe('Card data on the homepage (#641)', () => {
  test('the homepage requests the card list only once something needs it', async ({appPage, page}) => {
    await neverIdle(page);
    const requests = recordAllCardsRequests(page);
    await appPage.goto();
    await expect(appPage.featuredCards.getByTestId('card-tile')).toHaveCount(6);
    await page.waitForTimeout(1000);
    expect(requests).toHaveLength(0);

    await appPage.heroSearch.focus();
    await expect.poll(() => requests.length).toBe(1);
  });

  test('every other page requests the card list at once', async ({page}) => {
    await neverIdle(page);
    const request = page.waitForRequest('**/data/allCards.json');
    await page.goto('/browse');
    await request;
  });

  test('a featured card pressed before the card list lands opens once it does', async ({appPage, page}) => {
    const release = await holdAllCards(page);
    await appPage.goto();

    await appPage.featuredCards.getByTestId('card-tile').first().click();
    await expect(appPage.cardOverviewModal).toHaveCount(0);

    release();
    await expect(appPage.cardOverviewModal).toBeVisible({timeout: 15000});
  });

  test('a search typed before the card list lands keeps its text and gets suggestions', async ({
    appPage,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile-'), 'the hero autocomplete is desktop-only');
    const release = await holdAllCards(page);
    await appPage.goto();

    await appPage.heroSearch.click();
    await appPage.heroSearch.pressSequentially('Elsa', {delay: 50});
    await expect(appPage.heroSearch).toHaveValue('Elsa');

    release();
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible({timeout: 15000});
    await expect(appPage.heroSearch).toHaveValue('Elsa');
  });

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
