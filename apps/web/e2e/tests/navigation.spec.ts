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
    // Desktop-only by design: CompactHeader returns null on mobile, so the header
    // cannot carry this there. Mobile's entry point is /decks, covered below.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const header = page.getByTestId('compact-header');

    // Two unrelated pages, to prove it is the header carrying this and not the page.
    for (const path of ['/browse', '/playstyles']) {
      await page.goto(path);
      await expect(header.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    }
  });

  // REMOVED 2026-08-02, and worth knowing why rather than wondering later. This
  // guarded the /decks account panel, which was mobile's only sign-in path after
  // 7dfb4dd3 moved auth into the desktop-only header. The owner removed that panel
  // deliberately, so the behaviour it guarded no longer exists and the test would
  // assert a feature that was cut, not a regression.
  //
  // The hole it covered is REAL and now open again: on mobile there is no way to
  // sign in or out anywhere in the app. Restore a guard here the moment mobile auth
  // finds a home, because the desktop test above skips mobile precisely where the
  // gap is.
});
