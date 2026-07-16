import {test, expect} from '../fixtures';
import {cardFullNameById} from '../helpers/cardData';
import fs from 'node:fs';
import path from 'node:path';

// Card 2095 (Winnie the Pooh - Having a Think) has a large 'ramp' synergy group, so it is truncated
// in the modal's default view and renders a "+N more" tile — the precondition for one-clicking
// through to the fully-expanded ExpandedGroupView. Group size is read from the precomputed data so
// the fixture survives pool drift.
const EXPAND_CARD_ID = '2095';
const EXPAND_GROUP = 'ramp';
interface E2ESynergyGroup {
  groupKey: string;
  synergies: unknown[];
}
interface E2ESynergyData {
  groups: E2ESynergyGroup[];
}
const expandData: E2ESynergyData = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/synergies', `${EXPAND_CARD_ID}.json`), 'utf8'),
);
const expandGroup = (expandData.groups ?? []).find((g) => g.groupKey === EXPAND_GROUP);
if (!expandGroup || expandGroup.synergies.length <= 3) {
  throw new Error(
    `Fixture broken: card ${EXPAND_CARD_ID} must have a '${EXPAND_GROUP}' group with >3 synergies ` +
      `(so the default view truncates it and renders a "+N more" tile). Is the card still in the pool?`,
  );
}

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

  test('renders the crawlable card page when deep-linking to /card/:id', async ({appPage, page}) => {
    // #486: /card/:id is now a real, crawlable page (was a modal that redirected to `/`).
    await page.goto('/card/1947');

    // URL stays put — no redirect — and the per-route <Seo> bakes in a self-referential title
    // and canonical, with the synergy results rendered in the page (not a modal overlay).
    await expect(page).toHaveURL('/card/1947');
    await expect(page).toHaveTitle(/Daisy Duck.*Inkweave/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/card\/1947$/);
    await expect(page.locator('section[aria-label="Synergy results"]')).toBeVisible({timeout: 10000});
    await expect(appPage.cardOverviewModal).toBeHidden();
  });

  test('shows a not-found page for an invalid card ID', async ({appPage, page}) => {
    await page.goto('/card/99999999');

    // #486: CardPage renders a noindex "Card not found" page (no redirect, no modal).
    await expect(page.getByRole('heading', {name: /card not found/i})).toBeVisible({timeout: 10000});
    await expect(page).toHaveURL('/card/99999999');
    await expect(appPage.cardOverviewModal).toBeHidden();
  });

  test('should close the modal when Escape is pressed', async ({appPage, page}) => {
    await appPage.selectFeaturedCard();
    await expect(appPage.cardOverviewModal).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(appPage.cardOverviewModal).toBeHidden();
    await expect(appPage.heroSection).toBeVisible();
  });

  test('shows the empty state on the page for a card with no synergies', async ({page}) => {
    // Card 1936 (Bruno Madrigal - Undetected Uncle) has no precomputed synergy file — the card
    // page's SynergyResults renders its "no synergies" notice (#486).
    await page.goto('/card/1936');

    await expect(page.getByText(/no synergies found for this card/i)).toBeVisible({timeout: 10000});
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

test.describe('Card Detail: Show More and sibling navigation (desktop)', () => {
  test('Show More reveals the full expanded group, and Back returns to default', async ({appPage}, testInfo) => {
    // Desktop only: arrows and the expanded view are exercised on the desktop layout here.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    // The modal's default view truncates the ramp group (>3), so a "+N more" tile renders. Open
    // the modal on the fixture card via Browse (/card/:id is a page now, #486).
    await appPage.openCardOverview(cardFullNameById(EXPAND_CARD_ID));
    const modal = appPage.cardOverviewModal;

    const moreTile = modal.locator(`[data-group-key="${EXPAND_GROUP}"] [data-testid="more-tile"]`);
    await expect(moreTile).toBeVisible({timeout: 10000});

    // One click on the More tile jumps straight to the full ExpandedGroupView.
    await moreTile.click();
    await expect(modal).toHaveAttribute('data-state', 'expanded');
    await expect(modal.getByText(/back to all synergies/i)).toBeVisible();

    // Back returns to the default all-groups view.
    await modal.getByText(/back to all synergies/i).click();
    await expect(modal).toHaveAttribute('data-state', 'default');
  });

  test('arrows navigate to a sibling card from the Browse grid', async ({appPage, page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto('/browse');
    const firstTile = page.getByTestId('card-tile').first();
    await firstTile.click();

    const modal = appPage.cardOverviewModal;
    await modal.waitFor({state: 'visible', timeout: 10000});
    await expect(modal.locator('h1')).toBeVisible();
    const firstName = await modal.locator('h1').textContent();

    // The nav arrows sit OUTSIDE the dialog shell (in the frame wrapper, so they can straddle the
    // border), so query them at the page level rather than scoped to the modal element.
    await page.getByRole('button', {name: 'Next card'}).click();
    await expect(modal.locator('h1')).not.toHaveText(firstName ?? '');
  });
});
