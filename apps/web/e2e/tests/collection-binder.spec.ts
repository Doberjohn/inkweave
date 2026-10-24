import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {newestCoreSet, setCards} from '../helpers/cardData';
import {
  artFilter,
  binder,
  board,
  BOARD,
  type Entries,
  hasStyleFor,
  MISSING_GREY,
  signInAsCollector,
  teethIn,
} from '../helpers/collector';
import {edges, luminance, meanDifference, middle, pixelsIn, placeOf} from '../helpers/screen';
import {viewSheets} from '../../src/features/cards/components/binderSheets';
import {settleOf} from '../../src/features/collection/binderPockets';

/**
 * The collection binder's look (#941): black pro pages of clear pockets in a zip binder's
 * board, as the owner picked it on 2026-10-24. Collection mode's own spec,
 * `collection-mode.spec.ts`, keeps the binder's layout, its numbers and the phone's lone page.
 *
 * What a computed style can't say, such as whether the zip and the sheet edges, drawn under the
 * pages, show at all, the tests read from the screen (`helpers/screen.ts`). Motion is measured
 * one frame part way through (`holdBinderMotion`). The sheet counts and the settle come from the
 * app's own `viewSheets` and `settleOf`.
 */

const SET = newestCoreSet();
const BASE = setCards(SET);
/** The collector holds a normal copy of each of the set's first three cards, and no other. */
const HELD_BASE = BASE.slice(0, 3);
const ENTRIES: Entries = Object.fromEntries(HELD_BASE.map((card) => [String(card.id), {normal: 1, foil: 0}]));

/**
 * A row lighter than this is a sheet's edge (#3a3a46, about 59): the board and the page are
 * about 20 with their grain, the gaps between the sheets darker still.
 */
const EDGE_LIGHT = 40;

/**
 * How many sheet edges show along a page's foot: the light rows in the strip just under it,
 * counted as runs, from 2px above its foot to 6px under it. Three edges and the gaps between
 * them take 6px, and the zip's teeth start 7px under the page.
 */
async function sheetEdgesUnder(page: Page, sheet: Locator): Promise<number> {
  const box = await edges(sheet);
  const rows = await pixelsIn(page, {x: middle(box) - 10, y: box.bottom - 2, width: 20, height: 8});
  const light = rows.map((row) => row.reduce((sum, pixel) => sum + luminance(pixel), 0) / row.length > EDGE_LIGHT);
  return light.filter((on, i) => on && !light[i - 1]).length;
}

/** What draws each pocket's sleeve (`::before`) and front sheet (`::after`), as the page computes them. */
function pocketLayers(pockets: Locator) {
  return pockets.evaluateAll((all) =>
    all.map((pocket) => {
      const [sleeve, front] = [getComputedStyle(pocket, '::before'), getComputedStyle(pocket, '::after')];
      return {
        sleeve: {drawn: sleeve.content !== 'none', image: sleeve.backgroundImage, presses: sleeve.pointerEvents},
        front: {
          drawn: front.content !== 'none',
          z: front.zIndex,
          border: front.borderImageSource,
          image: front.backgroundImage,
          size: front.backgroundSize,
          position: front.backgroundPosition,
          presses: front.pointerEvents,
        },
      };
    }),
  );
}

/**
 * A pocket's two layers, as `pocketLayers` reads them: the sleeve's frosted grain, and the front
 * sheet over the card, its seam of welded dots for a border and its cut a 1px line across its
 * top, 1px down. Neither takes a press.
 */
const POCKET_LAYERS = {
  sleeve: {drawn: true, image: expect.stringContaining('radial-gradient'), presses: 'none'},
  front: {
    drawn: true,
    z: '2',
    border: expect.stringContaining('data:image/svg+xml'),
    image: expect.stringMatching(/^linear-gradient/),
    size: expect.stringMatching(/^100% 1px/),
    position: expect.stringMatching(/^0px 1px/),
    presses: 'none',
  },
};

/**
 * The least a holo finish changes its card, as a `meanDifference`: about 14 on a tile with no
 * art, where the finish hidden at opacity 0 left 0.01. Taking any `mix-blend-mode` layer away
 * moves a few pixels by itself, so a screenshot that merely differs proves nothing.
 */
const HOLO_SHOWS = 3;

/** How grey a filter leaves the art: 1 all grey, 0 in colour. */
const greyIn = (filter: string) => Number(/grayscale\(([\d.]+)\)/.exec(filter)?.[1] ?? 0);

/** Where a card sits in its pocket: its top, from the pocket's top, and its height. */
function placeInPocket(tile: Locator): Promise<{top: number; height: number}> {
  return tile.evaluate((t) => {
    const card = t.getBoundingClientRect();
    const pocket = t.closest('.binder-pocket')!.getBoundingClientRect();
    return {top: card.top - pocket.top, height: card.height};
  });
}

/** The classes on a card's pocket that play its slide in or grey out, or '' for none. */
const pocketPlay = (tile: Locator) =>
  tile.evaluate((t) => /binder-(slide-in|grey-out)/.exec(t.closest('.binder-pocket > div')?.className ?? '')?.[0] ?? '');

/**
 * Holds every binder animation `at` ms in as it starts, so a test measures one frame part way
 * through. The page stops holding, and the held ones play on, at `releaseBinderMotion`.
 */
async function holdBinderMotion(page: Page, at: number): Promise<void> {
  await page.evaluate((ms) => {
    const root = document.documentElement;
    const hold = () => {
      const held = root.dataset.binderHold;
      if (!held) return;
      const binderMotion = document
        .getAnimations()
        .filter((motion): motion is CSSAnimation => motion instanceof CSSAnimation)
        .filter((motion) => motion.animationName.startsWith('binder-'));
      for (const motion of binderMotion) {
        motion.pause();
        motion.currentTime = Number(held);
      }
    };
    if (root.dataset.binderHold === undefined) document.addEventListener('animationstart', hold);
    root.dataset.binderHold = String(ms);
  }, at);
}

/** The binder animations the page holds now, by name (see `holdBinderMotion`). */
const heldBinderMotion = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((motion) => motion instanceof CSSAnimation && motion.playState === 'paused')
      .map((motion) => (motion as CSSAnimation).animationName)
      .filter((name) => name.startsWith('binder-')),
  );

async function releaseBinderMotion(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.dataset.binderHold = '';
    document
      .getAnimations()
      .filter((motion): motion is CSSAnimation => motion instanceof CSSAnimation)
      .filter((motion) => motion.animationName.startsWith('binder-'))
      .forEach((motion) => motion.play());
  });
}

/** A binder animation that started, or a pocket given a class to play one, with its card and when. */
interface Motion {
  name: string;
  card: string;
  at: number;
}

/**
 * Logs the binder's motion from now on: every binder animation that starts, and every pocket
 * given `binder-slide-in` or `binder-grey-out`. Read it with `binderMotion`.
 */
async function logBinderMotion(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log: Motion[] = [];
    (window as unknown as {binderMotion: Motion[]}).binderMotion = log;
    const cardOf = (el: Element) =>
      (el.closest('.card-tile') ?? el.querySelector('.card-tile'))?.getAttribute('aria-label') ?? '';
    document.addEventListener('animationstart', (e) => {
      if (e.animationName.startsWith('binder-'))
        log.push({name: e.animationName, card: cardOf(e.target as Element), at: performance.now()});
    });
    new MutationObserver((records) => {
      for (const {target} of records) {
        const play = /binder-(slide-in|grey-out)/.exec((target as Element).className)?.[0];
        if (play) log.push({name: play, card: cardOf(target as Element), at: performance.now()});
      }
    }).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['class']});
  });
}

const binderMotion = (page: Page) =>
  page.evaluate(() => (window as unknown as {binderMotion: Motion[]}).binderMotion);

test.describe("Collection mode, the binder's pages and pockets (#941)", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({page: _}, testInfo) => {
    // The desktop spread; the phone's lone page is tested at phone width in collection-mode.spec.ts.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
  });

  test('the card pages are black pro pages in a zip board, and the inside covers keep the blue board', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();

    // A page of cards is black and textured, with no picture; a cover is the blue board, and
    // the parchment is never asked for.
    const look = (sheet: Locator) =>
      sheet.evaluate((el) => ({colour: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage}));
    const cardPage = await look(binder(page).getByRole('group', {name: 'Right page'}));
    expect(cardPage.colour).toBe('rgb(18, 18, 23)');
    expect(cardPage.image).toContain('radial-gradient');
    expect(cardPage.image).not.toContain('url(');
    expect((await look(binder(page).getByRole('group', {name: 'Front cover'}))).image).toContain('binder-cover.webp');
    expect(requests.filter((path) => path.endsWith('/binder.webp'))).toEqual([]);

    // The board: 14px round the pages, its zip's teeth along each cover's top and outer side,
    // two zips that stop either side of the spine, and the pull near the top right corner.
    expect(
      await board(page).evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
      }),
    ).toEqual(Array.from({length: 4}, () => `${BOARD}px`));
    await page.mouse.move(0, 0);
    const frame = await edges(board(page));
    const centre = middle(frame);
    // A stretch of each cover's zip, clear of the corners, the spine and the pull.
    const span = Math.min(160, (centre - frame.left) / 2);
    const along = (x: number) => ({x, y: frame.top + 3, width: span, height: 4});
    const down = (x: number) => ({x, y: frame.top + 40, width: 4, height: span});
    expect(await teethIn(page, along(frame.left + 30)), 'teeth along the left cover').toBeGreaterThan(0.25);
    expect(await teethIn(page, along(centre + 30)), 'teeth along the right cover').toBeGreaterThan(0.25);
    expect(await teethIn(page, down(frame.left + 3)), "teeth down the left cover's side").toBeGreaterThan(0.25);
    expect(await teethIn(page, down(frame.right - 7)), "teeth down the right cover's side").toBeGreaterThan(0.25);
    expect(await teethIn(page, {x: centre - 4, y: frame.top + 3, width: 8, height: 4}), 'teeth over the spine').toBe(0);
    const pull = await edges(binder(page).locator('.binder-zip-pull'));
    expect([pull.right - pull.left, pull.bottom - pull.top]).toEqual([26, 8]);
    expect(frame.right - pull.right, 'the pull from the right corner').toBeCloseTo(54, 0);
    // The binder's own stylesheet is what draws it, loaded with its code (see the visit in
    // collection-mode.spec.ts that never opens collection mode).
    expect(await hasStyleFor(page, '.binder-board')).toBe(true);
  });

  test('the sheets under each page show along its foot, by how far through the binder the spread is', async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
    const shown = binder(page).getByRole('navigation', {name: 'Binder pages'}).locator('[aria-current="true"]');
    const spreads = Number(/ of (\d+)/.exec((await shown.getAttribute('aria-label')) ?? '')?.[1]);
    expect(spreads, 'spreads in the set').toBeGreaterThan(3);
    // Each side's sheet: a page, or the cover where there is none.
    const leftSide = binder(page).getByRole('group', {name: /^(Left page|Front cover)$/});
    const rightSide = binder(page).getByRole('group', {name: /^(Right page|Back cover)$/});
    const sheetsAt = async (spread: number) => {
      await expect(shown).toHaveAccessibleName(new RegExp(`^Spread ${spread} of ${spreads}:`));
      return [await sheetEdgesUnder(page, leftSide), await sheetEdgesUnder(page, rightSide)];
    };
    // Paged from the keyboard, so the pointer never meets the pockets, whose glow under it reaches
    // past the page's foot. A click also waits for the Next button to hold still, which took
    // WebKit on CI up to 2.7s a turn.
    await binder(page).getByRole('button', {name: 'Next spread'}).focus();
    const turn = () => page.keyboard.press('Enter');

    // Spread 2: every sheet still to come under the right page, none turned under the left.
    await turn();
    expect(await sheetsAt(2), 'spread 2: under the left page, under the right').toEqual([0, 3]);
    // Spread 3: one turned, and fewer to come.
    await turn();
    const third = viewSheets(2, spreads, false);
    expect(await sheetsAt(3), 'spread 3').toEqual([third.left, third.right]);
    // The last spread: the reverse of the second.
    for (let at = 3; at < spreads; at++) await turn();
    expect(await sheetsAt(spreads), 'the last spread').toEqual([3, 0]);
  });

  test("every pocket has its sleeve and front sheet, and a press anywhere on its card reaches the card", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tile = binder(page).getByTestId('card-tile').nth(HELD_BASE.length);
    await expect(tile).toBeVisible();

    // A frosted sleeve behind the card, and over it a clear front sheet with its cut line along
    // its top and a seam of welded dots for its border, on every pocket of a page of cards, an
    // empty one past the last card too. Neither takes a press.
    const pockets = binder(page).getByRole('group', {name: 'Right page'}).locator('.binder-pocket');
    await expect(pockets).toHaveCount(12);
    expect(await pocketLayers(pockets)).toEqual(Array.from({length: 12}, () => POCKET_LAYERS));
    expect(await binder(page).getByRole('group', {name: 'Front cover'}).locator('.binder-pocket').count()).toBe(0);

    // At the card's centre and 4px inside each of its edges, the page finds the card itself.
    const box = await edges(tile);
    const y = (box.top + box.bottom) / 2;
    const points: Record<string, [number, number]> = {
      centre: [middle(box), y],
      top: [middle(box), box.top + 4],
      right: [box.right - 4, y],
      bottom: [middle(box), box.bottom - 4],
      left: [box.left + 4, y],
    };
    await page.mouse.move(0, 0);
    for (const [where, point] of Object.entries(points)) {
      expect(await tile.evaluate((t, [x, py]) => t.contains(document.elementFromPoint(x, py)), point), where).toBe(true);
    }
    // And a press there opens its card window. The foot is the copies stripe's once a mouse
    // points at the pocket (owner, 2026-10-20, #826), as before the pockets.
    const name = await tile.getAttribute('aria-label');
    const modal = page.getByTestId('card-overview-modal');
    for (const where of ['centre', 'top', 'right', 'left']) {
      await page.mouse.click(...points[where]);
      await expect(modal.locator('h1'), where).toHaveText(name ?? '');
      // The dialog moves focus to its × 100ms after opening; a 100ms timer set now runs after it.
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
    }
    await page.mouse.move(...points.bottom);
    const onStripe = await tile.evaluate(
      (t, [x, py]) => !!t.closest('.binder-pocket')?.querySelector('.binder-copies')?.contains(document.elementFromPoint(x, py)),
      points.bottom,
    );
    expect(onStripe, "the foot's press on the open stripe").toBe(true);
  });

  test('a card held in foil wears the holo finish, and no other card does', async ({page}) => {
    const [foil, normal, both] = BASE;
    await signInAsCollector(page, {
      [foil.id]: {normal: 0, foil: 1},
      [normal.id]: {normal: 1, foil: 0},
      [both.id]: {normal: 2, foil: 1},
    });
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByTestId('card-tile');
    await expect(tiles.first()).toBeVisible();

    // The foil, the normal copy, the card held in both, and the first card not held at all.
    const holo = (tile: Locator) =>
      tile.evaluate((t) => {
        const finish = getComputedStyle(t, '::after');
        return finish.content !== 'none' && finish.backgroundImage.includes('repeating-linear-gradient');
      });
    expect(await Promise.all([0, 1, 2, 3].map((i) => holo(tiles.nth(i))))).toEqual([true, false, true, false]);

    // And it shows: the foil drawn without it is a different picture, once its art has settled.
    await page.mouse.move(0, 0);
    const foilTile = tiles.first();
    await expect
      .poll(() =>
        foilTile.evaluate((t) => {
          const art = t.querySelector('img');
          return !art || (art.complete && getComputedStyle(art).opacity === '1');
        }),
      )
      .toBe(true);
    const clip = await placeOf(foilTile);
    const withFinish = await pixelsIn(page, clip);
    await foilTile.evaluate((t) => t.closest('.binder-foil')?.classList.remove('binder-foil'));
    const shift = meanDifference(withFinish, await pixelsIn(page, clip));
    expect(shift, 'what the holo finish changes on screen').toBeGreaterThan(HOLO_SHOWS);
  });

  test("each card settles a hair off straight at its pocket's foot, the same card the same way on every visit", async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByRole('group', {name: 'Right page'}).getByTestId('card-tile');
    await expect(tiles).toHaveCount(12);
    const settled = () =>
      tiles.evaluateAll((all) =>
        all.map((t) => {
          const stripe = t.closest('.binder-pocket')!.querySelector('.binder-copies')!;
          return {
            name: t.getAttribute('aria-label') ?? '',
            translate: getComputedStyle(t).translate,
            rotate: getComputedStyle(t).rotate,
            stripe: getComputedStyle(stripe).translate,
          };
        }),
      );

    const first = await settled();
    for (const {name, translate, rotate, stripe} of first) {
      const [across, down = 0] = translate.split(' ').map(parseFloat);
      const turn = parseFloat(rotate);
      expect(Math.abs(across), `${name}: across`).toBeLessThanOrEqual(1);
      expect(down, `${name}: down`).toBeGreaterThanOrEqual(0.4);
      expect(down, `${name}: down`).toBeLessThanOrEqual(1.6);
      expect(Math.abs(turn), `${name}: turned`).toBeLessThanOrEqual(0.8);
      // Its own, from its id, and its copies stripe moves with it.
      const card = BASE.find((c) => c.fullName === name);
      expect(card, `${name} is Set ${SET}'s`).toBeDefined();
      const {sx, sy, sr} = settleOf(String(card!.id));
      expect(across, `${name}: across, from its id`).toBeCloseTo(sx, 2);
      expect(down, `${name}: down, from its id`).toBeCloseTo(sy, 2);
      expect(turn, `${name}: turned, from its id`).toBeCloseTo(sr, 2);
      expect(stripe, `${name}: its copies stripe`).toBe(translate);
    }

    await page.reload();
    await expect(tiles).toHaveCount(12);
    expect(await settled()).toEqual(first);
  });

  test('a first copy slides into its pocket from the top as its colour comes in, and taking out the last greys it', async ({
    page,
  }) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByTestId('card-tile');
    const missing = tiles.nth(HELD_BASE.length);
    await expect(missing).toBeVisible();
    const rest = await placeInPocket(missing);
    expect(await artFilter(missing)).toBe(MISSING_GREY);

    // A first copy from its stripe: 150ms in, the card is on its way down from above its pocket,
    // its colour part way in.
    await holdBinderMotion(page, 150);
    await missing.hover();
    await binder(page)
      .getByRole('group', {name: '0 normal, 0 foil', exact: true})
      .getByRole('button', {name: 'Add one copy of normal', includeHidden: true})
      .click();
    await expect.poll(() => heldBinderMotion(page)).toEqual(expect.arrayContaining(['binder-slide', 'binder-colour-in']));
    const partWay = await placeInPocket(missing);
    expect(partWay.top, 'part way: above where it rests').toBeLessThan(rest.top - 3);
    expect(partWay.top, 'part way: no higher than it starts').toBeGreaterThan(rest.top - 0.34 * rest.height - 2);
    const greyPartWay = greyIn(await artFilter(missing));
    expect(greyPartWay, 'part way: its colour coming in').toBeGreaterThan(0.05);
    expect(greyPartWay, 'part way: its colour coming in').toBeLessThan(0.95);
    // Then it rests where it settled, in colour, and its pocket stops playing.
    await releaseBinderMotion(page);
    await expect.poll(() => pocketPlay(missing)).toBe('');
    expect(await placeInPocket(missing)).toEqual(rest);
    expect(await artFilter(missing)).toBe('none');

    // The last copy of a held card: its colour drains back to grey, the card staying put.
    const held = tiles.first();
    const heldRest = await placeInPocket(held);
    await holdBinderMotion(page, 150);
    await held.hover();
    await binder(page)
      .getByRole('group', {name: '1 normal, 0 foil', exact: true})
      .getByRole('button', {name: 'Remove one copy of normal', includeHidden: true})
      .click();
    await expect.poll(() => heldBinderMotion(page)).toContain('binder-colour-out');
    const draining = greyIn(await artFilter(held));
    expect(draining, 'part way: its colour draining').toBeGreaterThan(0.05);
    expect(draining, 'part way: its colour draining').toBeLessThan(0.95);
    expect(await placeInPocket(held)).toEqual(heldRest);
    await releaseBinderMotion(page);
    await expect.poll(() => pocketPlay(held)).toBe('');
    expect(await artFilter(held)).toBe(MISSING_GREY);
  });

  test('under reduced motion a copy added or taken out changes its card at once', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByTestId('card-tile');
    const missing = tiles.nth(HELD_BASE.length);
    await expect(missing).toBeVisible();
    const rest = await placeInPocket(missing);
    await logBinderMotion(page);

    await missing.hover();
    await binder(page)
      .getByRole('group', {name: '0 normal, 0 foil', exact: true})
      .getByRole('button', {name: 'Add one copy of normal', includeHidden: true})
      .click();
    await expect(binder(page).getByRole('group', {name: '1 normal, 0 foil', exact: true})).toBeVisible();
    expect(await artFilter(missing)).toBe('none');
    expect(await placeInPocket(missing)).toEqual(rest);

    const held = tiles.first();
    await held.hover();
    await binder(page)
      .getByRole('group', {name: '1 normal, 0 foil', exact: true})
      .getByRole('button', {name: 'Remove one copy of normal', includeHidden: true})
      .click();
    await expect(binder(page).getByRole('group', {name: '0 normal, 0 foil', exact: true})).toBeVisible();
    expect(await artFilter(held)).toBe(MISSING_GREY);

    // Two frames on, nothing has played, nor been told to.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await binderMotion(page)).toEqual([]);
  });

  test("copies changed in the card window play in their pockets once it closes", async ({page}) => {
    await signInAsCollector(page, ENTRIES);
    await page.goto(`/browse?binder=${SET}`);
    const tiles = binder(page).getByTestId('card-tile');
    const missing = tiles.nth(HELD_BASE.length);
    const held = tiles.nth(HELD_BASE.length - 1);
    await expect(missing).toBeVisible();
    const [missingName, heldName] = [HELD_BASE.length, HELD_BASE.length - 1].map((i) => BASE[i].fullName);
    await expect(missing).toHaveAccessibleName(missingName);
    await logBinderMotion(page);

    // A first copy of the missing card in its window, then the last copy of the held card before
    // it, which the window's arrows reach. Clicked near the card's top, clear of its stripe.
    await missing.click({position: {x: 10, y: 10}});
    const modal = page.getByTestId('card-overview-modal');
    await expect(modal.locator('h1')).toHaveText(missingName);
    const copies = page.getByTestId('card-overview-copies-slot').getByRole('group');
    // The dialog moves focus to its × 100ms after opening; a 100ms timer set now runs after it.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
    await copies.getByRole('button', {name: `Add one copy of ${missingName}`, exact: true}).focus();
    await page.keyboard.press('Enter');
    await expect(copies).toHaveAccessibleName('Your copies: 1 normal, 0 foil');
    await page.keyboard.press('ArrowLeft');
    await expect(modal.locator('h1')).toHaveText(heldName);
    await copies.getByRole('button', {name: `Remove one copy of ${heldName}`, exact: true}).focus();
    await page.keyboard.press('Enter');
    await expect(copies).toHaveAccessibleName('Your copies: 0 normal, 0 foil');

    // While the window is open, the pockets show the cards as they were, and nothing plays: also
    // over an expanded group and a comparison, which take away the slot under the window's card.
    const stillWaiting = async (over: string) => {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(await artFilter(missing), over).toBe(MISSING_GREY);
      expect(await artFilter(held), over).toBe('none');
      expect(await binderMotion(page), over).toEqual([]);
    };
    await stillWaiting('the window');
    await modal.locator('[data-group-key] [data-testid="more-tile"]').first().click();
    await expect(modal).toHaveAttribute('data-state', 'expanded');
    await stillWaiting('an expanded group');
    await modal.getByText(/back to all synergies/i).click();
    await modal.locator('[data-group-key] a.card-tile').first().click();
    await expect(modal).toHaveAttribute('data-mode', 'comparison');
    await stillWaiting('a comparison');
    // Escape steps out of the comparison, and then closes the window.
    await page.keyboard.press('Escape');
    await expect(modal).toHaveAttribute('data-mode', 'default');

    const closedAt = await page.evaluate(() => performance.now());
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    // Closed, the first copy slides in and the last copy's card greys, both after the close.
    await expect
      .poll(async () => (await binderMotion(page)).map(({name, card}) => `${name}: ${card}`))
      .toEqual(expect.arrayContaining([`binder-slide: ${missingName}`, `binder-colour-out: ${heldName}`]));
    expect((await binderMotion(page)).every(({at}) => at > closedAt), 'played before the window closed').toBe(true);
    await expect.poll(() => pocketPlay(missing)).toBe('');
    await expect.poll(() => pocketPlay(held)).toBe('');
    expect(await artFilter(missing)).toBe('none');
    expect(await artFilter(held)).toBe(MISSING_GREY);
  });
});
