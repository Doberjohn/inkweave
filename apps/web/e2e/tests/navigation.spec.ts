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
    // cannot carry this there. Mobile's entry point is /decks, guarded below.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const header = page.getByTestId('compact-header');

    // Two unrelated pages, to prove it is the header carrying this and not the page.
    for (const path of ['/browse', '/playstyles']) {
      await page.goto(path);
      await expect(header.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    }
  });

  test('/decks does not double up on the header sign-in control', async ({page}, testInfo) => {
    // The counterpart to the mobile test below. /decks renders its OWN control on
    // the viewports the header abandons, so the failure mode worth guarding is the
    // two of them appearing together. Both gate on headerCarriesAuth, which is what
    // makes that unreachable; this asserts it stays unreachable.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/decks');
    await expect(page.getByRole('button', {name: 'Sign in', exact: true})).toHaveCount(1);
    await expect(
      page.getByTestId('compact-header').getByRole('button', {name: 'Sign in', exact: true}),
    ).toBeVisible();
  });
});

test.describe('Mobile chrome', () => {
  // Restores the guard removed 2026-08-02. That one covered the DeckAccountPanel,
  // which the owner cut; mobile then had no sign-in anywhere until the 2026-08-05
  // ruling put one button on /decks. Same hole, different mechanism, so the test is
  // rewritten rather than reverted.
  test('/decks carries the only mobile sign-in control', async ({page}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/decks');
    await expect(page.getByTestId('compact-header')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
  });

  test('ink hubs do not paint the desktop header on a phone', async ({page}, testInfo) => {
    // InkGalleryPage and InkHubPage rendered <CompactHeader> with no isMobile prop.
    // The prop is optional and the guard is truthiness-based, so undefined read as
    // desktop: the 70px bar painted over the mobile bottom nav with its centered
    // nav overlapping the logo. Two of eighteen call sites, found only by measuring.
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();

    for (const path of ['/inks', '/ink/steel']) {
      await page.goto(path);
      await expect(page.getByTestId('compact-header')).toHaveCount(0);
    }
  });
});
