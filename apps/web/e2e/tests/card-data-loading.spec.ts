import type {Page, Route} from '@playwright/test';
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

  test('previewCards.json loads once per page', async ({page}) => {
    const previewRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/data/previewCards.json')) previewRequests.push(request.url());
    });
    await page.goto('/browse');
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    await page.waitForTimeout(1000);

    expect(previewRequests).toHaveLength(1);
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

// A copy of the app the service worker kept can meet card data whose shape changed after it was
// built. Data that arrived and can't be read offers a reload, which brings the newest version;
// data that never arrived offers another try.
test.describe('Card data that fails to load', () => {
  test('card data the page cannot read offers Reload, which reloads the page', async ({appPage, page}) => {
    // A shape no version of the reader takes: `cards` is not a list.
    await page.route(ALL_CARDS, (route) => route.fulfill({json: {cards: 'unreadable'}}));
    await page.goto('/browse');

    await expect(appPage.errorMessage).toBeVisible({timeout: 15000});
    await expect(page.getByText("The card data couldn't be read.", {exact: false})).toBeVisible();
    await expect(appPage.retryButton).toHaveCount(0);

    await page.evaluate(() => ((window as {beforeReload?: boolean}).beforeReload = true));
    await Promise.all([page.waitForEvent('load'), appPage.reloadButton.click()]);
    expect(await page.evaluate(() => (window as {beforeReload?: boolean}).beforeReload)).toBeUndefined();
    await expect(appPage.errorMessage).toBeVisible({timeout: 15000});
  });

  const UNDELIVERED: {failure: string; fail: (route: Route) => Promise<void>; line: string}[] = [
    {failure: 'never arrived', fail: (route) => route.abort('internetdisconnected'), line: "Couldn't reach Inkweave."},
    {
      failure: 'came back with a server error',
      fail: (route) => route.fulfill({status: 503}),
      line: "Inkweave couldn't send the card data (error 503).",
    },
  ];

  for (const {failure, fail, line} of UNDELIVERED) {
    test(`a card list that ${failure} offers Try Again, and a retry that lands shows the cards`, async ({
      appPage,
      page,
    }) => {
      let failed = false;
      await page.route(ALL_CARDS, async (route) => {
        if (failed) return route.continue();
        failed = true;
        await fail(route);
      });
      await page.goto('/browse');

      await expect(appPage.errorMessage).toBeVisible({timeout: 15000});
      await expect(page.getByText(line, {exact: false})).toBeVisible();
      await expect(appPage.reloadButton).toHaveCount(0);

      await appPage.retryButton.click();
      await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    });
  }
});
