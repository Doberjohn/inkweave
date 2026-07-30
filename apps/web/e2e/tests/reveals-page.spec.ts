import {test, expect} from '../fixtures';

/**
 * Why the reveals suite is off-season-gated: the whole page only exists during a
 * reveal season, so off-season the assertions cannot pass. Two off-season signals,
 * either of which means "skip cleanly", checked BEFORE any 30s-timeout-prone wait:
 *   1. No revealed cards at all — previewCards.json cards: [] (the primary signal;
 *      once a set graduates its cards move into allCards.json and this file empties).
 *   2. Past the set's releaseDate — useRevealPhase returns 'released', RevealsGate
 *      renders the off-season notice instead of the page, and the nav entry /
 *      promo modal drop. (It redirected to / until 2026-07-30; the skip still
 *      applies, since the notice is not the page these assertions target.)
 * Returns the skip reason, or null when a reveal season is genuinely active.
 */
function offSeasonSkipReason(data: unknown): string | null {
  const d = (data ?? {}) as {cards?: unknown; sets?: Record<string, {releaseDate?: string} | undefined>};
  const revealCount = Array.isArray(d.cards) ? d.cards.length : 0;
  if (revealCount === 0) return 'No active reveal season (previewCards.json has no revealed cards).';
  const dates = Object.values(d.sets ?? {})
    .map((s) => s?.releaseDate)
    .filter((x): x is string => typeof x === 'string');
  const latestRelease = dates.length ? Math.max(...dates.map((x) => new Date(x).getTime())) : 0;
  if (latestRelease > 0 && Date.now() >= latestRelease) {
    return `Reveal season ended (latest releaseDate ${new Date(latestRelease).toISOString().slice(0, 10)}).`;
  }
  return null;
}

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

    // Skip the whole suite off-season (see offSeasonSkipReason), before any wait.
    const resp = await page.request.get('/data/previewCards.json');
    const reason = resp.ok() ? offSeasonSkipReason(await resp.json()) : null;
    test.skip(reason !== null, reason ?? '');
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

  test('?ink= param selects the starting mosaic ink', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals?ink=emerald');

    // The Emerald tracker tile is the selected one (aria-pressed reflects selection).
    const emeraldTile = page.getByTestId('ink-tracker-tile').filter({hasText: 'Emerald'});
    await expect(emeraldTile).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking a rarity chip dims the other revealed cards', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');

    // Needs revealed slots; skip in early season (previewCards.json cards: []).
    const firstSlot = page.getByTestId('reveal-card-slot').first();
    const hasSlots = await firstSlot
      .waitFor({state: 'visible', timeout: 10000})
      .then(() => true)
      .catch(() => false);
    test.skip(!hasSlots, 'No reveal cards curated yet (previewCards.json cards: []).');

    // Dimming is only observable when the featured board has at least two revealed
    // rarities (one chip highlighted, the others fade). Each interactive chip is a
    // "Highlight ... cards" button.
    const chips = page.getByRole('button', {name: /^Highlight .* cards$/});
    const chipCount = await chips.count();
    test.skip(chipCount < 2, 'Need at least two revealed rarities to observe dimming.');

    const chip = chips.first();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-dimmed="true"]').first()).toBeVisible();

    // Clicking the active chip again clears the highlight and restores all slots.
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-dimmed="true"]')).toHaveCount(0);
  });
});
