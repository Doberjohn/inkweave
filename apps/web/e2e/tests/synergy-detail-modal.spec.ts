import {test, expect} from '../fixtures';

// Anna - Diplomatic Queen: has both direct and playstyle synergies
const CARD_URL = '/card/1041';

test.describe('Synergy Detail Modal — Desktop', () => {
  test.beforeEach(async ({page, synergyResultsPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') test.skip();
    await page.goto(CARD_URL);
    await synergyResultsPage.waitForSynergiesLoaded();
  });

  test('should open modal when clicking a synergy card', async ({synergyResultsPage}) => {
    // Click the first card tile in the shift-targets group
    const firstTile = synergyResultsPage.getGroupCardTiles('shift-targets').first();
    await expect(firstTile).toBeVisible();
    await firstTile.click();

    // Modal should appear
    const modal = synergyResultsPage.getDetailModal();
    await expect(modal).toBeVisible({timeout: 3000});
    await expect(modal).toHaveAttribute('role', 'dialog');
  });

  test('should display connection explanations in modal', async ({synergyResultsPage}) => {
    // Click a synergy card to open the modal
    const firstTile = synergyResultsPage.getGroupCardTiles('shift-targets').first();
    await firstTile.click();

    const modal = synergyResultsPage.getDetailModal();
    await expect(modal).toBeVisible({timeout: 3000});

    // Modal should contain explanation text about the synergy
    // Shift target explanations mention "Shift" in their text
    await expect(modal.getByText(/shift/i).first()).toBeVisible();
  });

  test('should close modal on backdrop click', async ({synergyResultsPage}) => {
    // Open the modal
    const firstTile = synergyResultsPage.getGroupCardTiles('shift-targets').first();
    await firstTile.click();

    const modal = synergyResultsPage.getDetailModal();
    await expect(modal).toBeVisible({timeout: 3000});

    // Click the backdrop to close
    await synergyResultsPage.closeDetailModalBackdrop();

    // Modal should be gone
    await expect(modal).not.toBeVisible();
  });

  test('should navigate to card page via CTA button', async ({page, synergyResultsPage}) => {
    // Open the modal
    const firstTile = synergyResultsPage.getGroupCardTiles('shift-targets').first();
    await firstTile.click();

    const modal = synergyResultsPage.getDetailModal();
    await expect(modal).toBeVisible({timeout: 3000});

    // Click the CTA button ("View X synergies")
    const cta = synergyResultsPage.getDetailModalCTA();
    await expect(cta).toBeVisible();
    await cta.click();

    // Should navigate away from the original card page
    await expect(page).not.toHaveURL(CARD_URL);
    await expect(page).toHaveURL(/\/card\/\d+/);
  });
});

test.describe('Synergy Detail Modal — Mobile', () => {
  test.beforeEach(async ({page, synergyResultsPage}, testInfo) => {
    if (testInfo.project.name !== 'mobile-chrome') test.skip();
    await page.goto(CARD_URL);
    await synergyResultsPage.waitForSynergiesLoaded();
  });

  test('should open modal on mobile', async ({synergyResultsPage}) => {
    // Click a synergy card tile (first visible one in any group)
    const firstTile = synergyResultsPage.page.locator('[data-group-key] button.card-tile').first();
    await expect(firstTile).toBeVisible();
    await firstTile.click();

    // Modal should appear on mobile too
    const modal = synergyResultsPage.getDetailModal();
    await expect(modal).toBeVisible({timeout: 3000});
    await expect(modal).toHaveAttribute('role', 'dialog');
  });
});
