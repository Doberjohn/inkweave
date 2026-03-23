import {test, expect} from '../fixtures';

// Elsa - Ice Artisan (2586) has both direct (Shift Targets) and playstyle (Locations) groups
const CARD_WITH_BOTH_GROUPS = '/card/2586';

test.describe('Show All UX — Desktop', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(CARD_WITH_BOTH_GROUPS);
    // Wait for synergies to load
    await expect(
      page
        .getByRole('heading', {name: 'Synergies'})
        .or(page.getByText('No synergies found'))
        .or(page.getByRole('alert')),
    ).toBeVisible({timeout: 10000});
  });

  test('should expand playstyle group and scroll to expanded view', async ({page}) => {
    // Find the "+N more" tile in a playstyle group and click it
    const moreTile = page.locator('[data-testid="more-tile"]').first();
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    // Expanded view should render with the data-expanded-group attribute
    const expandedView = page.locator('[data-expanded-group]');
    await expect(expandedView).toBeVisible();

    // "Back to all synergies" button should be scrolled into viewport after smooth scroll
    const backButton = page.getByRole('button', {name: /Back to all synergies/});
    await expect(backButton).toBeInViewport({timeout: 3000});
  });

  test('should show all direct group cards inline without truncation', async ({page}) => {
    // Direct groups (Shift Targets) should NOT have a "+N more" tile
    const shiftGroup = page.locator('[data-group-key="shift-targets"]');
    await expect(shiftGroup).toBeVisible();

    // Should have card tiles but no more-tile within this group
    const moreTile = shiftGroup.locator('[data-testid="more-tile"]');
    await expect(moreTile).toHaveCount(0);
  });
});

test.describe('Show All UX — Mobile', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(CARD_WITH_BOTH_GROUPS);
    await expect(
      page
        .getByRole('heading', {name: 'Synergies'})
        .or(page.getByText('No synergies found'))
        .or(page.getByRole('alert')),
    ).toBeVisible({timeout: 10000});
  });

  test('should expand playstyle group and scroll to expanded view on mobile', async ({page}) => {
    // Find and click the "+N more" tile
    const moreTile = page.locator('[data-testid="more-tile"]').first();
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    // Expanded view should render
    const expandedView = page.locator('[data-expanded-group]');
    await expect(expandedView).toBeVisible();

    // "Back to all synergies" button should be scrolled into viewport after smooth scroll
    const backButton = page.getByRole('button', {name: /Back to all synergies/});
    await expect(backButton).toBeInViewport({timeout: 3000});
  });

  test('should truncate direct group at mobile cap and show more tile', async ({page}) => {
    // Card 2586 has 8 shift-targets — mobile cap is 5, so truncation applies
    const shiftGroup = page.locator('[data-group-key="shift-targets"]');
    await expect(shiftGroup).toBeVisible();

    // "+N more" tile should appear since 8 > 5 mobile cap
    const moreTile = shiftGroup.locator('[data-testid="more-tile"]');
    await expect(moreTile).toBeVisible();
    await expect(moreTile).toContainText('3');
  });
});
