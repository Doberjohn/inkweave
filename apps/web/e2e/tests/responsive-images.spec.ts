import {test, expect} from '../fixtures';

test.describe('Responsive Images', () => {
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    await appPage.goto();
  });

  test('should use eager loading for above-fold featured cards', async ({appPage}) => {
    const firstImg = appPage.featuredCards.locator('img').first();
    await expect(firstImg).toBeVisible();

    // Above-fold featured cards should load eagerly for LCP
    expect(await firstImg.getAttribute('loading')).toBe('eager');
    // Note: fetchpriority requires React 19+; React 18 relies on loading="eager" + decoding="sync"
    expect(await firstImg.getAttribute('decoding')).toBe('sync');
  });

  test('should render images in featured cards grid', async ({appPage}) => {
    const images = appPage.featuredCards.locator('img');
    await expect(images.first()).toBeVisible();
    const count = await images.count();
    expect(count).toBeGreaterThan(0);

    // Every visible image should have a valid src
    for (let i = 0; i < Math.min(count, 4); i++) {
      const src = await images.nth(i).getAttribute('src');
      expect(src).toBeTruthy();
    }
  });

  test('should render image in card detail panel', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    const detailPanel = page.getByTestId('card-detail-panel');
    await expect(detailPanel).toBeVisible();

    const detailImg = detailPanel.locator('img').first();
    await expect(detailImg).toBeVisible();

    // Detail panel image should NOT lazy-load (priority flag set)
    const loading = await detailImg.getAttribute('loading');
    expect(loading).not.toBe('lazy');
    expect(await detailImg.getAttribute('src')).toBeTruthy();
  });

  test('should use lazy loading for synergy card images', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Wait for synergies to load (fetched async from pre-computed JSON)
    const synergyCards = page.getByTestId('reason-tag');
    const noSynergies = page.getByText('No synergies found for this card');
    const errorBanner = page.getByRole('alert');

    // Wait for any synergy state to appear
    await expect(synergyCards.first().or(noSynergies).or(errorBanner)).toBeVisible({
      timeout: 10000,
    });

    const hasSynergies = await synergyCards
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasSynergies) {
      return; // No synergy images to test
    }

    // Synergy card images should lazy-load (below the fold)
    const synergyImg = page
      .locator('button.card-tile')
      .filter({has: page.getByTestId('reason-tag')})
      .first()
      .locator('img');

    if (await synergyImg.isVisible().catch(() => false)) {
      expect(await synergyImg.getAttribute('loading')).toBe('lazy');
    }
  });
});
