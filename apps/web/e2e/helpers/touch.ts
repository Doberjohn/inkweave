import type {CDPSession, Page} from '@playwright/test';

/**
 * A finger on the page, through Chromium's DevTools protocol, and what the page did with its
 * moves. Chrome holds a touch to the way it set out, so a sideways swipe that drifts down never
 * scrolls here, as it does on an iPhone, where the scroll cancels the drag. What Chromium shows is
 * whether the page kept each move from the scroll (`useTouchHold`), which is what keeps Safari's
 * from starting.
 */

export type Point = [x: number, y: number];

/** Notes, for each touchmove, whether its default was prevented. Set up before the page loads (`addInitScript`). */
export function watchTouchMoves() {
  const kept: boolean[] = [];
  (window as unknown as {keptTouchMoves: boolean[]}).keptTouchMoves = kept;
  // Passive and bubbling, on the window: it reads each move once the element's own listener has
  // run, and holds up no scroll itself.
  window.addEventListener('touchmove', (e) => kept.push(e.defaultPrevented), {passive: true});
}

/** Whether the page kept each touchmove from the scroll since the last call, which starts the list afresh. */
export const keptTouchMoves = (page: Page) =>
  page.evaluate(() => (window as unknown as {keptTouchMoves: boolean[]}).keptTouchMoves.splice(0));

/** A finger's path from `start`: each leg is `count` moves of `[dx, dy]`, one leg after the other. */
export function fingerPath(start: Point, ...legs: [count: number, step: Point][]): Point[] {
  const path = [start];
  for (const [count, [dx, dy]] of legs) {
    for (let i = 0; i < count; i++) {
      const [x, y] = path[path.length - 1];
      path.push([x + dx, y + dy]);
    }
  }
  return path;
}

/** A finger pressed at the path's first point, moved through the rest a frame apart, and lifted. */
export async function swipeThrough(page: Page, cdp: CDPSession, [[x0, y0], ...moves]: Point[]) {
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: x0, y: y0}]});
  for (const [x, y] of moves) {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y}]});
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 16)));
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}
