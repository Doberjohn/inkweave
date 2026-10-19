import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {cardFullNameById, cardPromoCodes, cardVariantRarities} from '../helpers/cardData';

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

// Card 1949 (Mickey Mouse - True Friend) has four promo printings (#805), the most of any card.
// Its 25/P1 shows the owner's scan, which the app serves itself, so its art can be waited on.
const PROMO_CARD_ID = '1949';
const PROMO_CARD_NAME = cardFullNameById(PROMO_CARD_ID);
const PROMO_CODES = ['25/P1', '15/P2', '36/P2', '10/P3'];
if (cardPromoCodes(PROMO_CARD_ID).join() !== PROMO_CODES.join()) {
  throw new Error(
    `Fixture broken: card ${PROMO_CARD_ID} must have the promo printings ${PROMO_CODES.join(', ')} ` +
      `(found: ${cardPromoCodes(PROMO_CARD_ID).join(', ') || 'none'}).`,
  );
}

/** Which slide a card's printings strip is on: the fixture card's, unless another is named. */
const slideShown = (page: Page, name = CARD_NAME) =>
  page
    .getByRole('group', {name: `${name} printings`})
    .evaluate((strip) => Math.round(strip.scrollLeft / strip.clientWidth));

/**
 * Gives the fixture card an Epic and an Iconic printing too, borrowing two real variants' art:
 * Mr. Incredible - Super Strong is the first card with two alternate printings (#796), and the
 * switcher must hold four.
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
    // The dialog moves focus to its × 100ms after opening, which would take the focus back from
    // the pills mid-test. A 100ms timer set now runs after that one (timers run in due-time
    // order). Waiting for the × to be focused is no good: headless WebKit has not started the
    // enter transition by then, so the dialog is still hidden and the call does nothing.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));

    const standard = modal.getByRole('radio', {name: 'Standard'});
    await expect(standard).toBeVisible();
    await standard.focus();
    await page.keyboard.press('ArrowRight');

    await expect(modal.getByRole('radio', {name: 'Enchanted'})).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(modal.getByRole('radio', {name: 'Enchanted'})).toBeFocused();
    await expect(modal.locator('h1')).toHaveText(CARD_NAME);
  });

  test("a card's promo printings follow its Standard, each by its printed code, and one picked shows its art", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(`/card/${PROMO_CARD_ID}`);
    const pills = page.getByRole('radiogroup', {name: 'Card printing'});
    await expect(pills.getByRole('radio')).toHaveCount(5, {timeout: 10000});
    // A promo's chip is named "Promo" and its code (#802); Standard goes by its text.
    const names = await pills
      .getByRole('radio')
      .evaluateAll((radios) => radios.map((radio) => radio.getAttribute('aria-label') ?? radio.textContent));
    expect(names).toEqual(['Standard', ...PROMO_CODES.map((code) => `Promo ${code}`)]);

    const scanned = pills.getByRole('radio', {name: 'Promo 25/P1'});
    await scanned.click();
    await expect(scanned).toHaveAttribute('aria-checked', 'true');
    await expect(pills.getByRole('radio', {checked: true})).toHaveCount(1);
    await expect.poll(() => slideShown(page, PROMO_CARD_NAME)).toBe(1);
    const art = page.getByRole('img', {name: `${PROMO_CARD_NAME}, 25/P1 printing`}).first();
    await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });
});

test.describe('Card printings (phone width)', () => {
  // Runs on every project, not just mobile-*: isMobile is width-based (useResponsive), so a forced
  // phone viewport renders the mobile layout anywhere, including the chromium-only Windows pre-push.
  test('four printings fit a 360px phone without widening it, and jumping to the last checks only it', async ({
    page,
  }) => {
    await page.setViewportSize({width: 360, height: 740});
    await withFourPrintings(page);
    await page.goto(`/card/${CARD_ID}`);

    const pills = page.getByRole('radiogroup', {name: 'Card printing'});
    await expect(pills.getByRole('radio')).toHaveCount(4, {timeout: 10000});
    // Every chip names its printing beside its symbol, however many there are (#802): the row
    // wraps instead of shrinking to symbols.
    const epic = pills.getByRole('radio', {name: 'Epic'});
    await expect(epic).toHaveText('Epic');
    await expect
      .poll(() => epic.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

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
        // The visible name: a chase rarity's chip carries no aria-label of its own (#802).
        const checked = row.querySelector('[aria-checked="true"]')?.textContent ?? '';
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
