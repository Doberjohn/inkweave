import {test, expect} from '@playwright/test';

test.describe('Reveals page (flag on)', () => {
  test.beforeEach(async ({page}, testInfo) => {
    // Clear the daily-dismiss key so the promo modal reliably appears.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('inkweave:reveals-modal-dismissed');
      } catch {
        /* ignore */
      }
    });
    testInfo.annotations.push({type: 'requires', description: 'VITE_IS_REVEAL_SEASON=true'});
  });

  test('renders hero and franchise tiers at /reveals', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');

    await expect(page.getByRole('heading', {name: /Toy Story/i})).toBeVisible();
    await expect(page.getByRole('heading', {name: /The Incredibles/i})).toBeVisible();
    await expect(page.getByRole('heading', {name: /Brave/i})).toBeVisible();
    await expect(page.getByRole('heading', {name: /Returning franchises/i})).toBeVisible();
  });

  test('desktop nav shows Reveals entry with NEW badge', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    // Home page uses a hero-first layout without the CompactHeader nav pill.
    // Navigate to a standard page to verify the nav entry.
    await page.goto('/browse');
    const mainNav = page.getByRole('navigation', {name: 'Main navigation'});
    const revealsLink = mainNav.getByRole('link', {name: /Reveals/i});
    await expect(revealsLink).toBeVisible();
    await expect(revealsLink.getByText('NEW')).toBeVisible();
  });

  test('mobile nav shows elevated Reveals button', async ({page}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/browse');
    const mobileNav = page.getByRole('navigation', {name: 'Mobile navigation'});
    const revealsLink = mobileNav.getByRole('link', {name: 'Reveals', exact: true});
    await expect(revealsLink).toBeVisible();
  });

  test('promo modal appears on landing page and not on /reveals', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/');
    await expect(
      page.getByRole('complementary', {name: /Set 12 reveals/i}),
    ).toBeVisible();

    await page.goto('/reveals');
    await expect(
      page.getByRole('complementary', {name: /Set 12 reveals/i}),
    ).toHaveCount(0);
  });

  test('tier card click navigates to /card/:id', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');
    const firstTile = page.getByTestId('card-tile').first();
    await expect(firstTile).toBeVisible();
    await firstTile.click();
    await expect(page).toHaveURL(/\/card\/[^/]+/);
  });
});
