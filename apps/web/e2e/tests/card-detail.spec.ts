import {test, expect} from '../fixtures';

test.describe('Card Detail Page', () => {
  // Desktop only — mobile has different layout
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
  });

  test('should render card name and image in detail panel', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    const detailPanel = page.getByTestId('card-detail-panel');
    await expect(detailPanel).toBeVisible();

    // Card image should render
    const img = detailPanel.locator('img').first();
    await expect(img).toBeVisible();
    const alt = await img.getAttribute('alt');
    expect(alt).toBeTruthy();

    // Card name should be in an h1
    const heading = detailPanel.locator('h1');
    await expect(heading).toBeVisible();
    const name = await heading.textContent();
    expect(name!.length).toBeGreaterThan(0);
  });

  test('should render synergy breakdown when synergies exist', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Either synergy breakdown or "no synergies" should be visible
    const breakdown = page.getByTestId('synergy-breakdown');
    const noSynergies = page.getByText('No synergies found for this card');

    const hasBreakdown = await breakdown.isVisible().catch(() => false);
    const hasNoSynergies = await noSynergies.isVisible().catch(() => false);

    expect(hasBreakdown || hasNoSynergies).toBe(true);
  });

  test('should deep link directly to a card page', async ({page}) => {
    // Navigate directly to a card URL (card IDs start at 957 in the dataset)
    await page.goto('/card/957');
    await page.waitForTimeout(500);

    // Card detail panel should render
    const detailPanel = page.getByTestId('card-detail-panel');
    await expect(detailPanel).toBeVisible({timeout: 10000});

    // Compact header should be visible
    const header = page.getByTestId('compact-header');
    await expect(header).toBeVisible();
  });

  test('should show card not found for invalid card ID', async ({page}) => {
    await page.goto('/card/99999999');
    await page.waitForTimeout(500);

    await expect(page.getByText('Card not found')).toBeVisible({timeout: 10000});
    await expect(page.getByRole('button', {name: 'Go Home'})).toBeVisible();
  });
});
