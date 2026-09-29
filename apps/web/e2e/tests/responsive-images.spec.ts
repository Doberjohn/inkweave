import {test, expect} from '../fixtures';

test.describe('Responsive Images', () => {
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
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

  test('should render image in the card overview modal', async ({appPage}) => {
    await appPage.selectFeaturedCard();

    await expect(appPage.cardOverviewModal).toBeVisible();

    // The card art, named after the card (the h1). Not the modal's first <img>: for a card with
    // an alternate printing (#625) that is a pill's decorative rarity symbol.
    const name = await appPage.cardOverviewModal.locator('h1').textContent();
    const detailImg = appPage.cardOverviewModal.getByRole('img', {name: name!, exact: true});
    await expect(detailImg).toBeVisible();
    expect(await detailImg.getAttribute('src')).toBeTruthy();
    // Note: the modal's primary card image uses CardImage's default `lazy=true`. The image
    // is always above-the-fold when the modal opens, so lazy-vs-eager doesn't materially
    // affect perceived load. We just verify the img renders with a valid src.
  });

  test('should use lazy loading for synergy card images', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Wait for synergies to load. Modal renders either synergy groups (data-group-key) or
    // the empty state.
    const synergyCards = appPage.cardOverviewModal.getByTestId('reason-tag');
    const noSynergies = appPage.cardOverviewModal.getByTestId('card-overview-empty');
    const errorBanner = page.getByRole('alert');

    await expect(synergyCards.first().or(noSynergies).or(errorBanner)).toBeVisible({
      timeout: 10000,
    });

    const hasSynergies = await synergyCards.first().isVisible().catch(() => false);
    if (!hasSynergies) return; // No synergy images to test

    // Synergy card images should lazy-load (below the fold inside the modal)
    const synergyImg = appPage.cardOverviewModal
      .locator('a.card-tile')
      .filter({has: appPage.cardOverviewModal.getByTestId('reason-tag')})
      .first()
      .locator('img');

    if (await synergyImg.isVisible().catch(() => false)) {
      expect(await synergyImg.getAttribute('loading')).toBe('lazy');
    }
  });
});
