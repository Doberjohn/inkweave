import {test, expect} from '../fixtures';

test.describe('Card Detail (modal)', () => {
  // Desktop only — mobile has different layout
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
    await appPage.goto();
  });

  test('should render card name and image inside the overview modal', async ({appPage}) => {
    await appPage.selectFeaturedCard();

    await expect(appPage.cardOverviewModal).toBeVisible();

    // Card image — first <img> inside the modal is the primary card art
    const img = appPage.cardOverviewModal.locator('img').first();
    await expect(img).toBeVisible();
    const alt = await img.getAttribute('alt');
    expect(alt).toBeTruthy();

    // Card name in h1 inside the modal header
    const heading = appPage.cardOverviewModal.locator('h1');
    await expect(heading).toBeVisible();
    const name = await heading.textContent();
    expect(name!.length).toBeGreaterThan(0);
  });

  test('should show synergy chips or empty state once data loads', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Synergies fetched async — wait for chips (one button per group), empty state, or error
    // Either synergy groups render (data-group-key) or the empty-state testid appears.
    const groupCount = appPage.cardOverviewModal.locator('[data-group-key]');
    const noSynergies = appPage.cardOverviewModal.getByTestId('card-overview-empty');
    const errorBanner = page.getByRole('alert');

    await expect(groupCount.first().or(noSynergies).or(errorBanner)).toBeVisible({timeout: 10000});
  });

  test('should open the modal when deep-linking to /card/:id', async ({appPage, page}) => {
    // Card IDs start at 957 in the dataset. CardPage opens the modal globally and redirects
    // the URL to `/`, so closing the modal lands on the home page.
    await page.goto('/card/957');

    await expect(appPage.cardOverviewModal).toBeVisible({timeout: 10000});
    await expect(page).toHaveURL('/');
  });

  test('should not open the modal for an invalid card ID', async ({appPage, page}) => {
    await page.goto('/card/99999999');

    // CardPage redirects to `/`. selectedCardId is set but getCardById returns undefined,
    // so the modal renders nothing. End state: home page, modal hidden.
    await page.waitForTimeout(500);
    await expect(page).toHaveURL('/');
    await expect(appPage.cardOverviewModal).toBeHidden();
    await expect(appPage.heroSection).toBeVisible();
  });

  test('should close the modal when Escape is pressed', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();
    await expect(appPage.cardOverviewModal).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(appPage.cardOverviewModal).toBeHidden();
    await expect(appPage.heroSection).toBeVisible();
  });

  test('should show the empty state for a card with no synergies', async ({appPage, page}) => {
    // Card 957 (Koda) has no precomputed synergy file — the modal renders its empty state.
    await page.goto('/card/957');

    await expect(appPage.cardOverviewModal).toBeVisible({timeout: 10000});
    await expect(appPage.cardOverviewModal.getByTestId('card-overview-empty')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should lock background scroll while the modal is open', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();
    await expect(appPage.cardOverviewModal).toBeVisible();

    // useScrollLock pins document.body overflow to hidden while the modal is open.
    const overflowWhileOpen = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflowWhileOpen).toBe('hidden');

    await appPage.cardOverviewModal.getByRole('button', {name: 'Close'}).click();
    await expect(appPage.cardOverviewModal).toBeHidden();

    // Closing restores scroll.
    const overflowAfterClose = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflowAfterClose).not.toBe('hidden');
  });
});
