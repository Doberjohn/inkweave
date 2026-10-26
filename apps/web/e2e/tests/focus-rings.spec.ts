import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';

// Focus you can see (WCAG 2.4.13). The header nav's control clips the global outline
// (`overflow: hidden`), so its links draw the inset ring on `::after`, and its end links round
// their outer corners to the control's, so the ring closes there. Browse's search and Sort
// draw `GOLD_GLOW.focusRing`, a solid 2 px gold ring, as every search field and Sort menu does.

const GOLD = 'rgb(255, 185, 0)';

/**
 * Focuses `target` from the keyboard, so `:focus-visible` matches: Shift+Tab off it, then Tab
 * back, which works wherever it sits in the Tab order.
 */
async function tabTo(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

test.describe('Focus rings on Browse', () => {
  test.beforeEach(async ({page}, testInfo) => {
    // The header nav and the toolbar's Sort render on a desktop only.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto('/browse');
    await expect(page.getByRole('heading', {name: /browse cards/i})).toBeVisible();
  });

  test("the header nav's Browse link draws its ring inside, on all four sides", async ({page}) => {
    const link = page
      .getByRole('navigation', {name: 'Main navigation'})
      .getByRole('link', {name: 'Browse', exact: true});
    await tabTo(page, link);

    const sides = await link.evaluate((el) => {
      const after = getComputedStyle(el, '::after');
      return ['top', 'right', 'bottom', 'left'].map((side) =>
        ['width', 'style', 'color'].map((part) => after.getPropertyValue(`border-${side}-${part}`)).join(' '),
      );
    });
    expect(sides).toEqual(Array(4).fill(`2px solid ${GOLD}`));
  });

  test("the header nav's end links round their rings to the control's corners", async ({page}) => {
    const control = page
      .getByRole('navigation', {name: 'Main navigation'})
      .getByRole('link', {name: 'Browse', exact: true})
      .locator('..');
    // The control clips its links inside its border, so its corner radius less its border.
    const clip = await control.evaluate((el) => {
      const style = getComputedStyle(el);
      return `${parseFloat(style.borderTopLeftRadius) - parseFloat(style.borderTopWidth)}px`;
    });
    expect(clip).not.toBe('0px');

    const ends = [
      {link: control.getByRole('link').first(), corners: ['top-left', 'bottom-left']},
      {link: control.getByRole('link').last(), corners: ['top-right', 'bottom-right']},
    ];
    for (const {link, corners} of ends) {
      await tabTo(page, link);
      const radii = await link.evaluate(
        (el, names) =>
          names.map((name) =>
            getComputedStyle(el, '::after').getPropertyValue(`border-${name}-radius`),
          ),
        corners,
      );
      expect(radii).toEqual([clip, clip]);
    }
  });

  test("Browse's search and its Sort menu draw a solid 2 px gold ring", async ({page}) => {
    for (const control of [page.getByTestId('browse-search'), page.getByRole('combobox', {name: 'Sort cards'})]) {
      await tabTo(page, control);
      // Retried: the ring fades in over the field's box-shadow transition.
      await expect(control).toHaveCSS('box-shadow', /^rgb\(255, 185, 0\) 0px 0px 0px 2px,/);
    }
  });
});
