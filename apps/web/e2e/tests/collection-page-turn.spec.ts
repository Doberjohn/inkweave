import type {CDPSession, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {newestCoreSet, setCards} from '../helpers/cardData';
import {binder, type Entries, signInAsCollector} from '../helpers/collector';
import {edges, middle} from '../helpers/screen';
import {fingerPath, keptTouchMoves, scrolledRound, swipeThrough, watchTouchMoves, type Point} from '../helpers/touch';
import {FLICK_SPEED, SLOP} from '../../src/features/cards/components/pageTurnMath';

/**
 * Turning the collection binder's pages (#942), as the owner kept them on 2026-10-24: every way
 * of turning swings a sheet over the rings in 0.7s, and a page dragged sideways, or swiped on a
 * phone, turns under the pointer. The pages' and pockets' look is `collection-binder.spec.ts`'s;
 * collection mode's own spec, `collection-mode.spec.ts`, keeps the binder's layout and its
 * keyboard paging (#790).
 *
 * THE PAGE WATCHES ITS OWN TURNS. A sheet lives 0.7s, quicker than a test's round trips, so
 * `watchTurns`, set up before the page loads, logs each sheet in the task that draws it: what its
 * faces show, the spread the map marks, and, for a turn, the sheet held at five points through it
 * (its transition paused and sought, then set back as it was), with its angle, its box and how far
 * the page scrolls sideways. It logs each press too, with whether a sheet was drawn as it came,
 * and what the map marked once the app had handled it.
 *
 * A sheet's angle is read from its computed transform: `rotateY(a)` is
 * `matrix3d(cos a, 0, -sin a, 0, 0, 1, 0, 0, sin a, ...)`, so `a = atan2(m[8], m[0])`. Forward on
 * a spread it turns from 0° to -180°, back from 0° to 180°, and a phone's page swings to -100°.
 */

const SET = newestCoreSet();
const BASE = setCards(SET);
/** The collector holds a normal copy of each of the set's first three cards, and no other. */
const HELD_BASE = BASE.slice(0, 3);
const ENTRIES: Entries = Object.fromEntries(HELD_BASE.map((card) => [String(card.id), {normal: 1, foil: 0}]));

/** The turn's time, as the issue sets it: 0.7s. */
const TURN_MS = 700;
/** Where the page holds a turning sheet to look at it, in ms: its start, its quarters and its end. */
const POSES = [0, TURN_MS / 4, TURN_MS / 2, (3 * TURN_MS) / 4, TURN_MS];
/** A pause the pointer makes before letting go, so it lets go with no speed: past the flick's 80 ms. */
const STILL_MS = 150;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A turning sheet held `at` ms in. */
interface Pose {
  at: number;
  angle: number;
  box: Box;
  /** How far the page, or any scroller round the binder, scrolls sideways. */
  sideways: number;
}

/** A sheet the page drew, as `watchTurns` saw it. */
interface SeenTurn {
  drawnAt: number;
  goneAt: number | null;
  hidden: string | null;
  inert: boolean;
  /** Whether a card on it took the focus when asked. */
  focusTaken: boolean;
  /** The spread the map marked as it was drawn. */
  map: string | null;
  /** The first card on its front, on its back, and on the flat page beside it. */
  front: string | null;
  back: string | null;
  flat: string | null;
  /** Whether its front holds a phone's inside cover, with the collection's numbers (owner, 2026-10-27). */
  numbers: boolean;
  /** The binder's real pages, as it was drawn. */
  pages: {left: Box | null; right: Box | null};
  /** A turn's time and its poses; a page in hand has neither. */
  duration: number | null;
  poses: Pose[];
}

/** A press: when it came, whether a sheet was drawn, and the spread the map marked. */
interface Press {
  type: string;
  at: number;
  drawn: boolean;
  map: string | null;
  /** Whether a sheet was drawn when the first frame after it ran its callbacks: null until then. */
  framed: boolean | null;
}

interface TurnLog {
  turns: SeenTurn[];
  /** The most sheets drawn at once. */
  most: number;
  /** Each key and pointer press, and each click, as it came, before the app heard it. */
  presses: Press[];
  /** Each key, pointer and click once the app had handled it. */
  settled: Press[];
}

/** The page's own watch on its turns, set up before it loads (`addInitScript`). Read with `turnLog`. */
function watchTurns(poses: number[]) {
  const log: TurnLog = {turns: [], most: 0, presses: [], settled: []};
  (window as unknown as {turnLog: TurnLog}).turnLog = log;
  const boxOf = (el: Element | null): Box | null => {
    if (!el) return null;
    const {x, y, width, height} = el.getBoundingClientRect();
    return {x, y, width, height};
  };
  const angleOf = (el: Element) => {
    const m = /matrix3d\((.+)\)/.exec(getComputedStyle(el).transform)?.[1].split(',').map(Number);
    return m ? (Math.atan2(m[8], m[0]) * 180) / Math.PI : 0;
  };
  const sideways = () => {
    const root = document.documentElement;
    let most = root.scrollWidth - root.clientWidth;
    for (let el = document.querySelector('[aria-label="Binder"]'); el; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') most = Math.max(most, el.scrollWidth - el.clientWidth);
    }
    return most;
  };
  const mapNow = () =>
    document.querySelector('[aria-label="Binder pages"] [aria-current="true"]')?.getAttribute('aria-label') ?? null;
  const realPage = (side: string) =>
    [...document.querySelectorAll(`[aria-label="Binder"] .binder-page-${side}`)].find(
      (page) => !page.closest('.binder-turn'),
    ) ?? null;
  const firstCard = (turn: Element, part: string) =>
    turn.querySelector(`${part} .card-tile`)?.getAttribute('aria-label') ?? null;
  // The sheet's own transition (the shades are its faces' pseudo-elements'), paused and posed at
  // each of `poses`, then set going again from where it was.
  const motionOf = (leaf: Element | null): Pick<SeenTurn, 'duration' | 'poses'> => {
    const motion = document.getAnimations().find((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      return leaf !== null && effect?.target === leaf && !effect.pseudoElement;
    });
    if (!leaf || !motion) return {duration: null, poses: []};
    const was = motion.currentTime;
    motion.pause();
    const duration = Number(motion.effect?.getComputedTiming().duration);
    const posed = poses.map((at) => {
      motion.currentTime = at;
      return {at, angle: angleOf(leaf), box: boxOf(leaf)!, sideways: sideways()};
    });
    motion.currentTime = was ?? 0;
    motion.play();
    return {duration, poses: posed};
  };
  const look = (turn: Element, now: number): SeenTurn => {
    const card = turn.querySelector<HTMLElement>('.card-tile');
    card?.focus({preventScroll: true});
    return {
      drawnAt: now,
      goneAt: null,
      hidden: turn.getAttribute('aria-hidden'),
      inert: turn.hasAttribute('inert'),
      focusTaken: card !== null && document.activeElement === card,
      map: mapNow(),
      front: firstCard(turn, '.binder-leaf-face:not(.binder-leaf-back)'),
      back: firstCard(turn, '.binder-leaf-back'),
      flat: firstCard(turn, '.binder-turn-flat'),
      numbers: turn.querySelector('.binder-leaf-face:not(.binder-leaf-back) [aria-label="Collection numbers"]') !== null,
      pages: {left: boxOf(realPage('left')), right: boxOf(realPage('right'))},
      ...motionOf(turn.querySelector('.binder-leaf')),
    };
  };
  const live = new Map<Element, SeenTurn>();
  new MutationObserver(() => {
    const now = performance.now();
    const drawn = [...document.querySelectorAll('.binder-turn')];
    log.most = Math.max(log.most, drawn.length);
    for (const [turn, seen] of live) {
      if (turn.isConnected) continue;
      seen.goneAt = now;
      live.delete(turn);
    }
    for (const turn of drawn) {
      if (live.has(turn)) continue;
      const seen = look(turn, now);
      live.set(turn, seen);
      log.turns.push(seen);
    }
  }).observe(document, {childList: true, subtree: true});
  const press = (type: string): Press => ({
    type,
    at: performance.now(),
    drawn: document.querySelector('.binder-turn') !== null,
    map: mapNow(),
    framed: null,
  });
  // Captured on the way down, before the app hears them, and heard on the window once it has.
  for (const type of ['keydown', 'pointerdown', 'click']) {
    document.addEventListener(
      type,
      () => {
        const pressed = press(type);
        log.presses.push(pressed);
        requestAnimationFrame(() => (pressed.framed = document.querySelector('.binder-turn') !== null));
      },
      true,
    );
  }
  for (const type of ['keyup', 'pointerup', 'click']) window.addEventListener(type, () => log.settled.push(press(type)));
}

const turnLog = (page: Page) => page.evaluate(() => (window as unknown as {turnLog: TurnLog}).turnLog);

/** Starts the log afresh, from what is drawn now. */
async function clearTurns(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log = (window as unknown as {turnLog: TurnLog}).turnLog;
    log.turns = [];
    log.presses = [];
    log.settled = [];
    log.most = document.querySelectorAll('.binder-turn').length;
  });
}

/** The turns logged once each has ended. */
async function endedTurns(page: Page): Promise<SeenTurn[]> {
  await expect(sheets(page)).toHaveCount(0);
  await expect.poll(async () => (await turnLog(page)).turns.every((turn) => turn.goneAt !== null)).toBe(true);
  return (await turnLog(page)).turns;
}

/** What `watchStripes` saw: the count stripes judged, and those drawn full size as they first laid out. */
interface StripeLog {
  seen: number;
  fullSize: number;
}

/**
 * The page's watch on its count stripes' size (owner, 2026-10-26: counts drawn large for a frame
 * as a page turned), set up before it loads. A stripe sizes its counts to its pocket from the
 * width it measures, and that size has to land before the stripe first paints. Each new stripe's
 * pocket gets a ResizeObserver of its own, made after the app's, so in the step that runs both,
 * before the paint, it reads the zoom the stripe is drawn at: 1 is the full size of a stripe not
 * yet measured. A stripe with no width yet is judged once it has one. It watches the pocket, not
 * the stripe, whose height that zoom changes: WebKit reports a box observed there that changes
 * size in that step as an uncaught error.
 */
function watchStripes() {
  const log: StripeLog = {seen: 0, fullSize: 0};
  (window as unknown as {stripeLog: StripeLog}).stripeLog = log;
  const watch = (stripe: Element) => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === 0) return;
      observer.disconnect();
      log.seen += 1;
      const row = stripe.querySelector<HTMLElement>('[style*="zoom"]');
      if (row && getComputedStyle(row).zoom === '1') log.fullSize += 1;
    });
    observer.observe(stripe.parentElement ?? stripe);
  };
  new MutationObserver((records) => {
    for (const node of records.flatMap((record) => [...record.addedNodes])) {
      if (!(node instanceof Element)) continue;
      if (node.matches('.binder-copies')) watch(node);
      node.querySelectorAll('.binder-copies').forEach(watch);
    }
  }).observe(document, {childList: true, subtree: true});
}

const stripeLog = (page: Page) => page.evaluate(() => (window as unknown as {stripeLog: StripeLog}).stripeLog);

/** What `watchArt` saw: art mounted in the binder's own pockets, and how much of it mounted hidden. */
interface ArtLog {
  mounted: number;
  hidden: number;
}

/**
 * The page's watch on the art its pages' pockets mount (owner, 2026-10-26: cards gone for a moment
 * as a page turned), set up before it loads: a page remounts its pockets on every turn, and art
 * mounted hidden shows the ink placeholder and fades back in. A turn's copies are left out.
 */
function watchArt() {
  const log: ArtLog = {mounted: 0, hidden: 0};
  (window as unknown as {artLog: ArtLog}).artLog = log;
  const artIn = (node: Node): HTMLImageElement[] => {
    if (node instanceof HTMLImageElement) return [node];
    return node instanceof Element ? [...node.querySelectorAll('img')] : [];
  };
  const inPocket = (img: HTMLImageElement) => img.closest('.binder-pocket') !== null && img.closest('.binder-turn') === null;
  new MutationObserver((records) => {
    for (const img of records.flatMap((record) => [...record.addedNodes].flatMap(artIn)).filter(inPocket)) {
      log.mounted += 1;
      if (img.style.opacity === '0') log.hidden += 1;
    }
  }).observe(document, {childList: true, subtree: true});
}

const artLog = (page: Page) => page.evaluate(() => (window as unknown as {artLog: ArtLog}).artLog);

/** The turning sheet's layer: a copy of pages, never the binder's own. */
const sheets = (page: Page) => binder(page).locator('.binder-turn');

/** The spread the map marks, or on a phone the page (#969). */
const shown = (page: Page) => binder(page).getByRole('navigation', {name: 'Binder pages'}).locator('[aria-current="true"]');

const spreadNamed = (spread: number) => new RegExp(`^Spread ${spread} of `);

/** The first card on one of the binder's own pages: the copies a sheet draws are hidden. */
const firstCardOn = (page: Page, name: string) =>
  binder(page).getByRole('group', {name, exact: true}).getByTestId('card-tile').first();

/** A card's window, or the frame drawn while its code loads: what a press on a card opens, in the same commit. */
const cardWindow = (page: Page) =>
  page.locator('[data-testid="card-overview-modal"], [data-testid="card-overview-fallback"]');

const pause = (page: Page, ms: number) => page.evaluate((t) => new Promise((resolve) => setTimeout(resolve, t)), ms);

async function openBinder(page: Page, size = {width: 1440, height: 900}): Promise<void> {
  await page.setViewportSize(size);
  await page.addInitScript(watchTurns, POSES);
  await signInAsCollector(page, ENTRIES);
  await page.goto(`/browse?binder=${SET}`);
  await expect(binder(page).getByTestId('card-tile').first()).toBeVisible();
}

/** Where a forward grab of the right page from `x0`, `y` holds it (see `grabProgress`). */
interface Grip {
  x0: number;
  y: number;
  /** The spine's middle, which the sheet swings about. */
  pivot: number;
  /** How far from the rings the spot held sits as it swings round them. */
  reach: number;
  width: number;
}

async function gripOn(page: Page, x0: number, y: number): Promise<Grip> {
  const left = await edges(binder(page).getByRole('group', {name: /^(Left page|Front cover)$/}));
  const right = await edges(binder(page).getByRole('group', {name: 'Right page'}));
  const pivot = (left.right + right.left) / 2;
  const width = right.right - right.left;
  return {x0, y, pivot, width, reach: Math.max(0.3 * width, x0 - pivot)};
}

/**
 * A grab from the right page's outer margin, 4px in from its edge, a fifth of the way down,
 * clear of the edge disc beside it: on the page, on no card.
 */
async function marginGrip(page: Page): Promise<Grip> {
  const right = await edges(binder(page).getByRole('group', {name: 'Right page'}));
  const grip = await gripOn(page, right.right - 4, right.top + (right.bottom - right.top) / 5);
  const under = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return {page: el?.closest('.binder-page')?.getAttribute('aria-label'), card: !!el?.closest('.card-tile')};
    },
    [grip.x0, grip.y],
  );
  expect(under, 'the grab point: the right page, on no card').toEqual({page: 'Right page', card: false});
  return grip;
}

/** The pointer's x for a page held `t` of the way over: the spot held swings round the rings. */
const pointerAt = ({pivot, reach}: Grip, t: number) => pivot + reach * Math.cos(Math.PI * t);

/** The sheet's angle as drawn now. */
const sheetAngle = (page: Page) =>
  sheets(page)
    .locator('.binder-leaf')
    .evaluate((leaf) => {
      const m = /matrix3d\((.+)\)/.exec(getComputedStyle(leaf).transform)?.[1].split(',').map(Number);
      return m ? (Math.atan2(m[8], m[0]) * 180) / Math.PI : 0;
    });

/** How far the page, or any scroller round the binder, scrolls sideways now. */
const sidewaysNow = (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    let most = root.scrollWidth - root.clientWidth;
    for (let el = document.querySelector('[aria-label="Binder"]'); el; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') most = Math.max(most, el.scrollWidth - el.clientWidth);
    }
    return most;
  });

/** Whether two boxes lie within a pixel of each other. */
function expectSameBox(actual: Box | null | undefined, expected: Box | null | undefined, what: string) {
  expect(actual, what).toBeTruthy();
  expect(expected, what).toBeTruthy();
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual![key] - expected![key]), `${what}: ${key}`).toBeLessThanOrEqual(1);
  }
}

/** Where a stamped drag lets go instead of its last point, and how long after it. */
interface Release {
  to: [number, number];
  afterMs: number;
}

/** Sends a mouse press, moves and release through Chromium's protocol, each with its own time. */
async function stampedDrag(cdp: CDPSession, path: [number, number][], stepMs: number, release?: Release): Promise<void> {
  const t0 = Date.now() / 1000;
  const [[x0, y0]] = path;
  const at = (i: number) => t0 + (i * stepMs) / 1000;
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: x0, y: y0, timestamp: at(-1)});
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1, timestamp: at(0)});
  for (const [i, [x, y]] of path.slice(1).entries()) {
    await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, button: 'left', buttons: 1, timestamp: at(i + 1)});
  }
  const [x, y] = release?.to ?? path[path.length - 1];
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
    timestamp: at(path.length - 1) + (release?.afterMs ?? 0) / 1000,
  });
}

test.describe("Collection mode, turning the binder's pages (#942)", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({page: _}, testInfo) => {
    // The desktop spread with its map; the phone's lone page has its own describe below.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
  });

  test("Next lifts the right page and lands it as the next spread's left in 0.7s, the map marking spread 2 at once", async ({
    page,
    browserName,
  }) => {
    // CI's Firefox and WebKit runners are too slow to time (below), so the clock is Chromium's.
    const timed = browserName === 'chromium';
    const timesTheKey = timed && process.env.E2E_SERVER === 'preview';
    await openBinder(page);
    const next = binder(page).getByRole('button', {name: 'Next spread'});
    await next.focus();
    await clearTurns(page);
    await page.keyboard.press('Enter');

    const [turn] = await endedTurns(page);
    const log = await turnLog(page);
    expect(log.turns, 'one sheet').toHaveLength(1);
    const keydown = log.presses.find((press) => press.type === 'keydown')!;
    const click = log.presses.find((press) => press.type === 'click')!;
    // Drawn with the view's change, so the first frame after the key's click shows it (Chromium
    // sends Enter's click as a task of its own, a frame after the keydown at times). A frame's own
    // time is when it was due, which can come before a slow commit that held it up, so the frame
    // looks for the sheet instead of comparing times. Within 100 ms of the key on a production
    // build in Chromium, about 60 in a 4-vCPU container. The dev server's React takes 150 to 250
    // ms to draw the same commit, and 50 to 100 for the change alone (2026-10-24), so the bounds
    // from the key hold a production build alone. CI's Firefox and WebKit runners took 190 to 280
    // ms from the key to the sheet, WebKit's first frame came before it at times, and its sheet
    // stayed up to 2.2 s while the watcher posed it (2026-10-25), so every wall-clock check holds
    // Chromium alone; the map marking spread 2 as the sheet is drawn holds everywhere.
    if (timed) expect(click.framed, "drawn by the first frame after the key's click").toBe(true);
    if (timesTheKey) {
      expect(turn.drawnAt - keydown.at, 'ms from the key to the sheet').toBeLessThan(100);
    }
    expect(turn.map, 'the spread the map marked as the sheet was drawn').toMatch(spreadNamed(2));
    expect([turn.hidden, turn.inert, turn.focusTaken]).toEqual(['true', true, false]);
    // The right page lifts, and its back is the next spread's left page.
    expect([turn.front, turn.back]).toEqual([BASE[0].fullName, BASE[12].fullName]);
    expectSameBox(turn.poses[0].box, turn.pages.right, 'the sheet as it lifts, over the right page');
    // 0.7s, from flat to over the rings: past standing up halfway through, and laid on the left.
    expect(turn.duration).toBe(TURN_MS);
    const [start, , halfway, , end] = turn.poses.map((pose) => pose.angle);
    expect(Math.abs(start), 'the angle as it lifts').toBeLessThan(1);
    expect(halfway, 'the angle at 350 ms').toBeLessThan(-30);
    expect(halfway, 'the angle at 350 ms').toBeGreaterThan(-150);
    expect(Math.abs(end), 'the angle as it lands').toBeCloseTo(180, 0);
    // It turns for 0.7s and is gone within a second, the binder showing spread 2's own cards: a
    // second from the key on a production build.
    expect(turn.goneAt! - turn.drawnAt, 'ms the sheet was drawn').toBeGreaterThanOrEqual(TURN_MS);
    if (timed) expect(turn.goneAt! - turn.drawnAt, 'ms the sheet was drawn').toBeLessThan(1000);
    if (timesTheKey) {
      expect(turn.goneAt! - keydown.at, 'ms from the key to the sheet gone').toBeLessThan(1000);
    }
    await expect(firstCardOn(page, 'Left page')).toHaveAccessibleName(BASE[12].fullName);
    await expect(firstCardOn(page, 'Right page')).toHaveAccessibleName(BASE[24].fullName);
    await expect(next).toBeFocused();
  });

  test('Previous lifts the left page and lands it on the right', async ({page}) => {
    await openBinder(page);
    const previous = binder(page).getByRole('button', {name: 'Previous spread'});
    await binder(page).getByRole('button', {name: 'Next spread'}).focus();
    await page.keyboard.press('Enter');
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    await expect(sheets(page)).toHaveCount(0);

    await previous.focus();
    await clearTurns(page);
    await page.keyboard.press('Enter');
    const [turn] = await endedTurns(page);
    expect(turn.map).toMatch(spreadNamed(1));
    // Spread 2's left page lifts over spread 1's right, which its back lands as.
    expect([turn.front, turn.back]).toEqual([BASE[12].fullName, BASE[0].fullName]);
    expectSameBox(turn.poses[0].box, turn.pages.left, 'the sheet as it lifts, over the left page');
    const [, , halfway, , end] = turn.poses.map((pose) => pose.angle);
    expect(halfway, 'the angle at 350 ms').toBeGreaterThan(30);
    expect(halfway, 'the angle at 350 ms').toBeLessThan(150);
    expect(Math.abs(end), 'the angle as it lands').toBeCloseTo(180, 0);
    await expect(firstCardOn(page, 'Right page')).toHaveAccessibleName(BASE[0].fullName);
  });

  test('Enter on Next three times quickly lands three spreads on, one sheet at a time', async ({page}) => {
    await openBinder(page);
    await binder(page).getByRole('button', {name: 'Next spread'}).focus();
    await clearTurns(page);
    for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');

    await expect(shown(page)).toHaveAccessibleName(spreadNamed(4));
    const turns = await endedTurns(page);
    const log = await turnLog(page);
    // Each later press came while a sheet turned, and replaced it: one sheet a press, never two at once.
    expect(log.presses.filter((press) => press.type === 'keydown').map((press) => press.drawn)).toEqual([false, true, true]);
    expect(turns.map((turn) => turn.map)).toEqual([2, 3, 4].map((spread) => expect.stringMatching(spreadNamed(spread))));
    expect(log.most, 'sheets drawn at once').toBe(1);
    await expect(firstCardOn(page, 'Left page')).toHaveAccessibleName(BASE[60].fullName);
  });

  test('a map press four spreads on turns one sheet, and the map still turns while it does', async ({page}) => {
    await openBinder(page);
    const map = binder(page).getByRole('navigation', {name: 'Binder pages'});
    // Both presses straight after each other, with no wait for the buttons in between: the second
    // has to come while the first one's sheet turns, which a slow runner's waits could outlast.
    const [five, two] = await Promise.all(
      [5, 2].map(async (spread) => (await map.getByRole('button', {name: spreadNamed(spread)}).boundingBox())!),
    );
    await clearTurns(page);
    for (const box of [five, two]) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    const [jump, back] = await endedTurns(page);
    // One sheet for the jump: spread 1's right page over the rings, landing as spread 5's left.
    expect(jump.map).toMatch(spreadNamed(5));
    expect([jump.front, jump.back]).toEqual([BASE[0].fullName, BASE[84].fullName]);
    // The second press came while it turned, and turned back from there.
    const log = await turnLog(page);
    expect(log.presses.filter((press) => press.type === 'pointerdown').map((press) => press.drawn)).toEqual([false, true]);
    expect(back.map).toMatch(spreadNamed(2));
    expect(back.front, "the page lifted on the way back: spread 5's left").toBe(BASE[84].fullName);
    expect(log.turns).toHaveLength(2);
    expect(log.most).toBe(1);
    await expect(firstCardOn(page, 'Left page')).toHaveAccessibleName(BASE[12].fullName);
  });

  test('a press on the pages opens nothing while a sheet turns, and the same press after the turn opens its card', async ({
    page,
  }) => {
    await openBinder(page);
    const box = await edges(firstCardOn(page, 'Right page'));
    const [x, y] = [middle(box), (box.top + box.bottom) / 2];
    await page.mouse.move(0, 0);
    await binder(page).getByRole('button', {name: 'Next spread'}).focus();
    await clearTurns(page);
    await page.keyboard.press('Enter');
    // At the card's centre, with no wait for the pointer to get there, while the sheet turns.
    await page.mouse.click(x, y);

    const log = await turnLog(page);
    expect(log.presses.filter((press) => press.type === 'pointerdown').map((press) => press.drawn)).toEqual([true]);
    await endedTurns(page);
    await expect(cardWindow(page)).toHaveCount(0);
    // Spread 2's card in that pocket now.
    await page.mouse.click(x, y);
    await expect(page.getByTestId('card-overview-modal').locator('h1')).toHaveText(BASE[24].fullName);
  });

  test('a page dragged with the mouse turns under the pointer, standing on edge over the spine, and lands past it', async ({
    page,
  }) => {
    await openBinder(page);
    const grip = await marginGrip(page);
    await clearTurns(page);
    await page.mouse.move(grip.x0, grip.y);
    await page.mouse.down();
    await page.mouse.move(pointerAt(grip, 0.5), grip.y, {steps: 8});
    expect(Math.abs(pointerAt(grip, 0.5) - grip.pivot), 'the pointer over the spine').toBeLessThan(0.01);
    const onEdge = await sheetAngle(page);
    expect(Math.abs(onEdge + 90), `on edge over the spine, at ${onEdge}°`).toBeLessThanOrEqual(5);
    // Held, the binder still shows the spread beneath, and the sheet is a copy.
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(1));
    const held = (await turnLog(page)).turns;
    expect(held.map((turn) => [turn.hidden, turn.inert, turn.duration])).toEqual([['true', true, null]]);

    await page.mouse.move(pointerAt(grip, 0.75), grip.y, {steps: 4});
    await pause(page, STILL_MS);
    await page.mouse.up();
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    await endedTurns(page);
    await expect(firstCardOn(page, 'Left page')).toHaveAccessibleName(BASE[12].fullName);
    await expect(cardWindow(page)).toHaveCount(0);
  });

  test('a page let go a quarter of the way over falls back, opening nothing, and a still press opens its card', async ({
    page,
  }) => {
    await openBinder(page);
    const grip = await marginGrip(page);
    await page.mouse.move(grip.x0, grip.y);
    await page.mouse.down();
    // In one move: the page lifts and reaches a quarter in the same event, before its sheet is
    // drawn, as a slow runner's moves can all come before it. The sheet still shows where it is.
    await page.mouse.move(pointerAt(grip, 0.25), grip.y);
    const quarter = await sheetAngle(page);
    expect(Math.abs(quarter + 45), `a quarter of the way, at ${quarter}°`).toBeLessThanOrEqual(5);
    await pause(page, STILL_MS);
    await page.mouse.up();
    await endedTurns(page);
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(1));
    await expect(cardWindow(page)).toHaveCount(0);

    // A press that doesn't move opens its card as before.
    const card = firstCardOn(page, 'Right page');
    const box = await edges(card);
    await page.mouse.click(middle(box), (box.top + box.bottom) / 2);
    await expect(page.getByTestId('card-overview-modal').locator('h1')).toHaveText(BASE[0].fullName);
  });

  test('a page let go past the spine lands, though its last move stopped short of it', async ({page, browserName}) => {
    test.skip(browserName !== 'chromium', "Stamped mouse events go through Chromium's DevTools protocol");
    await openBinder(page);
    const grip = await marginGrip(page);
    const path = Array.from({length: 6}, (_, i): [number, number] => [pointerAt(grip, (0.3 * i) / 5), grip.y]);
    // The last move holds it 0.3 of the way over; the release, 200 ms later with no flick, is past the spine.
    await clearTurns(page);
    const cdp = await page.context().newCDPSession(page);
    await stampedDrag(cdp, path, 30, {to: [pointerAt(grip, 0.75), grip.y], afterMs: 200});
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    await endedTurns(page);
    await expect(cardWindow(page)).toHaveCount(0);
  });

  test('a flick turns the page where the same drag let go still falls back', async ({page, browserName}) => {
    test.skip(browserName !== 'chromium', "Stamped mouse events go through Chromium's DevTools protocol");
    await openBinder(page);
    const right = await edges(binder(page).getByRole('group', {name: 'Right page'}));
    const [x0, y] = [right.right - 20, right.top + (right.bottom - right.top) / 5];
    const path = Array.from({length: 5}, (_, i): [number, number] => [x0 - 15 * i, y]);

    // 60px left, then still: it falls back.
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.mouse.move(x0 - 60, y, {steps: 4});
    await pause(page, STILL_MS);
    await page.mouse.up();
    await endedTurns(page);
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(1));

    // The same 60px in 40 ms, 1.5 px/ms, let go moving: it lands.
    expect(60 / 40, 'the flick, in px/ms').toBeGreaterThan(FLICK_SPEED);
    const cdp = await page.context().newCDPSession(page);
    await stampedDrag(cdp, path, 10);
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    await endedTurns(page);
    await expect(cardWindow(page)).toHaveCount(0);
  });

  test('a drag never opens a card, and the next key press on a card still does', async ({page}) => {
    await openBinder(page);
    const card = binder(page).getByRole('group', {name: 'Right page'}).getByTestId('card-tile').nth(1);
    const box = await edges(card);
    const [x, y] = [middle(box), (box.top + box.bottom) / 2];
    await clearTurns(page);

    // Sideways from the card, lifting the page, then let go still: it falls back.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 40, y, {steps: 4});
    await pause(page, STILL_MS);
    await page.mouse.up();
    await endedTurns(page);
    expect((await turnLog(page)).turns, 'the page lifted').toHaveLength(1);
    // Down past the slop, let go on the card it started on: a drag, though it moved no page.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + SLOP + 4, {steps: 3});
    await page.mouse.up();
    await pause(page, 100);
    await expect(cardWindow(page)).toHaveCount(0);
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(1));

    // A drag let go off the binder, whose click the binder never hears: the key press after it
    // still opens the card it is on.
    const frame = await edges(binder(page).locator('.binder-board'));
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, frame.bottom + 30, {steps: 8});
    await page.mouse.up();
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('card-overview-modal').locator('h1')).toHaveText(BASE[1].fullName);
  });

  test('a mostly vertical drag, or one from the copies stripe or an edge disc, lifts no page', async ({page}) => {
    await openBinder(page);
    const grip = await marginGrip(page);
    await clearTurns(page);

    // Down the page's margin, drifting a little left.
    await page.mouse.move(grip.x0, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x0 - 20, grip.y + 80, {steps: 8});
    await page.mouse.up();

    // From the + on a held card's open stripe, and from the Next disc, 100px left.
    const held = firstCardOn(page, 'Right page');
    await held.hover();
    const plus = binder(page)
      .getByRole('group', {name: '1 normal, 0 foil', exact: true})
      .getByRole('button', {name: 'Add one copy of normal', includeHidden: true});
    const next = binder(page).getByRole('button', {name: 'Next spread'});
    for (const from of [plus, next]) {
      const box = await edges(from);
      const [x, y] = [middle(box), (box.top + box.bottom) / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 100, y, {steps: 8});
      await page.mouse.up();
    }

    await pause(page, 100);
    expect((await turnLog(page)).turns, 'sheets drawn').toEqual([]);
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(1));
    await expect(cardWindow(page)).toHaveCount(0);
    // And the press on the + added no copy.
    await held.hover();
    await expect(binder(page).getByRole('group', {name: '1 normal, 0 foil', exact: true})).toBeVisible();
  });

  test("a page grabbed from the card that has the focus hands the focus to the next spread's first card", async ({
    page,
  }) => {
    await openBinder(page);
    const card = binder(page).getByRole('group', {name: 'Right page'}).getByTestId('card-tile').nth(2);
    await card.focus();
    const box = await edges(card);
    const grip = await gripOn(page, middle(box), (box.top + box.bottom) / 2);
    await page.mouse.move(grip.x0, grip.y);
    await page.mouse.down();
    await expect(card, 'the card pressed keeps the focus').toBeFocused();
    await page.mouse.move(pointerAt(grip, 0.75), grip.y, {steps: 8});
    await pause(page, STILL_MS);
    await page.mouse.up();

    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    const first = firstCardOn(page, 'Left page');
    await expect(first).toHaveAccessibleName(BASE[12].fullName);
    await expect(first).toBeFocused();
    await endedTurns(page);
    await expect(first).toBeFocused();
  });

  test('under reduced motion every turn and grab changes the view at once, with no sheet drawn', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await openBinder(page);
    await clearTurns(page);
    const settled = async (type: string) => (await turnLog(page)).settled.filter((press) => press.type === type).at(-1)?.map;

    // Next from the keyboard, and the map.
    await binder(page).getByRole('button', {name: 'Next spread'}).focus();
    await page.keyboard.press('Enter');
    expect(await settled('keyup'), 'the map once Enter was handled').toMatch(spreadNamed(2));
    await binder(page).getByRole('navigation', {name: 'Binder pages'}).getByRole('button', {name: spreadNamed(5)}).click();
    expect(await settled('click'), 'the map once the press was handled').toMatch(spreadNamed(5));

    // A grab past a quarter of the page: nothing moves while it is held, and it turns as it lets go.
    const grip = await marginGrip(page);
    await page.mouse.move(grip.x0, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x0 - 0.3 * grip.width, grip.y, {steps: 8});
    await expect(sheets(page)).toHaveCount(0);
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(5));
    await page.mouse.up();
    expect(await settled('pointerup'), 'the map once the release was handled').toMatch(spreadNamed(6));
    // Under a quarter, it stays.
    await page.mouse.move(grip.x0, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x0 - 0.2 * grip.width, grip.y, {steps: 8});
    await page.mouse.up();
    expect(await settled('pointerup')).toMatch(spreadNamed(6));
    // Lifted leftward, then taken a third of the page back the other way: it stays.
    await page.mouse.move(grip.x0, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x0 - 0.05 * grip.width, grip.y, {steps: 4});
    await page.mouse.move(grip.x0 + 0.3 * grip.width, grip.y, {steps: 8});
    await page.mouse.up();
    expect(await settled('pointerup'), 'the map once a drag back the other way let go').toMatch(spreadNamed(6));

    await pause(page, 100);
    expect((await turnLog(page)).turns, 'sheets drawn').toEqual([]);
    await expect(cardWindow(page)).toHaveCount(0);
  });

  test('crossing the phone width, or a new filter, changes the view without a turn', async ({page}) => {
    await openBinder(page);
    const next = binder(page).getByRole('button', {name: 'Next spread'});
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    await expect(sheets(page)).toHaveCount(0);
    await clearTurns(page);

    // Spread 2 holds slots 12 to 35: a phone opens the page that holds slot 12, at 390x844
    // page 2 of twelve, slots 12 to 23. And back to the spread.
    await page.setViewportSize({width: 390, height: 844});
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[12].fullName);
    await page.setViewportSize({width: 1440, height: 900});
    await expect(shown(page)).toBeVisible();
    await pause(page, 100);
    expect((await turnLog(page)).turns, 'sheets drawn crossing the phone width').toEqual([]);

    // Missing, from spread 2, opens the binder again at its first spread, on the cards not held.
    await binder(page).getByRole('navigation', {name: 'Binder pages'}).getByRole('button', {name: spreadNamed(2)}).click();
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(2));
    await expect(sheets(page)).toHaveCount(0);
    await clearTurns(page);
    await page.getByRole('group', {name: 'Binder shows'}).getByRole('button', {name: 'Missing'}).click();
    await expect(shown(page)).toHaveAccessibleName(spreadNamed(1));
    await expect(firstCardOn(page, 'Right page')).toHaveAccessibleName(BASE[HELD_BASE.length].fullName);

    await pause(page, 100);
    expect((await turnLog(page)).turns, 'sheets drawn for the new filter').toEqual([]);
  });
});

test.describe("Collection mode, turning the binder's pages (phone width)", () => {
  // Every project, at a forced phone width, as collection-mode.spec.ts's phone tests run: the lone
  // page is chosen by width. Touch, for the swipes.
  test.use({hasTouch: true});

  // A 390x844 phone's page has four rows, twelve cards, and its row, page and map fit, so nothing
  // scrolls there: the swipes that check the page's scroll take a phone short enough
  // for the binder to scroll, whose page keeps three rows, nine cards. So the turns, swipes and
  // keys here run at both sizes of page.
  const PHONE = {width: 390, height: 844};
  const PER_PAGE = 12;
  const SHORT_PHONE = {width: 390, height: 520};
  const PER_SHORT_PAGE = 9;
  const lonePage = (page: Page) => binder(page).getByRole('group', {name: 'Page', exact: true});

  /** A finger's swipe through Chromium's protocol, in ten moves a frame apart. */
  const swipe = (page: Page, cdp: CDPSession, [x0, y0]: Point, [x1, y1]: Point) =>
    swipeThrough(page, cdp, fingerPath([x0, y0], [10, [(x1 - x0) / 10, (y1 - y0) / 10]]));

  /** The mini for page `n` in the map under the page, which turns the pages on a phone (#969). */
  const mini = (page: Page, n: number) => binder(page).getByRole('button', {name: new RegExp(`^Page ${n} of `)});

  test("a tap on the next page's mini swings the page away, and on the page before's swings it back in over it, with no scroll sideways", async ({
    page,
  }) => {
    await openBinder(page, PHONE);
    await expect(lonePage(page).locator('.binder-pocket'), 'a page of four rows').toHaveCount(
      PER_PAGE,
    );
    await clearTurns(page);
    await mini(page, 2).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[PER_PAGE].fullName);
    const [away] = await endedTurns(page);
    expect([away.front, away.back, away.flat]).toEqual([BASE[0].fullName, null, null]);
    expectSameBox(away.poses[0].box, away.pages.right, 'the page as it starts to swing, over the lone page');
    const awayAt = away.poses.map((pose) => pose.angle);
    expect(awayAt[2], 'the angle at 350 ms').toBeLessThan(-20);
    expect(awayAt[2], 'the angle at 350 ms').toBeGreaterThan(-95);
    expect(awayAt[4], 'swung away').toBeCloseTo(-100, 0);

    await clearTurns(page);
    await mini(page, 1).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[0].fullName);
    const [back] = await endedTurns(page);
    // Page 1 swings in over page 2, drawn flat beneath it.
    expect([back.front, back.flat]).toEqual([BASE[0].fullName, BASE[PER_PAGE].fullName]);
    const backAt = back.poses.map((pose) => pose.angle);
    expect(backAt[0], 'swung away as it starts').toBeCloseTo(-100, 0);
    expect(backAt[2], 'the angle at 350 ms').toBeGreaterThan(-95);
    expect(backAt[2], 'the angle at 350 ms').toBeLessThan(-5);
    expect(Math.abs(backAt[4]), 'laid over the page').toBeLessThan(1);

    // At every pose of both turns, nothing scrolls sideways.
    expect([...away.poses, ...back.poses].map((pose) => pose.sideways)).toEqual(Array(10).fill(expect.any(Number)));
    expect(Math.max(...[...away.poses, ...back.poses].map((pose) => pose.sideways)), 'sideways scroll during a turn').toBeLessThanOrEqual(0);
  });

  test("a tap on a page's mini turns to that page, which the map then marks", async ({page}) => {
    await openBinder(page, PHONE);
    await expect(shown(page)).toHaveAccessibleName(/^Page 1 of /);
    await mini(page, 5).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[4 * PER_PAGE].fullName);
    await expect(shown(page)).toHaveAccessibleName(/^Page 5 of /);
  });

  test('a page dragged across the phone turns with no scroll sideways', async ({page}) => {
    await openBinder(page, PHONE);
    const box = await edges(lonePage(page));
    const y = box.top + (box.bottom - box.top) / 5;
    await page.mouse.move(box.right - 4, y);
    await page.mouse.down();
    const scrolled: number[] = [];
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(box.right - 4 - ((box.right - box.left - 8) * i) / 6, y, {steps: 2});
      scrolled.push(await sidewaysNow(page));
    }
    await pause(page, STILL_MS);
    await page.mouse.up();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[PER_PAGE].fullName);
    await expect(sheets(page)).toHaveCount(0);
    expect(Math.max(...scrolled), 'sideways scroll during the drag').toBeLessThanOrEqual(0);
  });

  test('a finger swiping left past halfway turns to page 2 and the focus follows, and swiping right turns back', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', "Touch goes through Chromium's DevTools protocol");
    await openBinder(page, PHONE);
    const cdp = await page.context().newCDPSession(page);
    const box = await edges(lonePage(page));
    const y = box.top + (box.bottom - box.top) / 2;
    const first = firstCardOn(page, 'Page');
    await first.focus();

    await swipe(page, cdp, [box.right - 20, y], [box.left + 20, y]);
    await expect(first).toHaveAccessibleName(BASE[PER_PAGE].fullName);
    await expect(first, "the focus on page 2's first card").toBeFocused();
    await expect(shown(page), 'the map following the swipe').toHaveAccessibleName(/^Page 2 of /);
    await swipe(page, cdp, [box.left + 20, y], [box.right - 20, y]);
    await expect(first).toHaveAccessibleName(BASE[0].fullName);
    await expect(sheets(page)).toHaveCount(0);
    await expect(cardWindow(page)).toHaveCount(0);
  });

  test('a second finger on the page leaves the first one turning it', async ({page, browserName}) => {
    test.skip(browserName !== 'chromium', "Touch goes through Chromium's DevTools protocol");
    await openBinder(page, PHONE);
    const cdp = await page.context().newCDPSession(page);
    const box = await edges(lonePage(page));
    const y = box.top + (box.bottom - box.top) / 3;
    const [from, to] = [box.right - 20, box.left + 20];
    const finger = (i: number) => ({x: from + ((to - from) * i) / 10, y, id: 0});
    const second = {x: middle(box), y: box.bottom - 40, id: 1};
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [finger(0)]});
    for (let i = 1; i <= 10; i++) {
      // A second finger lands a third of the way across, and lifts two moves later: the protocol
      // lifts any finger a move leaves out.
      if (i === 4) await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [finger(3), second]});
      if (i === 6) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [finger(5)]});
      const points = i === 4 || i === 5 ? [finger(i), second] : [finger(i)];
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points});
      await pause(page, 16);
    }
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[PER_PAGE].fullName);
    await expect(sheets(page)).toHaveCount(0);
    await expect(cardWindow(page)).toHaveCount(0);
  });

  test("a finger's swipe across the page turns it though the finger drifts down, each move kept from the page's scroll", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', "Touch goes through Chromium's DevTools protocol");
    await page.addInitScript(watchTouchMoves);
    await openBinder(page, SHORT_PHONE);
    await expect(lonePage(page).locator('.binder-pocket'), 'a page of three rows').toHaveCount(
      PER_SHORT_PAGE,
    );
    const cdp = await page.context().newCDPSession(page);
    const box = await edges(lonePage(page));
    const y = box.top + (box.bottom - box.top) / 3;
    const step = (box.right - box.left - 40) / 10;
    const before = await scrolledRound(binder(page));
    await keptTouchMoves(page);

    // Halfway across, then on to 20px inside the page's left edge as the finger drifts 100px
    // down. On an iPhone the drift started the page's scroll, which cancelled the turn (2026-10-25).
    await swipeThrough(page, cdp, fingerPath([box.right - 20, y], [5, [-step, 0]], [5, [-step, 20]]));
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[PER_SHORT_PAGE].fullName);
    // Every move is a tenth of the page or more from the press, past the slop that lifts the page.
    const kept = await keptTouchMoves(page);
    expect(kept.length, 'the moves the page saw').toBeGreaterThan(5);
    expect(kept, 'each kept from the scroll').toEqual(kept.map(() => true));
    expect(await scrolledRound(binder(page)), 'how far the page scrolled down').toBe(before);
    await expect(sheets(page)).toHaveCount(0);
    await expect(cardWindow(page)).toHaveCount(0);
  });

  test("a turn draws each page's counts at their pocket's size from their first frame, both ways (owner, 2026-10-26)", async ({
    page,
  }) => {
    await page.addInitScript(watchStripes);
    await openBinder(page, PHONE);
    await page.evaluate(() => Object.assign((window as unknown as {stripeLog: StripeLog}).stripeLog, {seen: 0, fullSize: 0}));

    await mini(page, 2).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[PER_PAGE].fullName);
    await expect(sheets(page)).toHaveCount(0);
    await mini(page, 1).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[0].fullName);
    await expect(sheets(page)).toHaveCount(0);

    // Both turns' copies and both pages they land on: four pages of twelve.
    const {seen, fullSize} = await stripeLog(page);
    expect(seen, 'the stripes judged').toBeGreaterThanOrEqual(4 * PER_PAGE);
    expect(fullSize, 'the stripes that first drew full size').toBe(0);
  });

  test("the pages either side load their art before a turn shows them, and the pages past them don't (owner, 2026-10-26)", async ({
    page,
  }) => {
    const asked = new Set<string>();
    page.on('request', (request) => {
      if (request.resourceType() === 'image') asked.add(request.url());
    });
    await openBinder(page, PHONE);
    await page.waitForLoadState('networkidle');
    const before = new Set(asked);
    /** The art on the page in view, as its pockets draw it. */
    const artInView = () =>
      lonePage(page)
        .locator('img')
        .evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));

    await mini(page, 2).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[PER_PAGE].fullName);
    const second = await artInView();
    expect(second.length, "page 2's art").toBeGreaterThan(0);
    expect(second.filter((src) => !before.has(src)), "page 2's art not asked for before the turn").toEqual([]);

    // On page 2, the pages either side are 1 and 3: page 4's art waits for a turn to page 3.
    await page.waitForLoadState('networkidle');
    const onSecond = new Set(asked);
    await mini(page, 4).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[3 * PER_PAGE].fullName);
    const fourth = await artInView();
    expect(fourth.length, "page 4's art").toBeGreaterThan(0);
    expect(fourth.filter((src) => onSecond.has(src)), "page 4's art asked for while page 2 showed").toEqual([]);
  });

  test('a turn lands on cards already drawn, with no placeholder between, both ways (owner, 2026-10-26)', async ({page}) => {
    await page.addInitScript(watchArt);
    // Every <img> reports itself not complete, as Safari reported the art it held as a page's
    // pockets remounted: Chromium reports such art complete as its <img> mounts, so it starts
    // drawn there whatever the app does.
    await page.addInitScript(() =>
      Object.defineProperty(HTMLImageElement.prototype, 'complete', {get: () => false, configurable: true}),
    );
    await openBinder(page, PHONE);
    // Page 1's art drawn, and page 2's loaded ahead.
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => Object.assign((window as unknown as {artLog: ArtLog}).artLog, {mounted: 0, hidden: 0}));

    await mini(page, 2).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[PER_PAGE].fullName);
    await expect(sheets(page)).toHaveCount(0);
    await mini(page, 1).click();
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[0].fullName);
    await expect(sheets(page)).toHaveCount(0);

    const {mounted, hidden} = await artLog(page);
    expect(mounted, 'the art the two pages mounted').toBeGreaterThanOrEqual(2 * PER_PAGE);
    expect(hidden, 'the art that mounted hidden over its placeholder').toBe(0);
  });

  test("a finger swiping right from page 1 swings the inside cover in over it, its numbers drawn on the sheet, and swiping left turns back (owner, 2026-10-27)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', "Touch goes through Chromium's DevTools protocol");
    await openBinder(page, PHONE);
    const cdp = await page.context().newCDPSession(page);
    const box = await edges(lonePage(page));
    const y = box.top + (box.bottom - box.top) / 2;
    const cover = binder(page).getByRole('group', {name: 'Front cover', exact: true});
    await clearTurns(page);

    await swipe(page, cdp, [box.left + 20, y], [box.right - 20, y]);
    await expect(cover.getByRole('region', {name: 'Collection numbers'})).toBeVisible();
    await expect(shown(page)).toHaveAccessibleName('Front cover: collection numbers');
    const [back] = await endedTurns(page);
    expect([back.numbers, back.front], 'the cover on the sheet, with no card').toEqual([true, null]);
    expectSameBox(await cover.boundingBox(), back.pages.right, 'the cover, where page 1 was');

    await clearTurns(page);
    await swipe(page, cdp, [box.right - 20, y], [box.left + 20, y]);
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[0].fullName);
    const [away] = await endedTurns(page);
    expect(away.numbers, 'the cover swinging away').toBe(true);
  });

  test('a mostly vertical swipe on the inside cover scrolls its numbers and turns nothing (owner, 2026-10-27)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', "Touch goes through Chromium's DevTools protocol");
    await openBinder(page, SHORT_PHONE);
    await binder(page).getByRole('button', {name: 'Front cover: collection numbers'}).click();
    await expect(sheets(page)).toHaveCount(0);
    const cover = binder(page).getByRole('group', {name: 'Front cover', exact: true});
    const numbers = cover.getByRole('region', {name: 'Collection numbers'});
    const scrolled = () => numbers.evaluate((region) => region.parentElement!.scrollTop);
    const cdp = await page.context().newCDPSession(page);
    const box = await edges(cover);
    const x = middle(box);
    const y = box.top + (box.bottom - box.top) / 2;
    await clearTurns(page);

    await swipe(page, cdp, [x, y + 80], [x - 10, y - 120]);
    await expect.poll(scrolled, {message: "how far the cover's numbers scrolled"}).toBeGreaterThan(40);
    await pause(page, 100);
    expect((await turnLog(page)).turns, 'sheets drawn').toEqual([]);
    await expect(cover).toBeVisible();
  });

  test('a mostly vertical swipe scrolls the page and turns nothing', async ({page, browserName}) => {
    test.skip(browserName !== 'chromium', "Touch goes through Chromium's DevTools protocol");
    await openBinder(page, SHORT_PHONE);
    const cdp = await page.context().newCDPSession(page);
    const box = await edges(lonePage(page));
    const x = middle(box);
    const y = box.top + (box.bottom - box.top) / 2;
    const before = await scrolledRound(binder(page));
    await clearTurns(page);

    await swipe(page, cdp, [x, y + 100], [x - 10, y - 150]);
    await expect
      .poll(() => scrolledRound(binder(page)), {message: 'how far the page scrolled down'})
      .toBeGreaterThan(before + 50);
    await pause(page, 100);
    expect((await turnLog(page)).turns, 'sheets drawn').toEqual([]);
    await expect(firstCardOn(page, 'Page')).toHaveAccessibleName(BASE[0].fullName);
  });
});
