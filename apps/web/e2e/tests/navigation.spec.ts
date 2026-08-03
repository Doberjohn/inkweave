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

  test('mobile can reach sign-in from /decks', async ({page}, testInfo) => {
    // The regression guard for 7dfb4dd3, which moved auth into CompactHeader and
    // so deleted mobile's only sign-in path. The header test above cannot catch
    // that, because it skips mobile precisely where the hole was.
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/decks');
    await expect(page.getByTestId('compact-header')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
  });
});
