import {test, expect} from '../fixtures';

test.describe('Voting Page — Desktop', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
    // Clear voting localStorage to get fresh pairs
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('inkweave:voted-pairs'));
  });

  test('should navigate to /vote and display a card pair', async ({votePage, page}) => {
    await votePage.goto();
    await expect(page).toHaveURL('/vote');

    // Two card images visible — wait for the SECOND image to mount before counting.
    // `count()` is a snapshot without auto-wait, so on slower browsers (webkit)
    // the first image can render before the second and the count races to 1.
    const images = votePage.getCardImages();
    await expect(images.nth(1)).toBeVisible();
    const count = await images.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should display score picker with 10 buttons', async ({votePage}) => {
    await votePage.goto();

    await expect(votePage.scorePicker).toBeVisible();
    for (let i = 1; i <= 10; i++) {
      await expect(votePage.getScoreButton(i)).toBeVisible();
    }
  });

  test('should display synergy description', async ({votePage, page}) => {
    await votePage.goto();

    const main = page.locator('main');
    await expect(main).toContainText(/How strong is this synergy/);
  });

  test('should show skip button with keyboard hint', async ({votePage}) => {
    await votePage.goto();

    await expect(votePage.skipButton).toBeVisible();
    await expect(votePage.skipButton).toContainText('(S)');
  });

  test('should advance to next pair when score is clicked', async ({votePage}) => {
    await votePage.goto();

    const countBefore = await votePage.getSeenPairsCount();
    await votePage.clickScore(7);
    await votePage.waitForPairAdvance(countBefore);

    const countAfter = await votePage.getSeenPairsCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test('should advance to next pair when skip is clicked', async ({votePage}) => {
    await votePage.goto();

    const countBefore = await votePage.getSeenPairsCount();
    await votePage.skipButton.click();
    await votePage.waitForPairAdvance(countBefore);

    const countAfter = await votePage.getSeenPairsCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test('should show toast after voting', async ({votePage}) => {
    await votePage.goto();
    await votePage.clickScore(8);

    await votePage.waitForToast();
    await expect(votePage.toastNotification).toContainText('Vote submitted');
  });

  test('should support keyboard shortcut for scoring (1-9)', async ({votePage}) => {
    await votePage.goto();

    const countBefore = await votePage.getSeenPairsCount();
    await votePage.pressKey('5');
    await votePage.waitForPairAdvance(countBefore);

    const countAfter = await votePage.getSeenPairsCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test('should support keyboard shortcut 0 for score 10', async ({votePage}) => {
    await votePage.goto();

    const countBefore = await votePage.getSeenPairsCount();
    await votePage.pressKey('0');
    await votePage.waitForPairAdvance(countBefore);

    const countAfter = await votePage.getSeenPairsCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test('should support keyboard shortcut S for skip', async ({votePage}) => {
    await votePage.goto();

    const countBefore = await votePage.getSeenPairsCount();
    await votePage.pressKey('s');
    await votePage.waitForPairAdvance(countBefore);

    const countAfter = await votePage.getSeenPairsCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test('should navigate to /vote from nav strip', async ({page}) => {
    // Navigate to browse first (has compact header with nav strip)
    await page.goto('/browse');
    await page.waitForTimeout(500);

    const voteLink = page.getByRole('link', {name: 'Vote'});
    await expect(voteLink).toBeVisible();
    await voteLink.click();

    await expect(page).toHaveURL('/vote');
  });

  test('should show compact header with nav strip', async ({votePage, page}) => {
    await votePage.goto();

    const header = page.locator('header');
    await expect(header).toBeVisible();

    await expect(page.getByRole('link', {name: 'Browse'})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Vote'})).toBeVisible();
  });
});

test.describe('Voting Page — Mobile', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) {
      test.skip();
    }
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('inkweave:voted-pairs'));
  });

  test('should display compact card layout on mobile', async ({votePage}) => {
    await votePage.goto();

    const images = votePage.getCardImages();
    await expect(images.first()).toBeVisible();
    await expect(votePage.scorePicker).toBeVisible();
  });

  test('should show skip button without keyboard hint on mobile', async ({votePage}) => {
    await votePage.goto();

    await expect(votePage.skipButton).toBeVisible();
    await expect(votePage.skipButton).not.toContainText('(S)');
  });

  test('should advance to next pair on score click (mobile)', async ({votePage}) => {
    await votePage.goto();

    const countBefore = await votePage.getSeenPairsCount();
    await votePage.clickScore(6);
    await votePage.waitForPairAdvance(countBefore);

    const countAfter = await votePage.getSeenPairsCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test('should advance on skip (mobile)', async ({votePage}) => {
    await votePage.goto();

    const countBefore = await votePage.getSeenPairsCount();
    await votePage.skipButton.click();
    await votePage.waitForPairAdvance(countBefore);

    const countAfter = await votePage.getSeenPairsCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  test('should show mobile bottom navigation', async ({votePage, page}) => {
    await votePage.goto();

    const mobileNav = page.getByRole('navigation', {name: 'Mobile navigation'});
    await expect(mobileNav).toBeVisible();
    await expect(page.getByRole('link', {name: 'Browse'})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Playstyles'})).toBeVisible();
  });
});
