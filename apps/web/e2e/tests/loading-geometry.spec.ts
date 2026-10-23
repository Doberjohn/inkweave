import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_FRIEND_CODE, holdSupabasePath} from '../fixtures/supabaseStub';
import {everyCardPage, longestPlainNamedCoreCharacter, shortestNamedCoreCharacter} from '../helpers/cardData';
import {serveFriends, type Player} from '../helpers/friends';
import {holdLazyModule} from '../helpers/lazyModule';
import {signInAs} from '../helpers/session';
import {cardNameHint} from '../../src/pages/cardNameHint';

/**
 * Loading placeholders sit in the boxes of what replaces them (#914), so nothing moves when
 * code or data lands. Each test holds the one request its moment waits on, reads the
 * placeholder's box, releases, and reads the loaded element's box: equal within 1 px.
 *
 * chromium and mobile-chrome only, at 1440x900 and 390x844, the sizes the loading-states
 * gallery was shot at: WebKit and Firefox draw classic scrollbars, which change widths once a
 * page scrolls.
 */

const DESKTOP = {width: 1440, height: 900};
const PHONE = {width: 390, height: 844};

test.beforeEach(async ({page}, testInfo) => {
  const project = testInfo.project.name;
  test.skip(project !== 'chromium' && project !== 'mobile-chrome', 'Measured on chromium and mobile-chrome');
  await page.setViewportSize(project === 'mobile-chrome' ? PHONE : DESKTOP);
});

const isPhone = (projectName: string) => projectName === 'mobile-chrome';

type Box = {x: number; y: number; width: number; height: number};

/** The element's box, once the page's fonts have loaded (a late font moves text). */
async function boxOf(locator: Locator): Promise<Box> {
  await locator.page().evaluate(() => document.fonts.ready.then(() => undefined));
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No box for ${locator}`);
  return box;
}

/** Within 1 px, side by side: what moved and by how much, when anything did. */
function expectSameBox(loaded: Box, placeholder: Box, keys: (keyof Box)[] = ['x', 'y', 'width', 'height']): void {
  for (const key of keys) {
    expect(Math.abs(loaded[key] - placeholder[key]), `${key}: ${placeholder[key]} -> ${loaded[key]}`).toBeLessThanOrEqual(1);
  }
}

/** Holds the requests `url` matches until the returned release() runs. */
async function hold(page: Page, url: RegExp): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(url, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

const CARD_LIST = /\/data\/allCards\.json/;

/** The first tile of a loading grid: its tiles sit in a grid inside the labelled region. */
const firstPlaceholder = (page: Page, label: string) => page.locator(`[aria-label="${label}"] > div > div`).first();

test('the home page keeps its featured heading still across its three loading frames', async ({page}, testInfo) => {
  const homePage = await holdLazyModule(page, 'HomePage');
  // The card list too: once it is in, the featured row draws from it rather than its own file (#641).
  const releaseData = [await hold(page, /\/data\/featuredCards\.json/), await hold(page, CARD_LIST)];
  const heading = page.getByText('Popular Synergy Starters', {exact: true});

  // 1. The home page's code is loading: the router's fallback. DOMContentLoaded, since the held
  // chunk is part of the page's load (see E2E_TESTS.md's Patterns).
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect
    .poll(homePage.caught, {message: "the home page's chunk never reached the hold", timeout: 10000})
    .toBeGreaterThan(0);
  await expect(page.locator('main[aria-label="Loading home"]')).toBeVisible();
  const codeLoading = await boxOf(heading);
  if (isPhone(testInfo.project.name)) {
    // The phone skeleton, not the desktop one cut off on both sides: the search bar spans the
    // screen inside its two 16 px gutters, and nothing overflows.
    expect((await boxOf(page.locator('.inkweave-home-skel-flex'))).width).toBeCloseTo(PHONE.width - 32, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width);
  }

  // 2. The page is in, its featured cards are not.
  homePage.release();
  await expect(page.getByPlaceholder('Search for a card...')).toBeVisible();
  await expect(page.locator('[aria-label="Popular Synergy Starters loading"]')).toBeVisible();
  const cardsLoading = await boxOf(heading);

  // 3. Loaded.
  for (const release of releaseData) release();
  await expect(page.getByTestId('featured-cards')).toBeVisible();
  const loaded = await boxOf(heading);

  expectSameBox(cardsLoading, codeLoading, ['y']);
  expectSameBox(loaded, codeLoading, ['y']);
});

for (const path of ['/browse', '/ink/amber']) {
  test(`the first card on ${path} lands in its placeholder's box`, async ({page}) => {
    const release = await hold(page, CARD_LIST);
    await page.goto(path);
    const placeholder = firstPlaceholder(page, 'Loading cards');
    await expect(placeholder).toBeVisible();
    const loading = await boxOf(placeholder);

    release();
    const tile = page.getByTestId('card-tile').first();
    await expect(tile).toBeVisible();
    expectSameBox(await boxOf(tile), loading);
  });
}

/** How many tiles share the first row, and how wide the first one is. */
function firstRow(tiles: Locator): Promise<{columns: number; width: number}> {
  return tiles.evaluateAll((elements) => {
    const boxes = elements.map((element) => element.getBoundingClientRect());
    const top = boxes[0].top;
    return {columns: boxes.filter((box) => Math.abs(box.top - top) < 1).length, width: boxes[0].width};
  });
}

/**
 * A playstyle page's loading grid against its loaded grid: the first row's columns, and the
 * first tile's box. The hero and the toolbar draw as loaded, and on desktop a placeholder holds
 * the mechanics row's box, so the grid starts where the loaded one does.
 */
async function expectPlaystyleGridInPlace(page: Page, playstyle: string): Promise<void> {
  const release = await hold(page, CARD_LIST);
  await page.goto(`/playstyles/${playstyle}`);
  const placeholders = page.locator('[aria-label="Loading playstyle cards"] > div > div');
  await expect(placeholders.first()).toBeVisible();
  const loading = await firstRow(placeholders);
  const placeholder = await boxOf(placeholders.first());

  release();
  const tiles = page.getByTestId('card-tile');
  await expect(tiles.first()).toBeVisible();
  expect((await firstRow(tiles)).columns).toBe(loading.columns);
  expectSameBox(await boxOf(tiles.first()), placeholder);
}

// Lore Denial's tagline takes one line on a phone, Ramp's two.
for (const playstyle of ['lore-denial', 'ramp']) {
  test(`the ${playstyle} playstyle's loading grid has its loaded grid's place, columns and tiles`, async ({page}) => {
    await expectPlaystyleGridInPlace(page, playstyle);
  });
}

test("on a 360 px phone, the playstyle toolbar's two rows hold the grid in place", async ({page}, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "A narrow phone's toolbar");
  // The toolbar wraps onto a second row here, and the Mechanics button decides where: it holds
  // its place, off, while the cards load.
  await page.setViewportSize({width: 360, height: 740});
  await expectPlaystyleGridInPlace(page, 'ramp');
});

test("the card page's loading layout puts the card and the results where the page will", async ({page}, testInfo) => {
  // Entered by its id alone, so no name in the address: one line of name on any phone, as the
  // placeholder draws it then (the tests below enter by a card's whole address).
  const card = shortestNamedCoreCharacter();
  const releaseCards = await hold(page, CARD_LIST);
  // Then the card's synergies, so the results' own skeleton shows in the loaded frame.
  const releaseSynergies = await hold(page, new RegExp(`/data/synergies/${card.id}\\.json`));
  await page.goto(`/card/${card.id}`);
  const loadingCard = page.locator('main[aria-label="Loading card"]');
  await expect(loadingCard).toBeVisible();
  const art = await boxOf(loadingCard.locator('.ink-card-placeholder').first());
  const results = await boxOf(page.getByTestId('synergy-results-loading'));

  releaseCards();
  await expect(loadingCard).toHaveCount(0);
  const phone = isPhone(testInfo.project.name);
  const image = phone
    ? page.locator('section[aria-label="Synergy results"] article').getByRole('img', {name: card.fullName}).first()
    : page.getByTestId('card-detail-panel').getByRole('img', {name: card.fullName}).first();
  expectSameBox(await boxOf(image), art);
  // Beside the panel on desktop. On a phone the results follow the card's block, whose rules
  // text runs as long as the card's, so only the art's box is the card's own there.
  if (!phone) expectSameBox(await boxOf(page.getByTestId('synergy-results-loading')), results, ['x', 'y']);
  releaseSynergies();
  await expect(page.getByTestId('synergy-results-loading')).toHaveCount(0);
});

/** The phone heading's line: CardDetail's name, 20 px at a line height of 1.2. */
const NAME_LINE = 24;

/**
 * How far down a box the middles of the bars it shows are, in px: the bars whose middle the page
 * hit-tests to the bar, so none the box cuts off.
 */
function barMiddles(box: Locator): Promise<number[]> {
  return box.evaluate((el) => {
    const boxTop = el.getBoundingClientRect().top;
    return [...el.querySelectorAll('.react-loading-skeleton')].flatMap((bar) => {
      const {left, top, width, height} = bar.getBoundingClientRect();
      const middle = top + height / 2;
      return bar.contains(document.elementFromPoint(left + width / 2, middle)) ? [Math.round(middle - boxTop)] : [];
    });
  });
}

/**
 * The phone card page, entered by a card's own address while the card list loads: the name's
 * placeholder takes the lines of the name the address spells, a bar in each, so the heading and
 * the art land in its boxes.
 */
async function expectCardNameInPlace(page: Page): Promise<void> {
  const card = longestPlainNamedCoreCharacter();
  const releaseCards = await hold(page, CARD_LIST);
  await page.goto(card.path);
  const loadingName = page.getByTestId('card-name-loading');
  const placeholder = await boxOf(loadingName);
  const lines = Math.round(placeholder.height / NAME_LINE);
  // Two lines or more, or a one-line placeholder would pass this too.
  expect(lines, card.fullName).toBeGreaterThanOrEqual(2);
  // A bar in the middle of each line, and none beyond the last.
  expect(await barMiddles(loadingName)).toEqual(Array.from({length: lines}, (_, i) => i * NAME_LINE + NAME_LINE / 2));
  const art = await boxOf(page.locator('main[aria-label="Loading card"] .ink-card-placeholder').first());

  releaseCards();
  const block = page.locator('section[aria-label="Synergy results"] article');
  expectSameBox(await boxOf(block.getByRole('heading', {level: 1, name: card.fullName, exact: true})), placeholder);
  expectSameBox(await boxOf(block.getByRole('img', {name: card.fullName}).first()), art);
}

test("on a phone, the card page's loading name takes the lines of the name in its address", async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "The phone's card block");
  await expectCardNameInPlace(page);
});

test("on a 360 px phone, the card page's loading name takes the lines of the name in its address", async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "The phone's card block");
  await page.setViewportSize({width: 360, height: 740});
  await expectCardNameInPlace(page);
});

/** Common phone widths: a small Android, an iPhone, a Pixel. */
const PHONE_WIDTHS = [360, 390, 412];

/**
 * The lines each text takes set in one of the name's boxes at the page's width: in the box's
 * first child (the placeholder's unseen name) or in the box itself (the heading).
 */
function linesOf(box: Locator, texts: string[], inFirstChild: boolean): Promise<number[]> {
  return box.evaluate(
    (el, {texts, inFirstChild, line}) => {
      const target = (inFirstChild ? el.firstElementChild : el) ?? el;
      const shown = target.textContent;
      const lines = texts.map((text) => {
        target.textContent = text;
        return Math.round(el.getBoundingClientRect().height / line);
      });
      target.textContent = shown;
      return lines;
    },
    {texts, inFirstChild, line: NAME_LINE},
  );
}

test("on phones, the card page's loading name takes the name's lines for all but a few cards", async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "The phone's card block");
  // Each card's name as its address spells it, against the name itself, in the boxes the page
  // draws them in: the placeholder while the card list loads, then the heading.
  const cards = everyCardPage();
  const hints = cards.map((card) => cardNameHint(card.path.split('/')[3]));
  const releaseCards = await hold(page, CARD_LIST);
  await page.goto(cards[0].path);
  const placeholder = page.getByTestId('card-name-loading');
  await boxOf(placeholder);
  const hinted: number[][] = [];
  for (const width of PHONE_WIDTHS) {
    await page.setViewportSize({width, height: PHONE.height});
    hinted.push(await linesOf(placeholder, hints, true));
  }

  releaseCards();
  const heading = page.locator('section[aria-label="Synergy results"] article').getByRole('heading', {level: 1});
  await boxOf(heading);
  for (const [i, width] of PHONE_WIDTHS.entries()) {
    await page.setViewportSize({width, height: PHONE.height});
    const named = await linesOf(heading, cards.map((card) => card.fullName), false);
    // Names whose punctuation the address drops, or that have no version, can wrap otherwise:
    // 15, 5 and 12 of 1,228 at 360, 390 and 412 px when this was written.
    const misses = cards.filter((_, j) => named[j] !== hinted[i][j]).map((card) => card.fullName);
    expect(misses.length, `${width} px: ${misses.join('; ')}`).toBeLessThanOrEqual(cards.length * 0.02);
  }
});

/** A 1x1 PNG: any art at all, since the box keeps the card's shape whatever arrives. */
const ART = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('the phone vote form holds still when the card art arrives', async ({page}, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "The phone's stacked pair");
  // The same pair every run: the queue is shuffled with Math.random.
  await page.addInitScript(() => {
    let seed = 7;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  let releaseArt = () => {};
  const artHeld = new Promise<void>((resolve) => (releaseArt = resolve));
  await page.route(/\/card-images(-preview)?\//, async (route) => {
    await artHeld;
    await route.fulfill({contentType: 'image/png', body: ART});
  });
  await page.goto('/vote');
  const form = page.getByRole('radiogroup', {name: 'Synergy score'});
  await expect(form).toBeVisible();
  // The pair's art is on its way: each card's ink tile holds its place.
  await expect(page.locator('main .ink-card-placeholder').first()).toBeVisible();
  const artLoading = await boxOf(form);

  releaseArt();
  await expect(page.locator('main .ink-card-placeholder')).toHaveCount(0);
  expectSameBox(await boxOf(form), artLoading, ['y']);
});

const COLLECTOR: Player = {id: 'e2e-geometry', handle: 'ink_geometer_204', displayName: 'Ink Geometer 204', code: E2E_FRIEND_CODE};

/** An /account section, by its h2. */
const accountSection = (page: Page, name: string) =>
  page.locator('section').filter({has: page.getByRole('heading', {level: 2, name, exact: true})});

test("the account page's Collection section holds still when the friends load", async ({page}) => {
  // An account with a code and no one yet: the Friends section every new player has.
  await signInAs(page, COLLECTOR.id);
  await serveFriends(page, {me: COLLECTOR, others: [], rows: []});
  const releaseFriends = await holdSupabasePath(page, '/rest/v1/friendships');
  await page.goto('/account');
  const friends = accountSection(page, 'Friends');
  await expect(friends.getByRole('group', {name: 'Loading your friends'})).toBeVisible();
  // The profile above has its name: only the friends are still on their way.
  await expect(page.getByText(`@${COLLECTOR.handle}`)).toBeVisible();
  const collection = accountSection(page, 'Collection');
  const friendsLoading = await boxOf(collection);

  releaseFriends();
  await expect(friends.getByText("No friends yet. Share your code, or enter a friend's.")).toBeVisible();
  expectSameBox(await boxOf(collection), friendsLoading, ['y']);
});
