import {test, expect} from '../fixtures';

test.describe('Desktop nav', () => {
  test('Decks is reachable from the main nav', async ({page}, testInfo) => {
    // Desktop-only: mobile uses MobileBottomNav, which already had a Decks tab.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    // Home uses a hero-first layout with no CompactHeader; use a standard page.
    await page.goto('/browse');

    const mainNav = page.getByRole('navigation', {name: 'Main navigation'});
    const decksLink = mainNav.getByRole('link', {name: 'Decks', exact: true});
    await expect(decksLink).toBeVisible();

    await decksLink.click();
    await expect(page).toHaveURL(/\/decks$/);
  });
});
