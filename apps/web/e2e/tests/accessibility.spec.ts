import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import AxeBuilder from '@axe-core/playwright';
import {startClockInRevealSeason} from '../helpers/revealSeason';
import {LAYOUT} from 'inkweave-ui/tokens/theme';

test.describe('Accessibility — axe audits', () => {
  // Desktop-only — mobile viewports have different layouts tested elsewhere
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({appPage: _}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
  });

  test('home page should have no axe violations', async ({appPage, page}) => {
    await appPage.goto();
    await expect(appPage.heroSection).toBeVisible();

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  test('browse page should have no axe violations', async ({page}) => {
    await page.goto('/browse');
    await page.getByRole('heading', {name: /browse cards/i}).waitFor();

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  test('card detail page should have no axe violations', async ({page}) => {
    // #486: /card/:id is a real, crawlable page (was a modal overlay). Wait for the synergy
    // results section to render before auditing the whole page, and for the footer, which
    // mounts only once the synergies have loaded (#532): axe should always audit it.
    await page.goto('/card/1939');
    await page.locator('section[aria-label="Synergy results"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });
    await page.locator('footer[aria-label="Site footer"]').waitFor({timeout: 10000});

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  test('playstyle gallery should have no axe violations', async ({page}) => {
    await page.goto('/playstyles');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  test('playstyle detail should have no axe violations', async ({page}) => {
    await page.goto('/playstyles/discard');
    // The guide comes in the cards' render, so axe audits the loaded page, guide included (#995).
    await page.waitForSelector('#playstyle-guide-heading');

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  /**
   * The ink pages (#530) were added with no axe coverage, and a contrast violation on the
   * gallery's card-count text survived a full CI round because of it — textDim at
   * FONT_SIZES.xs measures 3.07 against COLORS.surface, below WCAG AA's 4.5:1. Every new
   * indexable route belongs here: a page nobody audits is a page whose regressions ship.
   */
  test('ink gallery should have no axe violations', async ({page}) => {
    await page.goto('/inks');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  test('ink hub should have no axe violations', async ({page}) => {
    await page.goto('/ink/steel');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  // The in-depth vote page had no title and no h1 (accessibility check, 2026-10-19, #835).
  // 3286 and 2983 are the Free Play pair that check audits.
  test('in-depth vote page should have no axe violations', async ({page}) => {
    await page.goto('/vote/3286/2983');
    await expect(page.getByRole('radio', {name: 'Yes'})).toBeVisible({timeout: 15000});

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  // A franchise's cards on Reveals: the spotlight tiles' labels left out their visible text,
  // and the dialog's title bar added a second banner (#835). The clock starts in the reveal
  // season, so the page shows whatever the date.
  test('reveals page with a franchise open should have no axe violations', async ({page}) => {
    test.skip(!(await startClockInRevealSeason(page)), 'previewCards.json has no dated reveal set.');
    await page.goto('/reveals');
    const tile = page.getByRole('button', {name: /View cards$/}).first();
    const franchise = ((await tile.locator('h3').textContent()) ?? '').trim();
    await tile.click();

    const modal = page.getByRole('dialog', {name: `${franchise} cards`, exact: true});
    // Until its fade ends, the dialog's text measures against a half-drawn panel.
    await expect(modal).toHaveCSS('opacity', '1', {timeout: 15000});
    // The audit is for the dialog's cards, so it waits for them rather than auditing without.
    await expect(modal.getByTestId('card-tile').first()).toBeVisible({timeout: 10000});

    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });
});

/**
 * WCAG 1.4.10 Reflow (accessibility check, 2026-10-19): a 320px viewport (a 1280px screen at
 * 400% zoom) must not scroll sideways. The ink pages rendered the desktop header on phones, and
 * its nav ran off the edge, Reveals pill first: the clock starts in the reveal season so the pill
 * shows whatever the date. The viewport is set in each test, so it runs on every project, the
 * chromium-only pre-push included. Desktop WebKit draws a classic scrollbar, so there the page must
 * fit in the 312px beside it: body's `min-width: 320px` made it 8px too wide.
 */
test.describe('Accessibility: reflow at 320px', () => {
  // Each page with the items of its grid: the ink cards, and the ink's card tiles.
  const PAGES = [
    {path: '/inks', items: 'main ul > li'},
    {path: '/ink/steel', items: 'main [data-testid="card-tile"]'},
  ];
  for (const {path, items: itemSelector} of PAGES) {
    test(`${path} fits a 320px viewport without scrolling sideways`, async ({page}) => {
      await page.setViewportSize({width: 320, height: 640});
      await startClockInRevealSeason(page);
      await page.goto(path);
      // Waiting for the grid's items also keeps the edge check below from passing on no items.
      const items = page.locator(itemSelector);
      await expect(items.first()).toBeVisible();

      // Against documentElement.clientWidth, as the other sideways-scroll checks are: on the phone
      // projects innerWidth widens to fit whatever sticks out, and on mobile-safari the visual
      // viewport measures 8px narrower than the layout one.
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        inner: window.innerWidth,
        visual: window.visualViewport!.width,
      }));
      expect(widths.scroll, JSON.stringify(widths)).toBeLessThanOrEqual(widths.client);

      // Nor may the grid's items run past its edge into the page's gutter: the ink cards' 300px
      // columns did, ending flush with the screen's edge, so the page itself never scrolled.
      const strays = await items.evaluateAll(
        (els) =>
          els.filter((item) => {
            const grid = item.parentElement!;
            // A scroller's items may sit past its edge.
            if (getComputedStyle(grid).overflowX !== 'visible') return false;
            return item.getBoundingClientRect().right > grid.getBoundingClientRect().right + 0.5;
          }).length,
      );
      expect(strays).toBe(0);
    });
  }
});

/**
 * The card that has focus (its link and name), and whether it shows in the grid's scroller; null
 * once focus has left the grid. Read two frames on: focus scrolls the grid at once, but the
 * scroll event that draws the rows past the new view fires at the next frame. A person's presses
 * always leave it that frame; Playwright's come faster. One call waits and reads: each call is a
 * round trip, and WebKit's take about 370ms a press in CI.
 */
function focusedCard(page: Page) {
  return page.evaluate(async () => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const tile = document.activeElement?.closest('[data-testid="card-tile"]');
    const scroller = tile?.closest('[data-testid="browse-grid-scroller"]');
    if (!tile || !scroller) return null;
    const t = tile.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    return {
      card: `${tile.getAttribute('href')} ${tile.getAttribute('aria-label')}`,
      inView: t.bottom > s.top && t.top < s.bottom,
    };
  });
}

/**
 * Presses `key` from the focused card until focus leaves the grid: the cards it landed on, and
 * those of them out of view.
 */
async function walkCards(page: Page, key: string) {
  const cards: string[] = [];
  const hidden: string[] = [];
  for (let focused = await focusedCard(page); focused; focused = await focusedCard(page)) {
    // Chromium takes focus out of the page at a press past its last link; Playwright's Firefox
    // leaves focus on that link. Either ends the walk.
    if (focused.card === cards.at(-1)) break;
    cards.push(focused.card);
    if (!focused.inView) hidden.push(focused.card);
    if (cards.length > LAYOUT.maxDisplayedCards) break;
    await page.keyboard.press(key);
  }
  return {cards, hidden};
}

/**
 * Keyboard access to Browse's cards (WCAG 2.1.1): the grid draws only the rows near its view, so
 * Tab must keep finding cards past them. Under react-virtuoso focus left the grid after the rows
 * on screen (15 cards at 1440×900) and fell to the page itself. The grid now draws a row past
 * each edge, and focusing a card scrolls it into view, which draws the next row (#931).
 */
test.describe('Accessibility: keyboard', () => {
  test("Tab walks Browse's cards to the last one shown, and Shift+Tab walks back", async ({
    page,
  }) => {
    // About 400 presses, each followed by two frames: WebKit's take 2.5 minutes in CI.
    test.setTimeout(240_000);
    await page.goto('/browse');
    await page.getByTestId('card-tile').first().focus();

    // Tab lands on each card in turn, every one in view, until focus leaves the last one.
    const forward = await walkCards(page, 'Tab');
    expect(forward.cards).toHaveLength(LAYOUT.maxDisplayedCards);
    expect(new Set(forward.cards).size).toBe(LAYOUT.maxDisplayedCards);
    expect(forward.hidden).toEqual([]);

    // Shift+Tab comes back to the last card and walks back through them all to the first. In
    // Firefox the press past the last card left focus on it, so the walk starts there.
    if ((await focusedCard(page))?.card !== forward.cards.at(-1)) {
      await page.keyboard.press('Shift+Tab');
    }
    const back = await walkCards(page, 'Shift+Tab');
    expect(back.cards).toEqual([...forward.cards].reverse());
    expect(back.hidden).toEqual([]);
  });
});
