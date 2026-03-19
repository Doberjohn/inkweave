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
    await page.goto('/card/1041');
    await page.waitForSelector('h1');

    const results = await new AxeBuilder({page}).exclude('[data-react-grab]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('card synergies page should have no axe violations', async ({page}) => {
    await page.goto('/card/1041/synergies');
    await page.waitForSelector('h1');

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
