import type {Page, TestInfo} from '@playwright/test';
import {test, expect} from '../fixtures';
import {LAYOUT, SPACING} from 'inkweave-ui/tokens/theme';

/**
 * Browse's grid draws only the rows near its view and holds the room of the rest with its
 * padding (#931). These check that it lays the cards out as the CSS grid it replaced did: the
 * columns `repeat(auto-fill, minmax(…))` gives the scroller's width, 12 px apart, rows 12 px
 * apart, 24 px of glow room above the first row and under the last, and the last row level with
 * the docked filter panel. And that no frame shows a blank row, as none did under react-virtuoso:
 * not after a jump or a fast scroll, nor after a sort, an ink, two inks' dual-ink cards or a
 * search picked while scrolled far down (the issue's Step 9).
 */

const SCROLLER = '[data-testid="browse-grid-scroller"]';
/** The glow room above the first row and under the last. */
const ROOM = SPACING.xxl;
/**
 * The room above the first row: on a phone, less the 8 px Browse's toolbar keeps under its
 * buttons (owner, 2026-10-26), so the cards at rest sit where they did.
 */
const roomAbove = (isPhone: boolean) => (isPhone ? ROOM - SPACING.sm : ROOM);
/** A name only one card has. */
const ONE_CARD = 'Ariel Singing Mermaid';

/** Where the grid's drawn tiles sit against its view. */
interface Drawn {
  names: string[];
  viewTop: number;
  viewBottom: number;
  /** The top and bottom of the first row drawn, and of the last. */
  firstTop: number;
  firstBottom: number;
  lastTop: number;
  lastBottom: number;
  atEnd: boolean;
  /** No blank row shows: the rows drawn reach both edges of the view, or the list's own ends. */
  covered: boolean;
}

type GridWindow = Window & {
  readGrid: () => Drawn | null;
  blankFrames: {count: number; stopped: boolean};
  /** The scroller's scrollHeight at the first frame that drew a tile. */
  firstScrollHeight?: number;
};

/**
 * Gives the page `readGrid`, so the tests and the frame-by-frame count in `blankFramesDuring`
 * read the grid the same way. Null while it draws no tiles. Also notes the scroller's height at
 * the first frame that draws a tile: an animation frame runs before the frame's own layout and
 * resize observers, so it reads what the frame paints, unless an observer changes it before then.
 */
function installGridReader({selector, room}: {selector: string; room: number}) {
  const seen = window as unknown as GridWindow;
  const noteFirstFrame = () => {
    const scroller = document.querySelector<HTMLElement>(selector);
    if (scroller?.querySelector('[data-testid="card-tile"]')) seen.firstScrollHeight = scroller.scrollHeight;
    else requestAnimationFrame(noteFirstFrame);
  };
  requestAnimationFrame(noteFirstFrame);
  seen.readGrid = () => {
    const scroller = document.querySelector<HTMLElement>(selector);
    const tiles = [...(scroller?.querySelectorAll('[data-testid="card-tile"]') ?? [])];
    if (!scroller || !tiles.length) return null;
    const first = tiles[0].getBoundingClientRect();
    const last = tiles[tiles.length - 1].getBoundingClientRect();
    const viewTop = scroller.getBoundingClientRect().top;
    const viewBottom = viewTop + scroller.clientHeight;
    // The grid holds the room of every row, drawn or not, and the glow room at both ends: a row
    // within that room of either end is the list's first or last, with no row past it.
    const grid = scroller.firstElementChild!.getBoundingClientRect();
    const reachesTop = first.top <= viewTop + 0.5 || first.top - grid.top <= room + 1;
    const reachesBottom = last.bottom >= viewBottom - 0.5 || grid.bottom - last.bottom <= room + 1;
    return {
      names: tiles.map((tile) => tile.getAttribute('aria-label') ?? ''),
      viewTop,
      viewBottom,
      firstTop: first.top,
      firstBottom: first.bottom,
      lastTop: last.top,
      lastBottom: last.bottom,
      atEnd: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1,
      covered: reachesTop && reachesBottom,
    };
  };
}

const readGrid = (page: Page) => page.evaluate(() => (window as unknown as GridWindow).readGrid());

/** Waits for `count` frames to pass. */
const frames = (page: Page, count: number) =>
  page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const tick = () => (--left > 0 ? requestAnimationFrame(tick) : done());
        requestAnimationFrame(tick);
      }),
    count,
  );

/**
 * Runs `act` and counts the frames that show a blank row in the grid, until it has settled. A
 * frame's animation callbacks run after its scroll events and before it paints, so what they
 * read is what the frame shows.
 */
async function blankFramesDuring(page: Page, act: () => Promise<unknown>) {
  await page.evaluate(() => {
    const w = window as unknown as GridWindow;
    const watch = (w.blankFrames = {count: 0, stopped: false});
    const tick = () => {
      if (watch.stopped) return;
      if (!w.readGrid()?.covered) watch.count++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await expect
    .poll(async () => (await readGrid(page))?.covered, {message: 'no blank row stays'})
    .toBe(true);
  await frames(page, 3);
  return page.evaluate(() => {
    const watch = (window as unknown as GridWindow).blankFrames;
    watch.stopped = true;
    return watch.count;
  });
}

const maxScrollTop = (page: Page) =>
  page.locator(SCROLLER).evaluate((s) => s.scrollHeight - s.clientHeight);

/** Scrolls the grid to `top` in one jump, with no frame showing a blank row, and reads it there. */
async function scrollTo(page: Page, top: number) {
  const blank = await blankFramesDuring(page, () =>
    page.locator(SCROLLER).evaluate((scroller, y) => void (scroller.scrollTop = y), top),
  );
  expect(blank, `frames with a blank row, scrolling to ${top}`).toBe(0);
  return (await readGrid(page))!;
}

const onPhone = (testInfo: TestInfo) => testInfo.project.name.startsWith('mobile-');

async function openBrowse(page: Page) {
  await page.addInitScript(installGridReader, {selector: SCROLLER, room: ROOM});
  await page.goto('/browse');
  await expect(page.getByTestId('card-tile').first()).toBeVisible();
}

/** The grid's columns, tile size, gaps and height, read at the top of the scroller. */
function readLayout(page: Page, minColWidth: number) {
  return page.evaluate(
    ({selector, minColWidth, gap}) => {
      const scroller = document.querySelector(selector) as HTMLElement;
      const grid = scroller.firstElementChild as HTMLElement;
      const style = getComputedStyle(grid);
      const inner =
        grid.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      // The browser's own auto-fill, at the same width.
      const probe = document.createElement('div');
      probe.style.cssText = `display:grid;position:absolute;visibility:hidden;width:${inner}px;gap:${gap}px;grid-template-columns:repeat(auto-fill,minmax(${minColWidth}px,1fr))`;
      document.body.append(probe);
      const tracks = getComputedStyle(probe).gridTemplateColumns.split(' ');
      probe.remove();

      const boxes = [...scroller.querySelectorAll('[data-testid="card-tile"]')].map((tile) =>
        tile.getBoundingClientRect(),
      );
      const firstRow = boxes.filter((box) => Math.abs(box.top - boxes[0].top) < 1);
      return {
        autoFill: {columns: tracks.length, width: parseFloat(tracks[0])},
        columns: firstRow.length,
        tile: {width: boxes[0].width, height: boxes[0].height},
        // A one-column grid has no gap between columns to read.
        columnGap: firstRow.length > 1 ? boxes[1].left - boxes[0].right : null,
        rowGap: boxes[firstRow.length].top - boxes[0].bottom,
        roomAbove: boxes[0].top - scroller.getBoundingClientRect().top,
        scrollHeight: scroller.scrollHeight,
      };
    },
    {selector: SCROLLER, minColWidth, gap: SPACING.md},
  );
}

async function expectGridAsBefore(page: Page, isPhone: boolean) {
  await openBrowse(page);
  const layout = await readLayout(
    page,
    isPhone ? LAYOUT.cardGridMinWidthMobile : LAYOUT.cardGridMinWidth,
  );

  expect(layout.columns, JSON.stringify(layout)).toBe(layout.autoFill.columns);
  expect(layout.tile.width).toBeCloseTo(layout.autoFill.width, 0);
  expect(layout.tile.height).toBeCloseTo(layout.tile.width / LAYOUT.cardAspect, 0);
  if (layout.columnGap !== null) expect(layout.columnGap).toBeCloseTo(SPACING.md, 0);
  expect(layout.rowGap).toBeCloseTo(SPACING.md, 0);
  expect(layout.roomAbove).toBeCloseTo(roomAbove(isPhone), 0);
  // As tall as all its rows would be, drawn. Layout puts each row on a 1/64 px grid (Firefox's
  // is 1/60) and scrollHeight on whole pixels, so the sum can stray by that much per row.
  const rows = Math.ceil(LAYOUT.maxDisplayedCards / layout.columns);
  const fullHeight = roomAbove(isPhone) + ROOM + rows * layout.tile.height + (rows - 1) * SPACING.md;
  expect(
    Math.abs(layout.scrollHeight - fullHeight),
    `scrollHeight ${layout.scrollHeight} against ${rows} rows' ${fullHeight}`,
  ).toBeLessThanOrEqual(rows / 60 + 1);
  // And from its first frame: a classic scrollbar that comes in with the rows' room narrows the
  // grid, and room worked out from the width before it is too tall by a little every row (#1047).
  const firstFrame = await page.waitForFunction(() => (window as unknown as GridWindow).firstScrollHeight);
  const first = Number(await firstFrame.jsonValue());
  expect(
    Math.abs(first - fullHeight),
    `the first frame's scrollHeight ${first} against ${rows} rows' ${fullHeight}`,
  ).toBeLessThanOrEqual(rows / 60 + 1);

  // Scrolled a third and two thirds of the way down, then to the end: no frame shows a blank row.
  const maxTop = await maxScrollTop(page);
  await scrollTo(page, Math.round(maxTop / 3));
  await scrollTo(page, Math.round((2 * maxTop) / 3));
  const end = await scrollTo(page, maxTop);
  // The last row 24 px above the scroller's bottom, level with the docked panel's. The end of a
  // whole-pixel scrollHeight can sit up to a pixel past the content's.
  expect(end.atEnd).toBe(true);
  expect(
    Math.abs(end.lastBottom - (end.viewBottom - ROOM)),
    'room under the last row',
  ).toBeLessThanOrEqual(1);
  if (!isPhone) {
    const panel = await page.getByRole('complementary', {name: 'Filters'}).boundingBox();
    expect(panel, 'the docked filter panel').not.toBeNull();
    expect(
      Math.abs(end.lastBottom - (panel!.y + panel!.height)),
      'level with the panel',
    ).toBeLessThanOrEqual(1);
  }
  // And back to the top in one jump.
  const top = await scrollTo(page, 0);
  expect(top.firstTop - top.viewTop).toBeCloseTo(roomAbove(isPhone), 0);
  return layout;
}

/**
 * Picks inks, then Dual-ink cards when asked: in the docked panel on a desktop, in the Filters
 * drawer, then Apply, on a phone.
 */
async function pickInks(page: Page, isPhone: boolean, inks: string[], dualOnly = false) {
  const picks = inks.map((ink) => `Filter by ${ink}`);
  if (dualOnly) picks.push('Dual-ink cards');
  const filters = isPhone
    ? page.getByRole('dialog', {name: 'Filters'})
    : page.getByRole('complementary', {name: 'Filters'});
  if (isPhone) await page.getByRole('button', {name: 'Filters', exact: true}).click();
  for (const name of picks) await filters.getByRole('button', {name}).click();
  if (isPhone) {
    await filters.getByRole('button', {name: 'Apply', exact: true}).click();
    await expect(filters).toHaveCount(0);
  }
  await expect(page).toHaveURL(new RegExp(`[?&]ink=${inks.join('%2C')}(&|$)`));
}

/** Searches by name: the toolbar's box on a desktop, the search sheet and Enter on a phone. */
async function search(page: Page, isPhone: boolean, name: string) {
  if (isPhone) {
    await page.getByRole('button', {name: 'Search cards'}).click();
    const input = page
      .getByRole('dialog', {name: 'Search cards'})
      .getByPlaceholder('Search cards...');
    await input.fill(name);
    await expect(input).toHaveValue(name);
    await input.press('Enter');
  } else {
    const input = page.getByTestId('browse-search');
    await input.fill(name);
    await expect(input).toHaveValue(name);
  }
}

/** A 1x1 PNG: art for a tile, which keeps its image only while its art loads. */
const ART = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/**
 * Phones as their browsers show a page, with the bars showing: the five the owner compared before
 * picking three cards across (#968).
 */
const PHONES = [
  {name: 'iPhone 15', width: 393, height: 659},
  {name: 'iPhone 13 mini', width: 375, height: 629},
  {name: 'iPhone 15 Pro Max', width: 430, height: 739},
  {name: '360 px Android', width: 360, height: 732},
  {name: 'Pixel 7', width: 412, height: 839},
];

/** The first row: its tiles, the gaps between them, and the room either side, inside the grid. */
function readFirstRow(page: Page) {
  return page.locator(SCROLLER).evaluate((scroller) => {
    const grid = scroller.firstElementChild!.getBoundingClientRect();
    const boxes = [...scroller.querySelectorAll('[data-testid="card-tile"]')].map((tile) =>
      tile.getBoundingClientRect(),
    );
    const row = boxes.filter((box) => Math.abs(box.top - boxes[0].top) < 1);
    const px = (value: number) => Math.round(value * 10) / 10;
    return {
      columns: row.length,
      gaps: row.slice(1).map((box, i) => px(box.left - row[i].right)),
      left: px(row[0].left - grid.left),
      right: px(grid.right - row[row.length - 1].right),
    };
  });
}

/** How far under the toolbar's buttons, the lowest of them, the scroller and the first row start. */
function underToolbar(page: Page) {
  return page.evaluate((selector) => {
    const controls = document.querySelectorAll('[data-testid="browse-toolbar"] :is(button, select, input)');
    const buttons = Math.max(...[...controls].map((control) => control.getBoundingClientRect().bottom));
    const scroller = document.querySelector(selector)!;
    const tile = scroller.querySelector('[data-testid="card-tile"]')!;
    return {
      scroller: scroller.getBoundingClientRect().top - buttons,
      firstRow: tile.getBoundingClientRect().top - buttons,
    };
  }, SCROLLER);
}

/** The tiles wholly on screen: inside the scroller's view, above the phone's tab bar. */
function wholeTilesOnScreen(page: Page) {
  return page.locator(SCROLLER).evaluate((scroller) => {
    const top = scroller.getBoundingClientRect().top;
    const tabBar = document.querySelector('nav[aria-label="Mobile navigation"]');
    const bottom = Math.min(
      top + scroller.clientHeight,
      tabBar?.getBoundingClientRect().top ?? Infinity,
      window.innerHeight,
    );
    return [...scroller.querySelectorAll('[data-testid="card-tile"]')].filter((tile) => {
      const box = tile.getBoundingClientRect();
      return box.top >= top - 0.5 && box.bottom <= bottom + 0.5;
    }).length;
  });
}

test.describe("Browse's grid", () => {
  test('lays out its rows as before at the project viewport', async ({page}, testInfo) => {
    await expectGridAsBefore(page, onPhone(testInfo));
  });

  for (const width of [1024, 1600, 1920]) {
    test(`lays out its rows as before at ${width} px`, async ({page}, testInfo) => {
      if (onPhone(testInfo)) test.skip();
      await page.setViewportSize({width, height: 900});
      await expectGridAsBefore(page, false);
    });
  }

  // At 320 px, the narrowest phones' width, the grid has two columns. Columns counted without their
  // gaps would come to three there, a fault the phone projects' own widths can't show.
  test('lays out its rows as before at 320 px, in two columns', async ({page}) => {
    await page.setViewportSize({width: 320, height: 640});
    expect((await expectGridAsBefore(page, true)).columns).toBe(2);
  });

  test('shows three cards across on phones, six whole on an iPhone 15, the first nine loading at once', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'firefox' || testInfo.project.name === 'webkit',
      'Desktop Firefox and WebKit draw a classic scrollbar inside the grid, which a phone never does',
    );
    // Art for every tile that has some, so none swaps its image for its cost badge.
    await page.route(/\/card-images(-preview)?\//, (route) =>
      route.fulfill({contentType: 'image/png', body: ART}),
    );
    const [iPhone15, ...others] = PHONES;
    await page.setViewportSize(iPhone15);
    await openBrowse(page);

    for (const phone of [iPhone15, ...others]) {
      await page.setViewportSize(phone);
      const row = await readFirstRow(page);
      expect(row, phone.name).toEqual({
        columns: 3,
        gaps: [SPACING.md, SPACING.md],
        left: SPACING.lg,
        right: SPACING.lg,
      });
    }

    await page.setViewportSize(iPhone15);
    expect(await wholeTilesOnScreen(page), 'whole cards on an iPhone 15').toBeGreaterThanOrEqual(6);
    const art = (tile: number) => page.getByTestId('card-tile').nth(tile).locator('img');
    // A card with no art at all draws its cost, and no image to read.
    for (let tile = 0; tile < 10; tile++) {
      await expect(art(tile), `tile ${tile + 1}'s image`).toHaveCount(1);
    }
    for (let tile = 0; tile < 9; tile++) await expect(art(tile)).toHaveAttribute('loading', 'eager');
    await expect(art(9)).toHaveAttribute('loading', 'lazy');
  });

  test("keeps 8 px of page under the toolbar's buttons on phones, its first row where it was (owner, 2026-10-26)", async ({
    page,
  }) => {
    const [iPhone15] = PHONES;
    await page.setViewportSize(iPhone15);
    await openBrowse(page);
    for (const phone of PHONES) {
      await page.setViewportSize(phone);
      const under = await underToolbar(page);
      expect(under.scroller, `${phone.name}: the scroller under the buttons`).toBeCloseTo(SPACING.sm, 0);
      expect(under.firstRow, `${phone.name}: the first row under the buttons`).toBeCloseTo(ROOM, 0);
    }
  });

  test('draws a whole row past each edge of its view, the one Tab moves into', async ({page}) => {
    await openBrowse(page);
    const maxTop = await maxScrollTop(page);
    for (const top of [Math.round(maxTop / 3), Math.round((2 * maxTop) / 3)]) {
      const drawn = await scrollTo(page, top);
      expect(drawn.firstBottom, `the first row drawn, at ${top}`).toBeLessThanOrEqual(
        drawn.viewTop + 0.5,
      );
      expect(drawn.lastTop, `the last row drawn, at ${top}`).toBeGreaterThanOrEqual(
        drawn.viewBottom - 0.5,
      );
    }
  });

  test('shows no blank row while the wheel scrolls it fast to its end and back', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-safari',
      "Playwright's phone WebKit has no mouse wheel",
    );
    await openBrowse(page);
    const box = (await page.locator(SCROLLER).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Ten notches at a time, as fast as Playwright sends them, until the end, then the top.
    const wheelUntil = async (deltaY: number, done: (drawn: Drawn) => boolean) => {
      const isDone = async () => {
        const drawn = await readGrid(page);
        return !!drawn && done(drawn);
      };
      for (let round = 0; round < 40 && !(await isDone()); round++) {
        for (let notch = 0; notch < 10; notch++) await page.mouse.wheel(0, deltaY);
      }
      await expect.poll(isDone).toBe(true);
    };
    const blank = await blankFramesDuring(page, async () => {
      await wheelUntil(600, (drawn) => drawn.atEnd);
      await wheelUntil(-600, (drawn) => drawn.firstTop - drawn.viewTop > roomAbove(onPhone(testInfo)) - 0.5);
    });
    expect(blank, 'frames with a blank row').toBe(0);
  });

  test("shows a new order's cards at once while scrolled far down", async ({page}) => {
    await openBrowse(page);
    const before = await scrollTo(page, Math.round((2 * (await maxScrollTop(page))) / 3));
    const blank = await blankFramesDuring(page, async () => {
      await page.getByLabel('Sort cards').selectOption('name-asc');
      await expect.poll(async () => (await readGrid(page))?.names).not.toEqual(before.names);
    });
    expect(blank, 'frames with a blank row').toBe(0);
  });

  test("shows an ink's cards at once while scrolled far down", async ({page}, testInfo) => {
    await openBrowse(page);
    const before = await scrollTo(page, Math.round((2 * (await maxScrollTop(page))) / 3));
    const blank = await blankFramesDuring(page, async () => {
      await pickInks(page, onPhone(testInfo), ['Amber']);
      await expect.poll(async () => (await readGrid(page))?.names).not.toEqual(before.names);
    });
    expect(blank, 'frames with a blank row').toBe(0);
  });

  test("shows two inks' dual-ink cards at once while scrolled to the end", async ({
    page,
  }, testInfo) => {
    await openBrowse(page);
    await scrollTo(page, await maxScrollTop(page));
    // Amber and Steel share a card or two, so the list shrinks to a row far above the view, which
    // shows in the frame the filter lands in. A phone needs this one: there the search below has
    // the browser pull the scroller's offset back before that frame, clamped by the grid or not.
    const blank = await blankFramesDuring(page, async () => {
      await pickInks(page, onPhone(testInfo), ['Amber', 'Steel'], true);
      await expect(page).toHaveURL(/[?&]inkmatch=dual(&|$)/);
    });
    expect(blank, 'frames with a blank row').toBe(0);
    await expect(page.getByTestId('card-tile').first()).toBeInViewport();
  });

  test("shows a search's one card at once while scrolled to the end", async ({page}, testInfo) => {
    await openBrowse(page);
    await scrollTo(page, await maxScrollTop(page));
    // The list shrinks to one row far above the view: the browser pulls the scroller's offset
    // back to it, and the grid draws that row in the same frame.
    const tiles = page.getByTestId('card-tile');
    const blank = await blankFramesDuring(page, async () => {
      await search(page, onPhone(testInfo), ONE_CARD);
      await expect(tiles).toHaveCount(1);
    });
    expect(blank, 'frames with a blank row').toBe(0);
    await expect(tiles).toBeInViewport();
  });
});
