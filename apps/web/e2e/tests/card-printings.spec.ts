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

/** Which printing is in front of a card's stack: the fixture card's, unless another is named. */
const printingInFront = (page: Page, name = CARD_NAME) =>
  page
    .getByRole('group', {name: `${name} printings`})
    .evaluate((stack) => Number(stack.querySelector('[data-slide]:not([inert])')?.getAttribute('data-slide')));

/** Throws a card's stack aside with the mouse, as a finger swipes it: pressed, dragged left past a fifth of the card, let go. */
async function throwCard(page: Page, name = CARD_NAME) {
  const box = (await page.getByRole('group', {name: `${name} printings`}).boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - box.width / 2, y, {steps: 6});
  await page.mouse.up();
}

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

/**
 * The card window's art height, top and bottom, and its Next arrow's middle, measured once the
 * window has finished scaling in (it opens from 95%).
 */
async function windowGeometry(page: Page) {
  const modal = page.getByTestId('card-overview-modal');
  await expect
    .poll(() => modal.evaluate((el) => getComputedStyle(el).transform))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  const [art, shell, arrow] = await Promise.all([
    modal.locator('[data-comparison-card-a]').boundingBox(),
    modal.boundingBox(),
    page.getByRole('button', {name: 'Next card'}).boundingBox(),
  ]);
  return {
    art: Math.round(art!.height),
    top: Math.round(shell!.y),
    bottom: Math.round(shell!.y + shell!.height),
    // The arrow's middle, not its top edge. The arrow can open under the cursor that clicked the
    // card, and the button's hover boop (scale 1.03, then back) and press scale are scales about
    // its middle: caught mid-boop, the top edge reads up to 0.7px high, but the middle never moves.
    arrow: Math.round(arrow!.y + arrow!.height / 2),
  };
}

test.describe('Card printings (desktop)', () => {
  // The printings stack behind the card (owner, 2026-10-22: the pills under it went).
  test('the card page turns to the Enchanted printing from its peek, and enlarges that one', async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(`/card/${CARD_ID}`);
    const stack = page.getByRole('group', {name: `${CARD_NAME} printings`});
    await expect.poll(() => printingInFront(page), {timeout: 10000}).toBe(0);

    // A mouse resting near the card's side leans the Enchanted out from behind it, and a click
    // there turns to it. The turn names it on the card for a moment, beside its rarity symbol, a
    // separate file that must load: the notice's one image without a name of its own.
    const box = (await stack.boundingBox())!;
    const nearSide = {x: box.x + box.width - 30, y: box.y + box.height / 2};
    await page.mouse.move(nearSide.x, nearSide.y);
    await page.mouse.click(nearSide.x, nearSide.y);
    await expect.poll(() => printingInFront(page)).toBe(1);
    await expect
      .poll(() => stack.locator('img[alt=""]').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // Enlarging opens the printing in front, not the card's own scan.
    await page.getByRole('button', {name: 'Enlarge Enchanted printing'}).click();
    await expect(
      page.getByRole('dialog', {name: `Enlarged view of ${CARD_NAME}, Enchanted printing`}),
    ).toBeVisible();
  });

  // WCAG 2.1.1 (accessibility check, 2026-10-19): the card takes a tab stop, so its arrow keys
  // must turn it rather than page to the next card, even at its last printing, where the turns
  // loop to the first (owner, 2026-10-22).
  test("the modal's arrow keys turn a focused card's printings, not to the next card", async ({
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
    // the card mid-test. A 100ms timer set now runs after that one (timers run in due-time
    // order). Waiting for the × to be focused is no good: headless WebKit has not started the
    // enter transition by then, so the dialog is still hidden and the call does nothing.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));

    const stack = modal.getByRole('group', {name: `${CARD_NAME} printings`});
    await stack.focus();
    await expect(stack).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => printingInFront(page)).toBe(1);
    await page.keyboard.press('ArrowRight');

    await expect.poll(() => printingInFront(page)).toBe(0);
    await expect(stack).toBeFocused();
    await expect(modal.locator('h1')).toHaveText(CARD_NAME);
  });

  test("a card's promo printings follow its Standard, each by its printed code, one turned to shows its art, and the Standard follows the last", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(`/card/${PROMO_CARD_ID}`);
    const stack = page.getByRole('group', {name: `${PROMO_CARD_NAME} printings`});
    await expect.poll(() => printingInFront(page, PROMO_CARD_NAME), {timeout: 10000}).toBe(0);
    // Each peek names the printing it turns to: a promo by "Promo" and its code (#802).
    const next = stack.getByRole('button', {name: /^Next printing: /});
    const names: string[] = [];
    for (let turn = 1; turn <= PROMO_CODES.length; turn++) {
      names.push((await next.getAttribute('aria-label')) ?? '');
      await next.click();
      await expect.poll(() => printingInFront(page, PROMO_CARD_NAME)).toBe(turn);
      if (turn === 1) {
        const art = page.getByRole('img', {name: `${PROMO_CARD_NAME}, 25/P1 printing`});
        await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      }
    }
    expect(names).toEqual(PROMO_CODES.map((code) => `Next printing: Promo ${code}`));
    // The turns loop (owner, 2026-10-22): after the last printing comes the first.
    await expect(next).toHaveAccessibleName('Next printing: Standard');
    await next.click();
    await expect.poll(() => printingInFront(page, PROMO_CARD_NAME)).toBe(0);
  });

  // One art height for every card (owner, 2026-10-20), and now one window: no card has a row
  // under it that another lacks. Playwright's 1280x720 is too short for a full-size window, so
  // every card shrinks alike here.
  test("the card window draws every card's art one height, printings or not, and paging moves none of it (#826)", async ({
    appPage,
    page,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    // "father" matches four cards: the fixture card, with its printings, and three without.
    await page.goto('/browse?q=father');
    await page.getByRole('link', {name: CARD_NAME}).click();
    const modal = appPage.cardOverviewModal;
    const title = modal.locator('h1');
    await expect(title).toHaveText(CARD_NAME, {timeout: 10000});
    const printings = modal.getByRole('group', {name: /printings$/});
    await expect(printings).toHaveCount(1);
    const withPrintings = await windowGeometry(page);

    for (let step = 0; step < 3 && (await printings.count()) > 0; step++) {
      const shown = (await title.textContent()) ?? '';
      await page.getByRole('button', {name: 'Next card'}).click();
      await expect(title).not.toHaveText(shown);
    }
    await expect(printings, 'a "father" card without printings').toHaveCount(0);

    expect(await windowGeometry(page)).toEqual(withPrintings);
  });
});

test.describe('Card printings (phone width)', () => {
  // Runs on every project, not just mobile-*: isMobile is width-based (useResponsive), so a forced
  // phone viewport renders the mobile layout anywhere, including the chromium-only Windows pre-push.
  test('four printings stack behind a card on a 360px phone without widening it, and each throw turns one, round the loop', async ({
    page,
  }) => {
    await page.setViewportSize({width: 360, height: 740});
    await withFourPrintings(page);
    await page.goto(`/card/${CARD_ID}`);
    await expect.poll(() => printingInFront(page), {timeout: 10000}).toBe(0);

    // documentElement.clientWidth, not innerWidth: mobile emulation zooms out to fit an
    // overflowing page, which inflates innerWidth to the overflowed width.
    const fits = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(await fits()).toBe(true);

    // Each throw turns one printing, the one its peek offered, and the turn names it once. The
    // order is by collector number (#802), so it is read from the peek rather than assumed.
    const stack = page.getByRole('group', {name: `${CARD_NAME} printings`});
    const next = stack.getByRole('button', {name: /^Next printing: /});
    const status = stack.getByRole('status');
    const turnedTo: string[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      const name = ((await next.getAttribute('aria-label')) ?? '').replace('Next printing: ', '');
      await throwCard(page);
      await expect.poll(() => printingInFront(page)).toBe(turn);
      await expect(status).toHaveText(`${name}, ${turn + 1} of 4`);
      turnedTo.push(name);
    }
    expect([...turnedTo].sort()).toEqual(['Enchanted', 'Epic', 'Iconic']);
    // After the last printing comes the first (owner, 2026-10-22).
    await expect(next).toHaveAccessibleName('Next printing: Standard');
    await throwCard(page);
    await expect.poll(() => printingInFront(page)).toBe(0);
    await expect(status).toHaveText('Standard, 1 of 4');
    expect(await fits()).toBe(true);
  });
});
