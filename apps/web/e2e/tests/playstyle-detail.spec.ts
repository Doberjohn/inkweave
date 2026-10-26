import fs from 'node:fs';
import path from 'node:path';
import type {Locator, Page} from '@playwright/test';
import {cardPath} from 'inkweave-synergy-engine/card';
import {test, expect} from '../fixtures';
import {cardFullNameById} from '../helpers/cardData';
import {slidePointerOnto} from '../helpers/pointer';

/** Exert's guide, as the page fetches it (`public/data/playstyleGuides.json`, #995). */
const EXERT_GUIDE = (
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/playstyleGuides.json'), 'utf8')) as Record<
    string,
    {paragraphs: string[]; keyCards: string[]}
  >
).exert;

/**
 * A file the playstyle page waits for, held while the others land: `companion` (a selector) must
 * be on the page whenever a card is, and `shown` appears once the file is let go (#930, #995).
 */
interface DrawnWithCards {
  path: string;
  heldFile: string;
  otherFiles: string[];
  companion: string;
  shown: Locator;
}

test.describe('Playstyle Detail — Desktop', () => {
  test.beforeEach(async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto('/playstyles/discard');
    await page.waitForTimeout(500);
  });

  test('should render hero with name and breadcrumb', async ({page}) => {
    // Page heading (h1) with playstyle name
    const heading = page.getByRole('heading', {level: 1});
    await expect(heading).toBeVisible({timeout: 10000});
    await expect(heading).toContainText('Discard');

    // Breadcrumb nav with "Playstyles" link (exclude the main nav header)
    const breadcrumb = page.locator('section nav').filter({hasText: 'Playstyles'});
    await expect(breadcrumb).toBeVisible();
    const playstyleLink = breadcrumb.getByRole('link', {name: 'Playstyles'});
    await expect(playstyleLink).toBeVisible();
  });

  test('should show and use role filter chips', async ({page}) => {
    // Wait for cards to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Get initial card count
    const initialCount = await cardTiles.count();
    expect(initialCount).toBeGreaterThan(0);

    // Discard exposes Forced/Targeted/Random Discard + Payoff mechanic tiles.
    // "Forced Discard" is the broadest enabler — its tile is reliably present.
    // (Labels come from the shared mechanics catalog; "standard" → "Forced Discard".)
    const forcedDiscardChip = page.getByRole('button', {name: /Forced Discard/});
    await expect(forcedDiscardChip).toBeVisible();

    // Click to apply the filter — card grid should narrow to forced-discard enablers.
    await forcedDiscardChip.click();
    await page.waitForTimeout(200);

    const filteredCount = await cardTiles.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // Click the same chip again to toggle it off — grid restores to full set.
    await forcedDiscardChip.click();
    await page.waitForTimeout(200);

    const resetCount = await cardTiles.count();
    expect(resetCount).toBe(initialCount);
  });

  test('should render card tiles in grid', async ({page}) => {
    // Let discard's tiles render before leaving the page. Leaving while its playstyle data is
    // still loading aborts that fetch, and WebKit logs the abort as "TypeError: Load failed",
    // which fails the console guard (#854).
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});

    // Navigate to a different playstyle (location-control)
    await page.goto('/playstyles/location-control');
    await page.waitForTimeout(500);

    // Card tiles should render
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    const count = await cardTiles.count();
    expect(count).toBeGreaterThan(5);
  });

  test('should open the card overview modal from playstyle detail', async ({page}) => {
    // Wait for card tiles to load
    const cardTiles = page.getByTestId('card-tile');
    await expect(cardTiles.first()).toBeVisible({timeout: 15000});

    // Click a card tile → opens the global modal (URL stays on the playstyle page).
    await cardTiles.first().click();
    // Modal open = React mount + per-card synergy fetch + visibility transition; slow CI
    // webkit can exceed 5s before the overlay-visible class settles. Match the 15s used above.
    await expect(page.getByTestId('card-overview-modal')).toBeVisible({timeout: 15000});
  });

  test('keeps a tile tooltip under the pointer, ignores clicks on it, and hides on Escape', async ({
    page,
  }) => {
    const tile = page.getByRole('button', {name: /Forced Discard/});
    await expect(tile).toBeVisible({timeout: 10000});
    const tooltip = page.getByRole('tooltip');

    // The pointer can cross from the tile onto its tooltip and stay there (WCAG 1.4.13, #836).
    await tile.hover();
    await expect(tooltip).toBeVisible();
    await slidePointerOnto(page, tooltip);
    await page.waitForTimeout(300); // past the tooltip's 150 ms close delay
    await expect(tooltip).toBeVisible();

    // The tooltip renders beside the tile's button, so a click on it doesn't toggle the filter.
    await tooltip.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
  });
});

/**
 * A playstyle page waits for its own card list, `_playstyles.json`, as well as the card list
 * (#913): until both are in, it shows its loading view, never "No cards match your filters."
 * It waits for its cards' mechanic tiles too, `_playstyleMechanics.json` (#930), and for the
 * guides, `playstyleGuides.json` (#995), so neither the tiles nor the guide arrive after the cards.
 */
test.describe('Playstyle Detail — loading', () => {
  const LOADING_VIEW = '[aria-label="Loading playstyle cards"]';
  const EMPTY_GRID = 'No cards match your filters.';

  /**
   * Opens `path` with `heldFile` held back until the page's other files have landed, then checks
   * that the page showed its loading view, never a card without `companion` on the page, and that
   * `shown` appears once the file is let go.
   */
  async function expectDrawnWithCards(
    page: Page,
    {path, heldFile, otherFiles, companion, shown}: DrawnWithCards,
  ) {
    // Notes any moment a card is on the page without its companion, from the first byte on.
    await page.addInitScript((selector) => {
      const seen = window as Window & {sawCardsAlone?: boolean};
      seen.sawCardsAlone = false;
      new MutationObserver(() => {
        const card = document.querySelector('[data-testid="card-tile"]');
        if (card && !document.querySelector(selector)) seen.sawCardsAlone = true;
      }).observe(document, {childList: true, subtree: true});
    }, companion);
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/data/${heldFile}`, async (route) => {
      await held;
      await route.continue();
    });
    const landed = otherFiles.map((file) =>
      page.waitForResponse((response) => response.url().includes(`/data/${file}`)),
    );

    await page.goto(path);
    await Promise.all(landed);
    // Time for the other files to land in the page, which could then draw its cards alone.
    await page.waitForTimeout(1000);
    await expect(page.locator(LOADING_VIEW)).toBeVisible();

    release();
    await expect(shown).toBeVisible({timeout: 15000});
    await expect(page.getByTestId('card-tile').first()).toBeVisible();
    expect(await page.evaluate(() => (window as Window & {sawCardsAlone?: boolean}).sawCardsAlone)).toBe(false);
  }

  test("shows its loading view, not an empty grid, until the playstyle's cards arrive", async ({page}) => {
    // Notes any moment the empty message is on the page, from the first byte on.
    await page.addInitScript((text) => {
      const seen = window as Window & {sawEmptyGrid?: boolean};
      seen.sawEmptyGrid = false;
      new MutationObserver(() => {
        if (document.body?.textContent?.includes(text)) seen.sawEmptyGrid = true;
      }).observe(document, {childList: true, subtree: true, characterData: true});
    }, EMPTY_GRID);
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/data/synergies/_playstyles.json', async (route) => {
      await held;
      await route.continue();
    });
    const cardList = page.waitForResponse((response) => response.url().includes('/data/allCards.json'));

    await page.goto('/playstyles/lore-denial');
    await cardList;
    // Time for the card list to land in the page, which on its own drew the empty grid.
    await page.waitForTimeout(1000);
    await expect(page.locator(LOADING_VIEW)).toBeVisible();

    release();
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    await expect(page.locator(LOADING_VIEW)).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & {sawEmptyGrid?: boolean}).sawEmptyGrid)).toBe(false);
  });

  test('draws its mechanic tiles in the same render as its cards', async ({page}, testInfo) => {
    // A phone keeps the tiles in a sheet; the desktop row shows them beside the cards.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await expectDrawnWithCards(page, {
      path: '/playstyles/discard',
      heldFile: 'synergies/_playstyleMechanics.json',
      otherFiles: ['allCards.json', 'synergies/_playstyles.json'],
      companion: 'section[aria-label="Mechanics"] button',
      shown: page.getByRole('button', {name: /Forced Discard/}),
    });
  });

  test('draws its guide in the same render as its cards', async ({page}) => {
    await expectDrawnWithCards(page, {
      path: '/playstyles/exert',
      heldFile: 'playstyleGuides.json',
      otherFiles: ['allCards.json', 'synergies/_playstyles.json', 'synergies/_playstyleMechanics.json'],
      companion: '#playstyle-guide-heading',
      shown: page.getByRole('region', {name: 'How to play Exert'}),
    });
  });

  test('the gallery asks for the mechanic ids and the guides only once it has drawn with its own card ids', async ({
    page,
  }) => {
    const LATER_FILES = ['/data/synergies/_playstyleMechanics.json', '/data/playstyleGuides.json'];
    const asked = new Set<string>();
    page.on('request', (request) => {
      for (const file of LATER_FILES) if (request.url().includes(file)) asked.add(file);
    });
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/data/synergies/_playstyles.json', async (route) => {
      await held;
      await route.continue();
    });

    await page.goto('/playstyles');
    await expect(page.locator('a[href="/playstyles/lore-denial"]').first()).toBeVisible({timeout: 15000});
    // Time for a request the gallery would make before its card ids, competing with them.
    await page.waitForTimeout(1000);
    expect([...asked]).toEqual([]);

    const later = LATER_FILES.map((file) => page.waitForResponse((response) => response.url().includes(file)));
    release();
    await Promise.all(later);
  });

  test('opened from the gallery, a playstyle shows its cards with no loading view between', async ({page}) => {
    // The gallery reads every file a playstyle page waits for: the mechanic ids and the guides
    // once it has drawn.
    const playstyleFiles = Promise.all(
      ['synergies/_playstyles.json', 'synergies/_playstyleMechanics.json', 'playstyleGuides.json'].map((file) =>
        page.waitForResponse((response) => response.url().includes(`/data/${file}`)),
      ),
    );
    await page.goto('/playstyles');
    await playstyleFiles;
    const link = page.locator('a[href="/playstyles/lore-denial"]').first();
    await expect(link).toBeVisible({timeout: 15000});

    // The gallery's read of the list answers the playstyle page's first render (#913).
    await page.evaluate((selector) => {
      const seen = window as Window & {sawLoadingView?: boolean};
      seen.sawLoadingView = false;
      new MutationObserver(() => {
        if (document.querySelector(selector)) seen.sawLoadingView = true;
      }).observe(document.body, {childList: true, subtree: true});
    }, LOADING_VIEW);
    await link.click();

    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    expect(await page.evaluate(() => (window as Window & {sawLoadingView?: boolean}).sawLoadingView)).toBe(false);
  });
});

/**
 * When `_playstyleMechanics.json` fails and the card lists load, the page keeps its cards and
 * says in the tiles' place that they failed, with a Try again that loads them alone (#930).
 */
test.describe('Playstyle Detail — tiles that failed to load', () => {
  // The page logs the failure it then shows.
  test.use({expectedConsoleErrors: [/^Failed to load playstyle mechanics:/]});
  const FAILED = "Couldn't load this playstyle's mechanics.";

  /** Fails every request for the mechanic ids until the function it returns lets them through. */
  async function failMechanics(page: Page): Promise<() => void> {
    let failing = true;
    await page.route('**/data/synergies/_playstyleMechanics.json', (route) =>
      failing ? route.fulfill({status: 503, body: ''}) : route.continue(),
    );
    return () => {
      failing = false;
    };
  }

  /** From now on, notes any moment the card grid's loading view shows, as a reload would show it. */
  async function watchCardGrid(page: Page) {
    await page.evaluate(() => {
      const seen = window as Window & {sawCardsLoading?: boolean};
      seen.sawCardsLoading = false;
      new MutationObserver(() => {
        const loading = document.querySelector('[aria-label="Loading playstyle cards"]');
        if (loading) seen.sawCardsLoading = true;
      }).observe(document.body, {childList: true, subtree: true});
    });
  }

  const sawCardsLoading = (page: Page) =>
    page.evaluate(() => (window as Window & {sawCardsLoading?: boolean}).sawCardsLoading);

  test('keeps the cards, and Try again draws the tiles in their row', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    const letThrough = await failMechanics(page);

    await page.goto('/playstyles/discard');
    const row = page.getByRole('group', {name: 'Mechanics'});
    await expect(row.getByRole('alert')).toHaveText(FAILED, {timeout: 15000});
    await expect(page.getByTestId('card-tile').first()).toBeVisible();

    letThrough();
    await watchCardGrid(page);
    await row.getByRole('button', {name: 'Try again'}).click();
    await expect(row.getByRole('button', {name: /Forced Discard/})).toBeVisible({timeout: 15000});
    await expect(row.getByRole('alert')).toHaveCount(0);
    // The button it pressed is gone, so the row holds focus: the next Tab reaches the first tile.
    await expect(row).toBeFocused();
    expect(await sawCardsLoading(page)).toBe(false);
  });

  test('on a phone, the Mechanics sheet says so, and Try again draws the tiles in it', async ({
    page,
  }, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();
    const letThrough = await failMechanics(page);

    await page.goto('/playstyles/discard');
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    await page.getByRole('button', {name: 'Mechanics', exact: true}).click();
    const sheet = page.getByRole('dialog', {name: 'Mechanics filter'});
    await expect(sheet.getByRole('alert')).toHaveText(FAILED);

    letThrough();
    await watchCardGrid(page);
    await sheet.getByRole('button', {name: 'Try again'}).click();
    await expect(sheet.getByRole('button', {name: /Forced Discard/})).toBeVisible({timeout: 15000});
    await expect(sheet).toBeFocused();
    expect(await sawCardsLoading(page)).toBe(false);
  });
});

/**
 * Exert's key cards as the page lists them: those still among its cards, which precompute writes
 * to `_playstyles.json`. Read when called, inside a test, since the dev server writes that file.
 */
function exertKeyCards(): {fullName: string; path: string}[] {
  const file = path.resolve(process.cwd(), 'public/data/synergies/_playstyles.json');
  const exertCards = new Set<string>(JSON.parse(fs.readFileSync(file, 'utf8')).exert);
  return EXERT_GUIDE.keyCards
    .filter((id) => exertCards.has(id))
    .map((id) => {
      const fullName = cardFullNameById(id);
      return {fullName, path: cardPath({id, fullName})};
    });
}

/**
 * Under its cards, a playstyle page has a written guide (#995): how the deck wins, how to build
 * it, and its key cards, each a link to its card page that opens the card window on a click.
 */
test.describe('Playstyle Detail — guide', () => {
  test('shows its guide under its cards, and a key card opens its window there', async ({page}) => {
    await page.goto('/playstyles/exert');
    const guide = page.getByRole('region', {name: 'How to play Exert'});
    await expect(guide).toBeVisible({timeout: 15000});
    await expect(guide.locator('p')).toHaveText(EXERT_GUIDE.paragraphs);

    const lastCard = (await page.getByTestId('card-tile').last().boundingBox())!;
    expect((await guide.boundingBox())!.y).toBeGreaterThanOrEqual(lastCard.y + lastCard.height);

    const keyCards = exertKeyCards();
    const links = guide.getByRole('link');
    await expect(links).toHaveText(keyCards.map((card) => card.fullName));
    expect(await links.evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')))).toEqual(
      keyCards.map((card) => card.path),
    );

    await links.first().click();
    const modal = page.getByTestId('card-overview-modal');
    await expect(modal).toBeVisible({timeout: 15000});
    await expect(modal.locator('h1')).toHaveText(keyCards[0].fullName);
    await expect(page).toHaveURL(/\/playstyles\/exert$/);
  });
});

/**
 * When `playstyleGuides.json` fails, the page leaves its guide out and shows everything else, as
 * it would with no guide at all: no error view, and nothing to retry (#995).
 */
test.describe('Playstyle Detail — guide that failed to load', () => {
  // The page logs the failure it then hides.
  test.use({expectedConsoleErrors: [/^Failed to load playstyle guides:/]});

  test('shows the cards and their tiles, with no guide and no error', async ({page}, testInfo) => {
    // A phone keeps the tiles in a sheet; the desktop row shows them beside the cards.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.route('**/data/playstyleGuides.json', (route) => route.fulfill({status: 500, body: ''}));

    await page.goto('/playstyles/discard');
    await expect(page.getByTestId('card-tile').first()).toBeVisible({timeout: 15000});
    const row = page.getByRole('group', {name: 'Mechanics'});
    await expect(row.getByRole('button', {name: /Forced Discard/})).toBeVisible();
    await expect(row.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('region', {name: /^How to play/})).toHaveCount(0);
    await expect(page.getByText('Failed to load card data.')).toHaveCount(0);
  });
});

/**
 * A playstyle's card list that failed shows the error view without waiting for the guides, which
 * never fail the page, so a slow guides file can't keep its Retry away (#995).
 */
test.describe('Playstyle Detail — cards that failed to load', () => {
  // The page logs the failure it then shows.
  test.use({expectedConsoleErrors: [/^Failed to load playstyle data:/]});

  test('shows the error view and its Retry while the guides still load', async ({page}) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/data/playstyleGuides.json', async (route) => {
      await held;
      await route.continue();
    });
    await page.route('**/data/synergies/_playstyles.json', (route) => route.fulfill({status: 500, body: ''}));

    await page.goto('/playstyles/exert');
    await expect(page.getByText('Failed to load card data.')).toBeVisible({timeout: 15000});
    await expect(page.getByRole('button', {name: 'Retry'})).toBeVisible();
    release();
  });
});

// On a phone a playstyle page and an ink page show their cards as Browse does: three a row,
// as wide as Browse's (owner, 2026-10-26).
test.describe('Card grids on a phone', () => {
  const firstTile = (page: Page) => page.getByTestId('card-tile').first();
  /**
   * The first row's columns, the gaps between them, and its room either side, inside the box that
   * scrolls it: Browse's own scroller, or the page. Equal, they make the cards equally wide on a
   * phone, whose scrollbars take no room. CI's WebKit draws classic ones, 8 px wide, which
   * narrow Browse's scroller and, on mobile-safari, not the page, so the widths themselves differ
   * there by a third of 8 px.
   */
  const firstRow = (page: Page) =>
    page.getByTestId('card-tile').evaluateAll((tiles) => {
      let scroller = tiles[0].parentElement;
      while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      const start = scroller ? scroller.getBoundingClientRect().left + scroller.clientLeft : 0;
      const end = start + (scroller ?? document.documentElement).clientWidth;
      const boxes = tiles.map((tile) => tile.getBoundingClientRect());
      const row = boxes.filter((box) => Math.abs(box.top - boxes[0].top) < 1);
      const px = (value: number) => Math.round(value * 10) / 10;
      return {
        columns: row.length,
        gaps: row.slice(1).map((box, i) => px(box.left - row[i].right)),
        left: px(row[0].left - start),
        right: px(end - row[row.length - 1].right),
      };
    });

  test("a playstyle page and an ink page show three cards a row, as wide as Browse's", async ({page}) => {
    await page.setViewportSize({width: 393, height: 659});
    await page.goto('/browse');
    await expect(firstTile(page)).toBeVisible({timeout: 15000});
    const browse = await firstRow(page);
    expect(browse.columns).toBe(3);
    for (const path of ['/playstyles/lore-denial', '/ink/amber']) {
      await page.goto(path);
      await expect(firstTile(page)).toBeVisible({timeout: 15000});
      expect(await firstRow(page), path).toEqual(browse);
    }
  });
});
