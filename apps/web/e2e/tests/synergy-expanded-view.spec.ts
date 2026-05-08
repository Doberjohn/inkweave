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

// NOTE: This file tests the "expanded view" pattern from the old card detail page —
// clicking "+N more" navigated to a `[data-expanded-group]` view with its own toolbar +
// "Back to all synergies" button. The CardOverviewModal redesign (#320) replaced that with
// in-modal chip filtering: clicking "+N more" sets `activeGroupFilter`, which narrows the
// modal's group list to that single group with a higher card cap. There's no separate
// expanded-view route or selector to assert on. Skipping until rewritten for the new flow.
test.describe.skip('Synergy Expanded View — Desktop', () => {
  test.beforeEach(async ({page, synergyResultsPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(CARD_URL);
    await synergyResultsPage.waitForSynergiesLoaded();
  });

  test('should show toolbar in expanded view', async ({page, synergyResultsPage}) => {
    // Click "+N more" on the discard group to expand
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    // Expanded view should render
    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // Sort select should be present in the expanded view
    const sortSelect = page.getByLabel('Sort synergies');
    await expect(sortSelect).toBeVisible();
  });

  test('should show all cards without truncation in expanded view', async ({
    page,
    synergyResultsPage,
  }) => {
    // Expand the discard group
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await moreTile.click();

    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // All cards should be visible (no truncation, no more tile)
    const tiles = expandedView.locator('button.card-tile');
    const count = await tiles.count();
    expect(count).toBe(DISCARD_TOTAL);

    // No more tile in expanded view
    const expandedMoreTile = expandedView.locator('[data-testid="more-tile"]');
    await expect(expandedMoreTile).toHaveCount(0);
  });

  test('should navigate back from expanded view', async ({page, synergyResultsPage}) => {
    // Expand the discard group
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await moreTile.click();

    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // Click "Back to all synergies"
    const backButton = page.getByRole('button', {name: /Back to all synergies/});
    await expect(backButton).toBeInViewport({timeout: 3000});
    await backButton.click();

    // Expanded view should be gone, both groups visible again
    await expect(expandedView).not.toBeVisible();
    await expect(synergyResultsPage.getSynergyGroupByKey('shift-targets')).toBeVisible();
    await expect(synergyResultsPage.getSynergyGroupByKey('discard')).toBeVisible();
  });
});

test.describe.skip('Synergy Expanded View — Mobile', () => {
  test.beforeEach(async ({page, synergyResultsPage}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(CARD_URL);
    await synergyResultsPage.waitForSynergiesLoaded();
  });

  test('should expand playstyle group on mobile', async ({page, synergyResultsPage}) => {
    // Discard group should be truncated on mobile (5 cards shown)
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    // Expanded view should render
    const expandedView = page.locator('[data-expanded-group="discard"]');
    await expect(expandedView).toBeVisible();

    // All cards should be shown
    const tiles = expandedView.locator('button.card-tile');
    const count = await tiles.count();
    expect(count).toBe(DISCARD_TOTAL);
  });
});
