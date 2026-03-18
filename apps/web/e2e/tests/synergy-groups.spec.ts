import {test, expect} from '../fixtures';

// Anna - Diplomatic Queen: shift-targets (direct, 3 cards) + discard (playstyle, 34 cards)
const CARD_URL = '/card/1041';

test.describe('Synergy Groups — Desktop', () => {
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
    // Playstyle group (discard) has 34 cards — desktop truncates at 10
    const discardGroup = synergyResultsPage.getSynergyGroupByKey('discard');
    await expect(discardGroup).toBeVisible();

    // Wait for card tiles to render within the group
    const tiles = synergyResultsPage.getGroupCardTiles('discard');
    await expect(tiles.first()).toBeVisible({timeout: 5000});
    const count = await tiles.count();
    expect(count).toBe(10);

    // "+N more" tile should be visible with remaining count
    const moreTile = synergyResultsPage.getMoreTile('discard');
    await expect(moreTile).toBeVisible();
    await expect(moreTile).toContainText('24');
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
