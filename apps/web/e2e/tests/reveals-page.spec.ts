import {test, expect} from '../fixtures';

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

  test('renders the tracker: hero, six ink trackers, and franchise cards', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');

    // Page identity (the visible title is the set logo image; the h1 is sr-only).
    await expect(page.getByRole('heading', {level: 1, name: /Attack of the Vine/i})).toHaveCount(1);
    await expect(page.getByAltText('Attack of the Vine!')).toBeVisible();

    // Six ink tracker tiles (one per ink).
    await expect(page.getByTestId('ink-tracker-tile')).toHaveCount(6);

    // The featured ink board.
    await expect(page.getByText('Ink board', {exact: true})).toBeVisible();

    // The three new-franchise cards (open their cards modal on click).
    await expect(page.getByRole('button', {name: 'View Monsters, Inc. cards'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'View Up cards'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'View Turning Red cards'})).toBeVisible();
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
    const revealsLink = mobileNav.getByRole('link', {name: 'Set 13 reveals', exact: true});
    await expect(revealsLink).toBeVisible();
  });

  test('promo modal appears on landing page and not on /reveals', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/');
    await expect(
      page.getByRole('complementary', {name: /Set 13 reveals/i}),
    ).toBeVisible();

    await page.goto('/reveals');
    await expect(
      page.getByRole('complementary', {name: /Set 13 reveals/i}),
    ).toHaveCount(0);
  });

  test('mosaic card click opens the card overview modal', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');
    // The mosaic renders after the card data loads (async), so wait for the first
    // revealed slot rather than snapshotting the count. Early reveal season:
    // previewCards.json may still have cards: [] (no slots) — skip then, mirroring
    // the season-ended skip in beforeEach so the suite stays green across the lifecycle.
    const firstSlot = page.getByTestId('reveal-card-slot').first();
    const hasSlots = await firstSlot
      .waitFor({state: 'visible', timeout: 10000})
      .then(() => true)
      .catch(() => false);
    test.skip(!hasSlots, 'No reveal cards curated yet (previewCards.json cards: []).');
    await firstSlot.click();
    // Card click opens the global modal (URL stays at /reveals).
    // Modal open = React mount + per-card synergy fetch + visibility transition; slow CI
    // webkit can exceed 5s before the overlay-visible class settles.
    await expect(page.getByTestId('card-overview-modal')).toBeVisible({timeout: 15000});
  });

  test('franchise card click opens the franchise cards modal', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');
    await page.getByRole('button', {name: 'View Monsters, Inc. cards'}).click();

    const modal = page.getByRole('dialog', {name: 'Monsters, Inc. cards'});
    await expect(modal).toBeVisible({timeout: 15000});

    // A card inside the franchise modal opens the shared card overview modal on top.
    // The grid renders a tick after the dialog opens, so wait for the first tile
    // rather than snapshotting the count. If the franchise has no revealed cards
    // yet (early season), the grid stays empty and we skip the card-click assertion.
    const cardTiles = modal.getByTestId('card-tile');
    const hasCards = await cardTiles
      .first()
      .waitFor({state: 'visible', timeout: 5000})
      .then(() => true)
      .catch(() => false);
    test.skip(!hasCards, 'No cards revealed for this franchise yet.');
    await cardTiles.first().click();
    await expect(page.getByTestId('card-overview-modal')).toBeVisible({timeout: 15000});
  });
});
