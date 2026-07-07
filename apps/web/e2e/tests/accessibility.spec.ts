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
    await page.goto('/card/1939');
    // The CardOverviewModal opens with a 200ms opacity-fade-in transition. If axe runs mid-
    // transition, it computes effective text colors against a partially-transparent background
    // (text gold rgb(212,175,55) at opacity 0.05 ≈ #111015 on bg #0d0d14 — fails 4.5:1). Wait
    // for the modal's opacity to be fully 1 before running axe.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="card-overview-modal"]');
      return !!el && getComputedStyle(el).opacity === '1';
    }, {timeout: 5000});

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
});
