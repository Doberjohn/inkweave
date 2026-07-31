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

  test('the header carries a sign-in control on every page', async ({page}, testInfo) => {
    // Desktop-only: CompactHeader returns null on mobile, where auth has no entry
    // point yet (recorded gap in the header-auth design doc).
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const header = page.getByTestId('compact-header');

    // Two unrelated pages, to prove it is the header carrying this and not the page.
    for (const path of ['/browse', '/playstyles']) {
      await page.goto(path);
      await expect(header.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    }
  });
});
