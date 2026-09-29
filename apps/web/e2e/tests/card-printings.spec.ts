import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {cardFullNameById, cardVariantRarities} from '../helpers/cardData';

// Card 1938 (Pongo - Determined Father) has one alternate printing, an Enchanted one (#625).
// Read from the card data so a pool change fails here with a clear message, not a timeout.
const CARD_ID = '1938';
const CARD_NAME = cardFullNameById(CARD_ID);
if (cardVariantRarities(CARD_ID).join() !== 'Enchanted') {
  throw new Error(
    `Fixture broken: card ${CARD_ID} must have exactly one alternate printing, an Enchanted one ` +
      `(found: ${cardVariantRarities(CARD_ID).join(', ') || 'none'}).`,
  );
}

/** Which slide the printings strip is on. */
const slideShown = (page: Page) =>
  page
    .getByRole('group', {name: `${CARD_NAME} printings`})
    .evaluate((strip) => Math.round(strip.scrollLeft / strip.clientWidth));

/**
 * Gives the fixture card an Epic and an Iconic printing too, borrowing two real variants' art:
 * no card has had more than one alternate printing yet, but the switcher must hold four.
 */
async function withFourPrintings(page: Page) {
  await page.route('**/data/allCards.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const variants = data.cards.flatMap((c: {variants?: {rarity: string}[]}) => c.variants ?? []);
    const borrow = (rarity: string, id: number) => ({
      ...variants.find((v: {rarity: string}) => v.rarity === rarity),
      id,
    });
    const card = data.cards.find((c: {id: number}) => String(c.id) === CARD_ID);
    card.variants = [...card.variants, borrow('Epic', 990001), borrow('Iconic', 990002)];
    await route.fulfill({response, json: data});
  });
}

test.describe('Card printings (desktop)', () => {
  test('the card page switches to the Enchanted printing, and enlarges that one', async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(`/card/${CARD_ID}`);
    const pills = page.getByRole('radiogroup', {name: 'Card printing'});
    await expect(pills.getByRole('radio', {name: 'Standard'})).toHaveAttribute(
      'aria-checked',
      'true',
      {
        timeout: 10000,
      },
    );

    // The variant's pill carries its rarity symbol, a separate file that must load.
    const enchanted = pills.getByRole('radio', {name: 'Enchanted'});
    await expect
      .poll(() => enchanted.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    await enchanted.click();
    await expect(enchanted).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => slideShown(page)).toBe(1);

    // Enlarging opens the printing on show, not the card's own scan.
    await page.getByRole('button', {name: 'Enlarge Enchanted printing'}).click();
    await expect(
      page.getByRole('dialog', {name: `Enlarged view of ${CARD_NAME}, Enchanted printing`}),
    ).toBeVisible();
  });

  test("the modal's arrow keys move between printings, not to the next card", async ({
    appPage,
    page,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    // "father" matches four cards, so the modal has siblings the arrow keys would otherwise page to.
    await page.goto('/browse?q=father');
    await page.getByRole('link', {name: CARD_NAME}).click();
    const modal = appPage.cardOverviewModal;
    await expect(modal.locator('h1')).toHaveText(CARD_NAME, {timeout: 10000});
    await expect(page.getByRole('button', {name: 'Next card'})).toBeVisible();
    // The dialog moves focus to its × 100ms after opening; let it land first, or it can take
    // the focus back from the pills mid-test.
    await expect(modal.getByRole('button', {name: 'Close'})).toBeFocused();

    await modal.getByRole('radio', {name: 'Standard'}).focus();
    await page.keyboard.press('ArrowRight');

    await expect(modal.getByRole('radio', {name: 'Enchanted'})).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(modal.getByRole('radio', {name: 'Enchanted'})).toBeFocused();
    await expect(modal.locator('h1')).toHaveText(CARD_NAME);
  });
});

test.describe('Card printings (phone width)', () => {
  // Runs on every project, not just mobile-*: isMobile is width-based (useResponsive), so a forced
  // phone viewport renders the mobile layout anywhere, including the chromium-only Windows pre-push.
  test('four printings fit a 360px phone as symbols, and jumping to the last checks only it', async ({
    page,
  }) => {
    await page.setViewportSize({width: 360, height: 740});
    await withFourPrintings(page);
    await page.goto(`/card/${CARD_ID}`);

    const pills = page.getByRole('radiogroup', {name: 'Card printing'});
    await expect(pills.getByRole('radio')).toHaveCount(4, {timeout: 10000});
    // A row of three or more names each variant by its symbol alone, keeping the name for
    // assistive tech (and hover).
    const epic = pills.getByRole('radio', {name: 'Epic'});
    await expect(epic).toHaveAttribute('title', 'Epic');
    expect(await epic.textContent()).toBe('');

    // documentElement.clientWidth, not innerWidth: mobile emulation zooms out to fit an
    // overflowing page, which inflates innerWidth to the overflowed width.
    const layout = await pills.evaluate((row) => ({
      rowRight: row.getBoundingClientRect().right,
      pageScroll: document.documentElement.scrollWidth,
      pageClient: document.documentElement.clientWidth,
    }));
    expect(layout.rowRight).toBeLessThanOrEqual(layout.pageClient);
    expect(layout.pageScroll).toBeLessThanOrEqual(layout.pageClient);

    // The strip scrolls past Enchanted and Epic on its way to Iconic. Those slides must not be
    // taken for swipes: each would check its pill in passing and count as a view.
    await pills.evaluate((row) => {
      const seen: string[] = [];
      new MutationObserver(() => {
        const checked =
          row.querySelector('[aria-checked="true"]')?.getAttribute('aria-label') ?? '';
        if (seen[seen.length - 1] !== checked) seen.push(checked);
      }).observe(row, {subtree: true, attributeFilter: ['aria-checked']});
      (window as unknown as {checkedPills: string[]}).checkedPills = seen;
    });
    await pills.getByRole('radio', {name: 'Iconic'}).click();
    await expect.poll(() => slideShown(page)).toBe(3);
    expect(
      await page.evaluate(() => (window as unknown as {checkedPills: string[]}).checkedPills),
    ).toEqual(['Iconic']);
  });
});
