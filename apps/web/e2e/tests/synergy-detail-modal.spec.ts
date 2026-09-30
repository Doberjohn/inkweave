import {test, expect} from '../fixtures';
import {cardFullNameById} from '../helpers/cardData';
import fs from 'node:fs';
import path from 'node:path';

// Daisy Duck - Musketeer Spy: has shift-targets (direct) + discard (playstyle) groups, so both
// the shift-targets tile and the discard tile (used by the re-entry test at L101) render.
const CARD_ID = '1947';
const CARD_NAME = cardFullNameById(CARD_ID);

// A real synergy partner of card 1947 + its group key, derived from the precomputed data so the
// /compare deep-link fixture survives Set 12+ pool drift. ComparePage 404s on a missing groupKey
// (engine score is rule-context-specific), so a valid deep link is /compare/A/B/groupKey.
const synergyData1947 = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/synergies', '1947.json'), 'utf8'),
) as {groups: {groupKey: string; synergies: {cardId: string}[]}[]};
const compareGroup1947 = synergyData1947.groups?.[0];
const COMPARE_PARTNER_ID = compareGroup1947?.synergies[0]?.cardId;
const COMPARE_GROUP_KEY = compareGroup1947?.groupKey;
if (!COMPARE_PARTNER_ID || !COMPARE_GROUP_KEY) {
  throw new Error('Fixture broken: card 1947 has no synergy group for the /compare deep-link test.');
}
const COMPARE_URL = `/compare/1947/${COMPARE_PARTNER_ID}/${COMPARE_GROUP_KEY}`;

/**
 * Comparison mode (formerly the separate synergy detail modal). Clicking a synergy card tile
 * inside CardOverviewModal transitions the modal in-place to comparison view: dimmed chip row,
 * cardA + cardB side-by-side via FLIP animation, BACK button replacing the title, and the
 * engine + community columns expanding underneath.
 */

test.describe('Synergy comparison — Desktop', () => {
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    // /card/:id is a real page now (#486); open the modal on the fixture card via Browse.
    await appPage.openCardOverview(CARD_NAME);
    // Wait for synergies to populate (chip filter buttons or empty state).
    const groupCount = appPage.cardOverviewModal.locator('[data-group-key]');
    const noSynergies = appPage.cardOverviewModal.getByTestId('card-overview-empty');
    await expect(groupCount.first().or(noSynergies)).toBeVisible({timeout: 10000});
  });

  test('should enter comparison mode when clicking a synergy card', async ({page, appPage}) => {
    // Click the first card tile in the shift-targets group inside the modal
    const firstTile = appPage.cardOverviewModal
      .locator('[data-group-key="shift-targets"] a.card-tile')
      .first();
    await expect(firstTile).toBeVisible({timeout: 5000});
    await firstTile.click();

    // Modal switches to comparison mode (BACK button replaces the h1 title slot)
    await expect(
      appPage.cardOverviewModal.getByRole('button', {name: /back to synergies/i}),
    ).toBeVisible({timeout: 3000});
    // URL stays on the originating Browse page — the in-app comparison flow doesn't push
    // /compare/*, so Browse stays mounted in <Outlet /> behind the modal backdrop.
    // (Deep-link flow still URL-syncs when switching pairs — see CardModalContext.)
    await expect(page).toHaveURL(/\/browse/);
  });

  test('should show engine column with rule explanations in comparison mode', async ({appPage}) => {
    const firstTile = appPage.cardOverviewModal
      .locator('[data-group-key="shift-targets"] a.card-tile')
      .first();
    await firstTile.click();

    // Engine column shows; shift-targets explanations mention "Shift"
    const engineSection = appPage.cardOverviewModal.locator('section[aria-label="Engine score"]');
    await expect(engineSection).toBeVisible({timeout: 3000});
    await expect(engineSection.getByText(/shift/i).first()).toBeVisible();
  });

  test('should exit comparison mode via the BACK button', async ({appPage, page}) => {
    const firstTile = appPage.cardOverviewModal
      .locator('[data-group-key="shift-targets"] a.card-tile')
      .first();
    await firstTile.click();

    const backButton = appPage.cardOverviewModal.getByRole('button', {name: /back to synergies/i});
    await expect(backButton).toBeVisible({timeout: 3000});
    await backButton.click();

    // Modal returns to default state. URL stayed on Browse the whole time (in-app
    // comparison flow doesn't push /compare/*), so the final URL assertion just
    // confirms we didn't accidentally trigger a navigation on BACK.
    await expect(appPage.cardOverviewModal).toHaveAttribute('data-mode', 'default', {timeout: 5000});
    await expect(page).toHaveURL(/\/browse/, {timeout: 5000});
  });

  test('should switch comparison pairs across exit and re-entry', async ({appPage}) => {
    const modal = appPage.cardOverviewModal;
    const backButton = modal.getByRole('button', {name: /back to synergies/i});

    // Enter comparison from the shift-targets group.
    await modal.locator('[data-group-key="shift-targets"] a.card-tile').first().click();
    await expect(backButton).toBeVisible({timeout: 3000});

    // Exit back to the default modal.
    await backButton.click();
    await expect(modal).toHaveAttribute('data-mode', 'default', {timeout: 5000});

    // Re-enter a different comparison from another group — consecutive comparisons must work.
    await modal.locator('[data-group-key="discard"] a.card-tile').first().click();
    await expect(modal).toHaveAttribute('data-mode', 'comparison', {timeout: 3000});
    await expect(backButton).toBeVisible();
  });
});

test.describe('Synergy comparison — Mobile', () => {
  test.beforeEach(async ({appPage}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();
    // /card/:id is a real page now (#486); open the modal on the fixture card via Browse.
    await appPage.openCardOverview(CARD_NAME);
    const groupCount = appPage.cardOverviewModal.locator('[data-group-key]');
    const noSynergies = appPage.cardOverviewModal.getByTestId('card-overview-empty');
    await expect(groupCount.first().or(noSynergies)).toBeVisible({timeout: 10000});
  });

  test('should enter comparison mode on mobile', async ({appPage}) => {
    const firstTile = appPage.cardOverviewModal.locator('[data-group-key] a.card-tile').first();
    await expect(firstTile).toBeVisible({timeout: 5000});
    await firstTile.click();

    await expect(
      appPage.cardOverviewModal.getByRole('button', {name: /back to synergies/i}),
    ).toBeVisible({timeout: 3000});
  });

  test('should render the tabbed comparison layout on mobile', async ({appPage}) => {
    await appPage.cardOverviewModal.locator('[data-group-key] a.card-tile').first().click();

    // MobileComparisonView replaces the desktop two-column layout with an Engine/Community
    // section-switch bar — the two pill buttons confirm the mobile-specific view rendered (#332 #5).
    const modal = appPage.cardOverviewModal;
    await expect(modal.getByRole('button', {name: /^Engine/})).toBeVisible({timeout: 3000});
    await expect(modal.getByRole('button', {name: /^Community/})).toBeVisible();
  });

  test('should switch to the Community tab on mobile', async ({appPage}) => {
    await appPage.cardOverviewModal.locator('[data-group-key] a.card-tile').first().click();

    const modal = appPage.cardOverviewModal;
    const engineTab = modal.getByRole('button', {name: /^Engine/});
    const communityTab = modal.getByRole('button', {name: /^Community/});
    // The active section pill carries aria-current="true".
    await expect(engineTab).toHaveAttribute('aria-current', 'true', {timeout: 3000});
    // Where the page and every scroll container around the tab strip sit: switching tabs
    // scrolls the strip alone (#653).
    const aroundStrip = () =>
      modal.locator('.mobile-tab-viewport').evaluate((strip) => {
        const positions = [`page ${Math.round(window.scrollX)},${Math.round(window.scrollY)}`];
        for (let el = strip.parentElement; el; el = el.parentElement) {
          positions.push(`${el.tagName} ${Math.round(el.scrollLeft)},${Math.round(el.scrollTop)}`);
        }
        return positions;
      });
    const before = await aroundStrip();

    await communityTab.click();
    await expect(communityTab).toHaveAttribute('aria-current', 'true', {timeout: 3000});
    await expect(engineTab).toHaveAttribute('aria-current', 'false');
    expect(await aroundStrip()).toEqual(before);
  });

  test('should open and dismiss the card lightbox on mobile', async ({appPage, page}) => {
    await appPage.cardOverviewModal.locator('[data-group-key] a.card-tile').first().click();

    // Tapping a comparison card opens MobileLightbox — a portal-to-body dialog, so it's
    // queried on `page`, not scoped to the modal.
    await appPage.cardOverviewModal.getByRole('button', {name: /^Enlarge /}).first().click();
    const lightbox = page.getByRole('dialog', {name: /enlarged/i});
    // The mobile-safari binary runs the lightbox open/close transition slower than the
    // 3s default; widen both assertions to 15s for determinism (same fix as #376's modal).
    await expect(lightbox).toBeVisible({timeout: 15000});

    await lightbox.getByRole('button', {name: /close enlarged card/i}).click();
    await expect(lightbox).toHaveCount(0, {timeout: 15000});
  });

  test('should exit comparison mode via BACK on mobile', async ({appPage}) => {
    await appPage.cardOverviewModal.locator('[data-group-key] a.card-tile').first().click();

    const backButton = appPage.cardOverviewModal.getByRole('button', {name: /back to synergies/i});
    await expect(backButton).toBeVisible({timeout: 3000});
    await backButton.click();

    await expect(appPage.cardOverviewModal).toHaveAttribute('data-mode', 'default', {timeout: 5000});
  });
});

/**
 * Deep-link comparison: `/compare/:idA/:idB` opens the modal straight into comparison via
 * ComparePage → openComparison. The user never saw the default modal state, so the BACK button
 * is suppressed (hideBackButton) — Escape/backdrop close the whole modal instead.
 */
test.describe('Synergy comparison — deep link', () => {
  test('opens directly in comparison with no BACK button (desktop)', async ({appPage, page}, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile-'), 'desktop-only assertions');
    await page.goto(COMPARE_URL);

    await expect(appPage.cardOverviewModal).toBeVisible({timeout: 10000});
    await expect(appPage.cardOverviewModal).toHaveAttribute('data-mode', 'comparison', {timeout: 10000});
    await expect(
      appPage.cardOverviewModal.getByRole('button', {name: /back to synergies/i}),
    ).toHaveCount(0);
  });

  test('opens the mobile tabbed comparison view (mobile)', async ({appPage, page}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), 'mobile-only');
    await page.goto(COMPARE_URL);

    await expect(appPage.cardOverviewModal).toBeVisible({timeout: 10000});
    await expect(appPage.cardOverviewModal).toHaveAttribute('data-mode', 'comparison', {timeout: 10000});
    await expect(appPage.cardOverviewModal.getByRole('button', {name: /^Engine/})).toBeVisible({timeout: 3000});
  });
});
