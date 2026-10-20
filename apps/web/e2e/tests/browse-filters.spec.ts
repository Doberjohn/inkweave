import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';

// Every other spec sets Browse's filters through the URL, so none presses a filter button. These
// press each kind and check what a shared link carries. Evasive (57 Core cards) and Hero (338) are
// among the commonest keyword and classification, so a new set won't take them away.

const panel = (page: Page) => page.getByRole('complementary', {name: 'Filters'});

/** Presses a filter in the docked panel and expects it pressed, with its param in the URL. */
async function press(page: Page, name: string, param: RegExp) {
  const button = panel(page).getByRole('button', {name, exact: true});
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(param);
}

/** Unfolds one of the panel's folded sections by its header. */
async function unfold(page: Page, label: string) {
  const header = panel(page).getByRole('button', {name: label, exact: true});
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}

test.describe('Browse filters picked in the desktop panel', () => {
  // At 1024px and wider the filters dock beside the cards, open, and apply at once.
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto('/browse');
    await expect(panel(page).getByRole('button', {name: 'Cost 1'})).toBeVisible({timeout: 10000});
  });

  test('an ink cost', async ({page}) => {
    await press(page, 'Cost 3', /[?&]cost=3(&|$)/);
  });

  test('Uninkable, which redraws the cost buttons as uninkable hexagons', async ({page}) => {
    const cost1 = panel(page).getByRole('button', {name: 'Cost 1'});
    await expect(cost1.locator('polygon')).toHaveCount(0);
    await press(page, 'Uninkable', /[?&]inkwell=uninkable(&|$)/);
    await expect(cost1.locator('polygon')).toHaveCount(1);
  });

  test('a rarity', async ({page}) => {
    await press(page, 'Legendary', /[?&]rarity=Legendary(&|$)/);
  });

  test('a card type, a keyword and a classification, each in its folded section', async ({page}) => {
    await unfold(page, 'Type');
    await press(page, 'Character', /[?&]type=Character(&|$)/);
    await unfold(page, 'Keyword');
    await press(page, 'Evasive', /[?&]keyword=Evasive(&|$)/);
    await unfold(page, 'Classification');
    await press(page, 'Hero', /[?&]classification=Hero(&|$)/);
  });

  test('an ink, then Dual-ink cards', async ({page}) => {
    await press(page, 'Filter by Amber', /[?&]ink=Amber(&|$)/);
    await press(page, 'Dual-ink cards', /[?&]inkmatch=dual(&|$)/);
  });

  test('with the panel closed, the active chips list the filters and one can be dismissed', async ({page}) => {
    await press(page, 'Cost 3', /[?&]cost=3(&|$)/);
    await unfold(page, 'Keyword');
    await press(page, 'Evasive', /[?&]keyword=Evasive(&|$)/);

    // The chips show only while the panel is closed: open, it already shows the same filters.
    await page.getByRole('button', {name: 'Filters', exact: true}).click();
    await expect(panel(page)).toHaveCount(0);
    const costChip = page.getByRole('button', {name: /^Cost: 3/});
    await expect(costChip).toBeVisible();
    await expect(page.getByRole('button', {name: /^Evasive/})).toBeVisible();

    await costChip.click();
    await expect(costChip).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]cost=/);
    await expect(page).toHaveURL(/[?&]keyword=Evasive(&|$)/);
  });
});

test.describe('Browse filters picked in the phone drawer', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto('/browse');
  });

  test('a pick applies only on Apply', async ({page}) => {
    await page.getByRole('button', {name: 'Filters', exact: true}).click();
    const drawer = page.getByRole('dialog', {name: 'Filters'});
    await drawer.getByRole('button', {name: 'Cost 3'}).click();
    await expect(drawer.getByRole('button', {name: 'Cost 3'})).toHaveAttribute('aria-pressed', 'true');
    await expect(page).not.toHaveURL(/[?&]cost=/);

    await drawer.getByRole('button', {name: 'Apply', exact: true}).click();
    await expect(page).toHaveURL(/[?&]cost=3(&|$)/);
    await expect(drawer).toHaveCount(0);
  });
});
