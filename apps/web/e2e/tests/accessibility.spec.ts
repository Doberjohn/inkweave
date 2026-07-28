import {test, expect} from '../fixtures';
import AxeBuilder from '@axe-core/playwright';

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

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('browse page should have no axe violations', async ({page}) => {
    await page.goto('/browse');
    await page.getByRole('heading', {name: /browse cards/i}).waitFor();

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('card detail page should have no axe violations', async ({page}) => {
    // #486: /card/:id is a real, crawlable page (was a modal overlay). Wait for the synergy
    // results section to render before auditing the whole page.
    await page.goto('/card/1939');
    await page.locator('section[aria-label="Synergy results"]').waitFor({
      state: 'visible',
      timeout: 10000,
    });

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('playstyle gallery should have no axe violations', async ({page}) => {
    await page.goto('/playstyles');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('playstyle detail should have no axe violations', async ({page}) => {
    await page.goto('/playstyles/discard');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
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

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('ink hub should have no axe violations', async ({page}) => {
    await page.goto('/ink/steel');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
    expect(results.violations).toEqual([]);
  });
});
