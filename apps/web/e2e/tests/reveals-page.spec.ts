import {test, expect} from '../fixtures';
import {startClockInRevealSeason, type RevealSet} from '../helpers/revealSeason';

/** A debut franchise's spotlight tile: an action button named by its text, ending "View cards". */
const FRANCHISE_BUTTON = /View cards$/;

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

    // The page's clock starts inside the reveal season, so these reveal-season-only
    // assertions run on any date, release day and the gap before the next season included.
    const set = await startClockInRevealSeason(page);
    if (!set) {
      test.skip(true, 'previewCards.json has no dated reveal set.');
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

    // Two days before release the pre-release has passed, so the countdown runs to the store release.
    await expect(page.getByText('Until store release')).toBeVisible();

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

  test('on a phone, the page leaves room under the promo and scrolls focus clear of it', async ({page}) => {
    // WCAG 2.4.11 (accessibility check, 2026-10-19): the promo is fixed to the bottom of a phone
    // screen, and the footer's last link stayed under it, focused or scrolled to the end. Forced
    // to 390px so it runs on every project, the chromium-only pre-push included.
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('/');
    const promo = page.getByRole('complementary', {name: `Set ${revealSet.number} reveals`});
    await expect(promo).toBeVisible();
    const lastFooterLink = page.getByRole('contentinfo').getByRole('link').last();

    await expect(async () => {
      const promoHeight = await promo.evaluate((el) => (el as HTMLElement).offsetHeight);
      const scrollPadding = await page.evaluate(() => document.documentElement.style.scrollPaddingBottom);
      expect(scrollPadding).toBe(`${promoHeight}px`);
      // Focused from the top of the page, the link scrolls into view above the promo. Blurred
      // first, so a retry's focus() scrolls again.
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await lastFooterLink.focus();
      const link = (await lastFooterLink.boundingBox())!;
      // 1px for the rounding in offsetHeight.
      expect(link.y + link.height).toBeLessThanOrEqual((await promo.boundingBox())!.y + 1);
    }).toPass();
  });

  test('mosaic card click opens the card overview modal', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');
    // The mosaic renders after the card data loads (async), so wait for the first
    // revealed slot rather than snapshotting the count. Early reveal season:
    // previewCards.json may still have cards: [] (no slots), so skip then.
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

  test("the card modal's arrows step through the board's cards in mosaic order", async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');
    const slots = page.getByTestId('reveal-card-slot');
    const hasTwo = await slots
      .nth(1)
      .waitFor({state: 'visible', timeout: 10000})
      .then(() => true)
      .catch(() => false);
    test.skip(!hasTwo, 'Need two revealed cards on the board to page between them.');
    // The slots name their cards ("View <card>") in the order the board shows them.
    const second = ((await slots.nth(1).getAttribute('aria-label')) ?? '').replace(/^View /, '');
    await slots.first().click();

    const modal = page.getByTestId('card-overview-modal');
    await expect(modal).toBeVisible({timeout: 15000});
    // The arrows sit outside the dialog shell (in the frame), so query them at the page level.
    await page.getByRole('button', {name: 'Next card'}).click();
    await expect(modal.locator('h1')).toHaveText(second);
  });

  test('franchise card click opens the franchise cards modal', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/reveals');
    // The tile's heading names the franchise ("Coco"), and its modal is "<franchise> cards",
    // so the franchise is read off the page, not hardcoded. The heading sits inside the
    // button, whose children aren't exposed as roles, so it is found by its tag.
    const tile = page.getByRole('button', {name: FRANCHISE_BUTTON}).first();
    const franchise = ((await tile.locator('h3').textContent()) ?? '').trim();
    await tile.click();

    const modal = page.getByRole('dialog', {name: `${franchise} cards`, exact: true});
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
    // rarities (one chip highlighted, the others fade). Each chip is a kit toggle in
    // the "Highlight a rarity" group, one per rarity with revealed cards.
    const chips = page.getByRole('group', {name: 'Highlight a rarity'}).getByRole('button');
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

  test('an alt art opens the card modal on that printing', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    // Amber's lineup: 3 Epic, 3 Enchanted and an Iconic slot; skip until one is revealed.
    await page.goto('/reveals?ink=amber');
    const printing = page.getByTestId('reveal-printing-slot').first();
    const hasPrinting = await printing
      .waitFor({state: 'visible', timeout: 10000})
      .then(() => true)
      .catch(() => false);
    test.skip(!hasPrinting, 'No alt art revealed on the Amber board yet.');

    // The slot names its rarity ("View <card>, Enchanted alt art"); the modal must open on it.
    const label = (await printing.getAttribute('aria-label')) ?? '';
    const rarity = /, (Epic|Enchanted|Iconic) alt art$/.exec(label)?.[1] ?? '';
    expect(rarity).not.toBe('');
    await printing.click();

    const modal = page.getByTestId('card-overview-modal');
    await expect(modal).toBeVisible({timeout: 15000});
    // In front of the card's stack: the others sit behind it, inert.
    const inFront = modal.locator('[data-slide]:not([inert]) img').first();
    await expect(inFront).toHaveAttribute('alt', new RegExp(`, ${rarity} printing$`));
  });
});
