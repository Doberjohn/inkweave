import {test, expect} from '../fixtures';
import fs from 'node:fs';
import path from 'node:path';

// Anna - Diplomatic Queen: shift-targets (direct) + discard (playstyle);
// discard count read from synergy data at test time.
const CARD_URL = '/card/1041';
const CARD_ID = '1041';

// Read the precomputed synergy data for the fixture card to derive expected
// group sizes at test time. This avoids hardcoding counts that drift as
// Set 12+ preview cards are added/removed from the pool.
interface SynergyGroup {
  groupKey: string;
  synergies: unknown[];
}
interface SynergyFile {
  groups: SynergyGroup[];
}

const synergyDataPath = path.resolve(
  process.cwd(),
  'public/data/synergies',
  `${CARD_ID}.json`,
);
const synergyData: SynergyFile = JSON.parse(fs.readFileSync(synergyDataPath, 'utf8'));
const DISCARD_TOTAL =
  synergyData.groups.find((g) => g.groupKey === 'discard')?.synergies.length ?? 0;
if (DISCARD_TOTAL === 0) {
  throw new Error(
    `No 'discard' group found for card ${CARD_ID} in ${synergyDataPath}. ` +
      `Fixture is broken — is the card still in the pool?`,
  );
}
const DESKTOP_TRUNCATION_LIMIT = 12;
const DESKTOP_OVERFLOW = DISCARD_TOTAL - DESKTOP_TRUNCATION_LIMIT;

// NOTE: This file tested the old card detail page's synergy-breakdown sidebar + chip filter UX,
// plus a 12-card desktop truncation policy. The CardOverviewModal redesign (#320) replaces:
//   - The synergy-breakdown sidebar (deleted with CardDetailPanel)
//   - The "All" chip (modal uses no-active-filter to show all)
//   - 12-card truncation (modal uses 3 in default state, 11 when filtered)
// Skipping until rewritten for the new modal-based flow. The new chip-filter behavior is
// covered in `synergy-detail-modal.spec.ts`.
test.describe.skip('Synergy Groups — Desktop', () => {
  test.beforeEach(async ({page, synergyResultsPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(CARD_URL);
    await synergyResultsPage.waitForSynergiesLoaded();
  });

  test('should render both direct and playstyle synergy groups', async ({synergyResultsPage}) => {
    // Direct group: Shift Targets
    const shiftGroup = synergyResultsPage.getSynergyGroupByKey('shift-targets');
    await expect(shiftGroup).toBeVisible();

    // Playstyle group: Discard
    const discardGroup = synergyResultsPage.getSynergyGroupByKey('discard');
    await expect(discardGroup).toBeVisible();
  });

  test('should show synergy breakdown sidebar with group labels', async ({page}) => {
    const breakdown = page.getByTestId('synergy-breakdown');
    await expect(breakdown).toBeVisible();

    // Breakdown should mention both group labels
    await expect(breakdown.getByText('Shift Targets')).toBeVisible();
    await expect(breakdown.getByText('Discard')).toBeVisible();
  });

  test('should filter synergy groups when clicking a group chip', async ({
    page,
    synergyResultsPage,
  }) => {
    // Both groups initially visible
    await expect(synergyResultsPage.getSynergyGroupByKey('shift-targets')).toBeVisible();
    await expect(synergyResultsPage.getSynergyGroupByKey('discard')).toBeVisible();

    // Click the "Discard" chip to filter to only that group
    const discardChip = page.getByRole('button', {name: 'Discard', exact: true});
    await discardChip.click();
    await page.waitForTimeout(200);

    // Only discard group should be visible
    await expect(synergyResultsPage.getSynergyGroupByKey('discard')).toBeVisible();
    await expect(synergyResultsPage.getSynergyGroupByKey('shift-targets')).not.toBeVisible();

    // Click "All" chip to reset
    const allChip = page.getByRole('button', {name: 'All', exact: true});
    await allChip.click();
    await page.waitForTimeout(200);

    // Both groups visible again
    await expect(synergyResultsPage.getSynergyGroupByKey('shift-targets')).toBeVisible();
    await expect(synergyResultsPage.getSynergyGroupByKey('discard')).toBeVisible();
  });

  test('should show all direct group cards inline without more tile', async ({
    synergyResultsPage,
  }) => {
    // Direct group (shift-targets) has 3 cards — all should be visible, no more tile
    const tiles = synergyResultsPage.getGroupCardTiles('shift-targets');
    await expect(tiles.first()).toBeVisible({timeout: 5000});
    const count = await tiles.count();
    expect(count).toBe(3);

    const moreTile = synergyResultsPage.getMoreTile('shift-targets');
    await expect(moreTile).toHaveCount(0);
  });

  test('should truncate playstyle group and show more tile', async ({synergyResultsPage}) => {
    // Discard group exceeds the 12-card truncation threshold on desktop
    const discardGroup = synergyResultsPage.getSynergyGroupByKey('discard');
    await expect(discardGroup).toBeVisible();

    // Wait for card tiles to render within the group
    const tiles = synergyResultsPage.getGroupCardTiles('discard');
    await expect(tiles.first()).toBeVisible({timeout: 5000});
    const count = await tiles.count();
    expect(count).toBe(12);

    // "+N more" tile should be visible with remaining count
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await expect(moreTile).toBeVisible();
    await expect(moreTile).toContainText(String(DESKTOP_OVERFLOW));
  });

  test('should display group description callout text', async ({synergyResultsPage}) => {
    // The discard group should have a description callout
    const discardGroup = synergyResultsPage.getSynergyGroupByKey('discard');
    await expect(discardGroup.getByText(/discard/i).first()).toBeVisible();

    // The shift-targets group should also have a description
    const shiftGroup = synergyResultsPage.getSynergyGroupByKey('shift-targets');
    await expect(shiftGroup.getByText(/shift/i).first()).toBeVisible();
  });
});
