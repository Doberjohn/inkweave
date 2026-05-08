import {test, expect} from '../fixtures';

test.describe('Card Selection and Synergies', () => {
  // Skip on mobile - the modal layout is the same shape but the assertions below assume desktop
  test.beforeEach(async ({appPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
    await appPage.goto();
  });

  test('should show home state at root URL', async ({appPage, page}) => {
    await expect(appPage.heroSection).toBeVisible();
    await expect(appPage.featuredCards).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('should open the card overview modal when a card is selected', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Modal opens overlay-style — URL stays `/`, hero remains in the DOM behind the backdrop.
    await expect(page).toHaveURL('/');
    await expect(appPage.cardOverviewModal).toBeVisible();
    await expect(appPage.cardOverviewBackdrop).toBeVisible();

    // Modal contains the card name in an h1
    await expect(appPage.cardOverviewModal.locator('h1')).toBeVisible();
  });

  test('should show synergy results area when card is selected', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Synergies are fetched async — wait for chip filters, empty state, or error banner.
    // The modal uses chip-based filtering when it has synergies; the empty state shows
    // "No synergies yet" copy when none.
    // Either at least one synergy group renders (data-group-key on the SynergyGroup root) or
    // the modal's empty state shows. The internal `<section aria-label="Synergies">` always
    // mounts; we just need to wait for the populated/empty branch to settle.
    const groupCount = appPage.cardOverviewModal.locator('[data-group-key]');
    const noSynergies = appPage.cardOverviewModal.getByTestId('card-overview-empty');
    const errorBanner = page.getByRole('alert');

    await expect(groupCount.first().or(noSynergies).or(errorBanner)).toBeVisible({timeout: 10000});
  });

  test('should clear selection by closing the modal', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Close via the X button inside the modal header
    await appPage.cardOverviewModal.getByRole('button', {name: 'Close'}).click();

    // Modal closes; URL stays `/`; hero is reachable
    await expect(appPage.cardOverviewModal).toBeHidden();
    await expect(appPage.heroSection).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('should close the modal when the backdrop is clicked', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();

    // Click the backdrop directly via dispatchEvent to avoid hit-testing on transparent overlays
    await appPage.cardOverviewBackdrop.dispatchEvent('click');

    await expect(appPage.cardOverviewModal).toBeHidden();
    await expect(appPage.heroSection).toBeVisible();
    await expect(page).toHaveURL('/');
  });
});
