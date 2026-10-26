import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';

// "Skip to main content" (WCAG 2.4.1): the first Tab stop on every page with the header, hidden
// until it has focus, landing right after the header. Browse renders its header inside <main> and
// the card page outside it, so the spec visits both.

const skipLink = (page: Page) => page.getByRole('link', {name: 'Skip to main content'});

/** Tabs to the skip link, follows it, and Tabs once more, which must land past the header. */
async function skipPastHeader(page: Page) {
  const link = skipLink(page);
  expect((await link.boundingBox())!.width).toBeLessThanOrEqual(1);

  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  // Shown while it has focus, in the page's top corner.
  const box = (await link.boundingBox())!;
  expect(box.width).toBeGreaterThan(100);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);

  const url = page.url();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(page.url()).toBe(url);

  await page.keyboard.press('Tab');
  const landed = await page.evaluate(() => ({
    inMain: document.activeElement?.closest('main') != null,
    inHeader: document.activeElement?.closest('header') != null,
  }));
  expect(landed).toEqual({inMain: true, inHeader: false});
}

test.describe('Skip to main content on a desktop', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({page: _}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
  });

  test('on Browse, whose header is inside <main>, lands before the Filters button', async ({page}) => {
    await page.goto('/browse');
    await expect(page.getByRole('heading', {name: /browse cards/i})).toBeVisible();

    await skipPastHeader(page);
    await expect(page.getByRole('button', {name: 'Filters', exact: true})).toBeFocused();
  });

  test('on a card page, whose header is outside <main>', async ({page}) => {
    await page.goto('/card/3286');
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();

    await skipPastHeader(page);
  });
});

// Runs on every project at a forced phone width: a phone has no header, so nothing to skip.
test('a phone has no skip link', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/browse');
  await expect(page.getByTestId('card-tile').first()).toBeVisible();

  await expect(skipLink(page)).toHaveCount(0);
});
