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
const readSynergyData = (cardId: string): E2ESynergyData =>
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/synergies', `${cardId}.json`), 'utf8'));
const expandData = readSynergyData(EXPAND_CARD_ID);
const expandGroup = (expandData.groups ?? []).find((g) => g.groupKey === EXPAND_GROUP);
if (!expandGroup || expandGroup.synergies.length <= 3) {
  throw new Error(
    `Fixture broken: card ${EXPAND_CARD_ID} must have a '${EXPAND_GROUP}' group with >3 synergies ` +
      `(so the default view truncates it and renders a "+N more" tile). Is the card still in the pool?`,
  );
}

// Card 2978 (Meilin Lee - Lead Vocalist) has 6 synergy groups, so its mobile group chip row ("All" plus
// one chip per group) is far wider than a phone viewport: the #631 horizontal-overflow case.
const OVERFLOW_CARD_ID = '2978';
const overflowGroupCount = (readSynergyData(OVERFLOW_CARD_ID).groups ?? []).length;
if (overflowGroupCount < 5) {
  throw new Error(
    `Fixture broken: card ${OVERFLOW_CARD_ID} must have >=5 synergy groups (found ${overflowGroupCount}) ` +
      `so its mobile chip row overflows a 390px viewport. Is the card still in the pool?`,
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

    // Card name in h1 inside the modal header
    const heading = appPage.cardOverviewModal.locator('h1');
    await expect(heading).toBeVisible();
    const name = await heading.textContent();
    expect(name!.length).toBeGreaterThan(0);

    // Card image, named after the card. Not the modal's first <img>: for a card with an
    // alternate printing (#625) that is a pill's rarity symbol, which is decorative (alt="").
    await expect(
      appPage.cardOverviewModal.getByRole('img', {name: name!, exact: true}),
    ).toBeVisible();
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

    // URL stays put — no redirect — and the per-route <Seo> bakes in a self-referential title.
    // The canonical is the slug URL /card/:id/:slug (#498), even from the bare numeric deep link.
    await expect(page).toHaveURL('/card/1947');
    await expect(page).toHaveTitle(/Daisy Duck.*Inkweave/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/card\/1947\/[a-z0-9-]+$/,
    );
    await expect(page.locator('section[aria-label="Synergy results"]')).toBeVisible({timeout: 10000});
    await expect(appPage.cardOverviewModal).toBeHidden();
  });

  test('a wrong slug still renders the card by id and canonicalizes to the correct slug (#498)', async ({
    page,
  }) => {
    // The id is the lookup key; the slug is decorative (#498). A deliberately wrong slug still
    // resolves card 1947, and the canonical is rewritten to its derived slug, not the URL's.
    await page.goto('/card/1947/wrong-slug-here');

    await expect(page).toHaveTitle(/Daisy Duck.*Inkweave/);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /\/card\/1947\/[a-z0-9-]+$/);
    await expect(canonical).not.toHaveAttribute('href', /wrong-slug-here$/);
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

test.describe('Card page (mobile layout)', () => {
  // Runs on every project, not just mobile-*: isMobile is width-based (useResponsive), so a forced
  // phone viewport renders the mobile layout anywhere, including the chromium-only Windows pre-push.
  test('a card with many synergy groups does not scroll the page sideways (#631)', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/card/${OVERFLOW_CARD_ID}`);

    const chipRow = page.getByTestId('synergy-group-toolbar');
    await expect(chipRow.getByRole('button', {name: 'All', exact: true})).toBeVisible({timeout: 10000});

    // documentElement.clientWidth, not window.innerWidth: mobile emulation zooms out to fit an
    // overflowing page, which inflates innerWidth to the overflowed width.
    const layout = await chipRow.evaluate((row) => ({
      pageScroll: document.documentElement.scrollWidth,
      pageClient: document.documentElement.clientWidth,
      rowScroll: row.scrollWidth,
      rowClient: row.clientWidth,
      rowOverflowX: getComputedStyle(row).overflowX,
    }));
    // Precondition: the chips really are wider than the page, so this card exercises the bug.
    expect(layout.rowScroll).toBeGreaterThan(layout.pageClient);
    // The page never scrolls sideways (the results section is a flex item that must be free to shrink)...
    expect(layout.pageScroll).toBeLessThanOrEqual(layout.pageClient);
    // ...the chip row scrolls inside its own overflow box instead. Width alone is not enough: with
    // overflow-x hidden or clip the row still measures wider, but the off-screen chips are unreachable.
    expect(layout.rowScroll).toBeGreaterThan(layout.rowClient);
    expect(layout.rowOverflowX).toMatch(/^(auto|scroll)$/);
  });

  test('× returns to the card before, and opens Browse on the page the visit started on', async ({
    page,
  }) => {
    await page.setViewportSize({width: 390, height: 844});
    // Any card with synergy tiles to tap: 2095's ramp group is fixture-guarded above.
    await page.goto(`/card/${EXPAND_CARD_ID}`);
    const close = page.getByRole('button', {name: 'Close', exact: true});

    // A synergy card opens its own page, so × goes back to the card it came from...
    await page.locator('a.card-tile').first().click();
    await expect(page).not.toHaveURL(new RegExp(`/card/${EXPAND_CARD_ID}$`));
    await close.click();
    await expect(page).toHaveURL(new RegExp(`/card/${EXPAND_CARD_ID}$`));

    // ...but on the entry page, going back would leave the app, so × opens Browse instead.
    await close.click();
    await expect(page).toHaveURL(/\/browse$/);
  });
});
