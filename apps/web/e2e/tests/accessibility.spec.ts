import {test, expect} from '../fixtures';
import AxeBuilder from '@axe-core/playwright';
import {startClockInRevealSeason} from '../helpers/revealSeason';

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
    await page.waitForSelector('h1');

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
    await modal
      .getByTestId('card-tile')
      .first()
      .waitFor({timeout: 5000})
      .catch(() => {});

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
