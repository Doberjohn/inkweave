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

    // Skip when reveal season has ended (today is past the set's releaseDate).
    // useRevealPhase returns 'released' once now >= releaseDate, RevealsGate
    // redirects /reveals -> /, and the Reveals nav entry / promo modal no
    // longer render — so these reveal-season-only assertions can't pass.
    // After each set graduates and previewCards.json is refreshed with the
    // NEXT set's dates, these tests pick back up automatically.
    const resp = await page.request.get('/data/previewCards.json');
    if (resp.ok()) {
      const data = await resp.json();
      const sets = (data?.sets ?? {}) as Record<string, {releaseDate?: string} | undefined>;
      const dates = Object.values(sets)
        .map((s) => s?.releaseDate)
        .filter((d): d is string => typeof d === 'string');
      const latestRelease = dates.length ? Math.max(...dates.map((d) => new Date(d).getTime())) : 0;
      if (latestRelease > 0 && Date.now() >= latestRelease) {
        test.skip(
          true,
          `Reveal season ended (latest releaseDate ${new Date(latestRelease).toISOString().slice(0, 10)})`,
        );
      }
    }
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

  test('mobile nav shows Reveals tab', async ({page}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/browse');
    const mobileNav = page.getByRole('navigation', {name: 'Mobile navigation'});
    // aria-label is the descriptive form after the Option B accessible-name refactor.
    const revealsLink = mobileNav.getByRole('link', {name: 'Set 12 reveals', exact: true});
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

  test('tier card click opens the card overview modal', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');
    const firstTile = page.getByTestId('card-tile').first();
    await expect(firstTile).toBeVisible();
    await firstTile.click();
    // Card click opens the global modal (URL stays at /reveals).
    // Modal open = React mount + per-card synergy fetch + visibility transition; slow CI
    // webkit can exceed 5s before the overlay-visible class settles.
    await expect(page.getByTestId('card-overview-modal')).toBeVisible({timeout: 15000});
  });
});
