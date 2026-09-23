import {test, expect} from '../fixtures';

interface RevealSet {
  name: string;
  number: number;
  releaseDate: string;
}

/**
 * The set in reveal season: the previewCards.json entry with the latest
 * releaseDate. Read from the data the app itself reads, so this spec names no set
 * and needs no edit when a new season starts.
 */
/** A set block is usable here only once it carries the three fields the assertions read. */
function isRevealSet(set: Partial<RevealSet> | undefined): set is RevealSet {
  return (
    typeof set?.name === 'string' &&
    typeof set?.number === 'number' &&
    typeof set?.releaseDate === 'string'
  );
}

function latestRevealSet(data: {sets?: Record<string, Partial<RevealSet> | undefined>}): RevealSet | null {
  const dated = Object.values(data?.sets ?? {}).filter(isRevealSet);
  if (dated.length === 0) return null;
  return dated.reduce((a, b) => (new Date(b.releaseDate) > new Date(a.releaseDate) ? b : a));
}

/** A debut franchise's spotlight tile: an action button labelled "View <franchise> cards". */
const FRANCHISE_BUTTON = /^View .+ cards$/;

test.describe('Reveals page (flag on)', () => {
  let revealSet: RevealSet;

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
    const set = resp.ok() ? latestRevealSet(await resp.json()) : null;
    if (!set) {
      test.skip(true, 'previewCards.json has no dated reveal set.');
      return;
    }
    if (Date.now() >= new Date(set.releaseDate).getTime()) {
      test.skip(true, `Reveal season ended (latest releaseDate ${set.releaseDate})`);
      return;
    }
    revealSet = set;
  });

  test('renders the tracker: hero, six ink trackers, and the debut franchises', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');

    // Page identity (the visible title is the set logo image; the h1 is sr-only).
    await expect(page.getByRole('heading', {level: 1, name: revealSet.name})).toHaveCount(1);
    await expect(page.getByAltText(revealSet.name, {exact: true})).toBeVisible();

    // Six ink tracker tiles (one per ink).
    await expect(page.getByTestId('ink-tracker-tile')).toHaveCount(6);

    // The featured ink board.
    await expect(page.getByText('Ink board', {exact: true})).toBeVisible();

    // At least one debut-franchise card (each opens its cards modal on click).
    await expect(page.getByRole('button', {name: FRANCHISE_BUTTON}).first()).toBeVisible();
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
    const revealsLink = mobileNav.getByRole('link', {name: `Set ${revealSet.number} reveals`, exact: true});
    await expect(revealsLink).toBeVisible();
  });

  test('promo modal appears on landing page and not on /reveals', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const promo = page.getByRole('complementary', {name: `Set ${revealSet.number} reveals`});

    await page.goto('/');
    await expect(promo).toBeVisible();

    await page.goto('/reveals');
    await expect(promo).toHaveCount(0);
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
    // The tile's own label names the franchise ("View Coco cards"), and its modal
    // is "<franchise> cards", so the franchise is read off the page, not hardcoded.
    const tile = page.getByRole('button', {name: FRANCHISE_BUTTON}).first();
    const label = (await tile.getAttribute('aria-label')) ?? '';
    await tile.click();

    const modal = page.getByRole('dialog', {name: label.replace(/^View /, ''), exact: true});
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
