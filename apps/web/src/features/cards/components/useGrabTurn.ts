import {useEffect, useRef, useState, type MouseEvent, type PointerEvent} from 'react';
import {easeOut, flickSpeed, glideMs, grabProgress, landsOnRelease, poseLeaf, SLOP, type Grip} from './pageTurnMath';
import type {Turn} from './usePageTurns';

/**
 * Grab the page (owner, 2026-10-24, #942): drag a page sideways, or swipe it on a phone, and it
 * turns under the pointer, the spot held staying under it. Let go past halfway, or flick it, and
 * it lands; otherwise it falls back. A press that doesn't move still opens its card, and a drag
 * never does. Under reduced motion nothing moves while the page is held, and it turns at once on
 * letting go if the drag went past a quarter of the page.
 *
 * The check-in page's grab, split as it splits it: lifting the page, following the pointer, and
 * letting go.
 */

/** The samples of a drag its flick is read from: the last few moves. */
const TRAIL = 8;

type Way = 1 | -1;

/** A held page: the way it turns, where it was taken, how far over it is, and its turn as drawn. */
interface Lift {
  dir: Way;
  grip: Grip;
  t: number;
  /** The turn the binder draws held; none under reduced motion, which draws nothing. */
  held?: Turn;
}

/** A lift the binder draws. */
type DrawnLift = Lift & {held: Turn};

/** A press on a page that can turn, from its pointerdown until it lets go. */
interface Press {
  id: number;
  x0: number;
  y0: number;
  page: HTMLElement;
  /** The view it was taken in. */
  from: number;
  trail: [number, number][];
  /** Past the slop: a drag, which never opens a card. */
  moved: boolean;
  /** A drag that turns no page: up or down, or a way the page doesn't turn. */
  idle: boolean;
  lift?: Lift;
}

/** What a grab keeps between its pointer events, outside React: a drag re-renders nothing. */
interface GrabState {
  press: Press | null;
  /** The next click is a drag's, which opens no card. */
  swallow: boolean;
  /** The glide's frame. */
  frame: number;
}

interface GrabOptions {
  start: number;
  perView: number;
  single: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** A sheet is drawn: a press waits for it. */
  turning: boolean;
  /** Draws the page in hand, turning to the view at `to` (`usePageTurns`). */
  hold: (to: number) => Turn;
  /** A held page fell back. */
  end: (turn: Turn) => void;
  reducedMotion: boolean;
  /** The spine's width: a held page swings about its middle. */
  spine: number;
}

interface Grab extends GrabOptions {
  setGrabbing: (grabbing: boolean) => void;
}

/**
 * The page a press may take: with the main button, a pen or a finger, on a page that can turn
 * (`data-grab`), and off anything marked `data-no-grab`, such as an open copies stripe.
 */
function pageToGrab(e: PointerEvent): HTMLElement | null {
  if (e.button !== 0) return null;
  const target = e.target as Element;
  return target.closest('[data-no-grab]') ? null : target.closest<HTMLElement>('.binder-page[data-grab]');
}

const isRightPage = (page: HTMLElement) => page.classList.contains('binder-page-right');

/**
 * The way a drag `dx` across turns `page`, or null: forward leftward on a spread's right page and
 * back rightward on its left; either way on a phone's one page.
 */
function wayOf(page: HTMLElement, dx: number, single: boolean): Way | null {
  const dir: Way = dx < 0 ? 1 : -1;
  return single || isRightPage(page) === dir > 0 ? dir : null;
}

/** Whether a drag went more up or down than across as it left the slop: the browser's, to scroll. */
const isVertical = (dx: number, dy: number) => Math.abs(dx) < Math.abs(dy);

/** Where the press took the page, for `grabProgress`: the spine's middle lies beside the page's spine edge. */
function gripOf(press: Press, dir: Way, {single, spine}: Grab): Grip {
  const box = press.page.getBoundingClientRect();
  const pivot = isRightPage(press.page) ? box.left - spine / 2 : box.right + spine / 2;
  return {x0: press.x0, pivot, width: box.width, dir, single};
}

const canTurn = (dir: Way, {canNext, canPrev}: Grab) => (dir > 0 ? canNext : canPrev);
const turnTo = (dir: Way, {onNext, onPrev}: Grab) => (dir > 0 ? onNext() : onPrev());
const isDrawn = (lift: Lift): lift is DrawnLift => lift.held !== undefined;

/** The sheet the binder draws for a page in hand, in the board the pointer events come to. */
const leafIn = (board: HTMLElement) => board.querySelector<HTMLElement>('.binder-turn .binder-leaf');

function pressDown(e: PointerEvent<HTMLElement>, state: GrabState, g: Grab) {
  // A second finger leaves the press in hand as it was: its own pointerup would never end it.
  if (!e.isPrimary) return;
  state.swallow = false;
  const page = g.turning ? null : pageToGrab(e);
  state.press = page && {
    id: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    page,
    from: g.start,
    trail: [[e.timeStamp, e.clientX]],
    moved: false,
    idle: false,
  };
}

/** Lifts the page once the press leaves the slop sideways, the way it turns; otherwise the drag idles. */
function liftPage(e: PointerEvent<HTMLElement>, press: Press, state: GrabState, g: Grab) {
  press.moved = true;
  state.swallow = true;
  const dx = e.clientX - press.x0;
  const dir = isVertical(dx, e.clientY - press.y0) ? null : wayOf(press.page, dx, g.single);
  if (dir === null || !canTurn(dir, g)) {
    press.idle = true;
    return;
  }
  e.currentTarget.setPointerCapture(e.pointerId);
  const held = g.reducedMotion ? undefined : g.hold(g.start + dir * g.perView);
  press.lift = {dir, grip: gripOf(press, dir, g), t: 0, held};
  g.setGrabbing(true);
}

/** The held page follows the pointer, posed straight on the sheet's style. */
function follow(e: PointerEvent<HTMLElement>, trail: Press['trail'], lift: Lift) {
  trail.push([e.timeStamp, e.clientX]);
  if (trail.length > TRAIL) trail.shift();
  lift.t = grabProgress(e.clientX, lift.grip);
  const leaf = leafIn(e.currentTarget);
  if (lift.held && leaf) poseLeaf(leaf, lift.held.plan, lift.t);
}

/** The press a pointer event belongs to: none for another pointer's. */
const pressOf = (e: PointerEvent, {press}: GrabState) => (press?.id === e.pointerId ? press : null);

function pointerMoved(e: PointerEvent<HTMLElement>, state: GrabState, g: Grab) {
  const press = pressOf(e, state);
  if (!press || press.idle) return;
  if (!press.moved && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) >= SLOP) liftPage(e, press, state, g);
  // Once a disc, key or the map turns the view, the sheet drawn is that turn's, not the page in hand.
  if (press.lift && press.from === g.start) follow(e, press.trail, press.lift);
}

/** Glides the sheet from where it is over to the end, or back, along `easeOut`, then calls `then`. */
function glide({leaf, lift, lands}: {leaf: HTMLElement; lift: DrawnLift; lands: boolean}, then: () => void, state: GrabState) {
  const from = lift.t;
  const span = (lands ? 1 : 0) - from;
  const ms = glideMs(from, lands);
  let t0: number | undefined;
  const step = (now: number) => {
    // A disc, key or the map turned the view while it glided: that turn took the sheet's place.
    if (!leaf.isConnected) return;
    t0 ??= now;
    const k = Math.min(1, (now - t0) / ms);
    poseLeaf(leaf, lift.held.plan, from + span * easeOut(k));
    if (k < 1) state.frame = requestAnimationFrame(step);
    else then();
  };
  state.frame = requestAnimationFrame(step);
}

/** Lets the page go: past halfway, or flicked its way, it lands; otherwise it falls back. */
function letGo(
  e: PointerEvent<HTMLElement>,
  {trail, lift, cancelled}: {trail: Press['trail']; lift: DrawnLift; cancelled: boolean},
  state: GrabState,
  g: Grab,
) {
  trail.push([e.timeStamp, e.clientX]);
  // Where it was let go, which can lie past the last move.
  lift.t = grabProgress(e.clientX, lift.grip);
  const toward = -lift.dir * flickSpeed(trail);
  const lands = !cancelled && landsOnRelease(lift.t, toward);
  const settle = () => (lands ? turnTo(lift.dir, g) : g.end(lift.held));
  const leaf = leafIn(e.currentTarget);
  if (leaf) glide({leaf, lift, lands}, settle, state);
  else settle();
}

/**
 * Under reduced motion the page turns at once on letting go, if it went past a quarter of the
 * page the way it turns: leftward forward, rightward back.
 */
function turnAtOnce(e: PointerEvent<HTMLElement>, x0: number, lift: Lift, g: Grab) {
  if ((x0 - e.clientX) * lift.dir > lift.grip.width / 4) turnTo(lift.dir, g);
}

function release(e: PointerEvent<HTMLElement>, state: GrabState, g: Grab, cancelled: boolean) {
  const press = pressOf(e, state);
  if (!press) return;
  state.press = null;
  // The click that ends a drag is the drag's (`swallowDragClick`), and only that click.
  setTimeout(() => {
    state.swallow = false;
  }, 0);
  const {lift} = press;
  if (!lift) return;
  g.setGrabbing(false);
  // A disc, key or the map turned the view while the page was held: that turn replaced it.
  if (press.from !== g.start) return;
  if (isDrawn(lift)) letGo(e, {trail: press.trail, lift, cancelled}, state, g);
  else if (!cancelled) turnAtOnce(e, press.x0, lift, g);
}

/**
 * The board lost the pointer it captured: the press ends, falling back. A finger's own capture,
 * which the browser gives the page it touched and the lift moves to the board, is lost on the
 * page and bubbles up to the board: that ends nothing.
 */
function lostCapture(e: PointerEvent<HTMLElement>, state: GrabState, g: Grab) {
  if (e.target === e.currentTarget) release(e, state, g, true);
}

/** A drag's click opens no card. A keyboard's click (no pointer, so `detail` 0) is never a drag's. */
function swallowDragClick(e: MouseEvent, state: GrabState) {
  if (!state.swallow || e.detail === 0) return;
  state.swallow = false;
  e.stopPropagation();
  e.preventDefault();
}

/**
 * The board's pointer handlers, and whether a page is in hand, for its `binder-grabbing` cursor.
 * The sheet for a page in hand is the binder's (`usePageTurns`, `PageTurn`), which this poses.
 */
export function useGrabTurn(options: GrabOptions) {
  const state = useRef<GrabState>({press: null, swallow: false, frame: 0});
  const [grabbing, setGrabbing] = useState(false);
  useEffect(() => {
    const grab = state.current;
    return () => cancelAnimationFrame(grab.frame);
  }, []);
  const g: Grab = {...options, setGrabbing};
  return {
    grabbing,
    /**
     * Where the page in hand has got to, read as its sheet is drawn (`PageTurn`'s `at`): the move
     * that lifts the page comes before its sheet is drawn, and so can every move after it, which
     * find no sheet to pose. Drawn there, it never shows flat.
     */
    heldAt: () => state.current.press?.lift?.t ?? 0,
    boardProps: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => pressDown(e, state.current, g),
      onPointerMove: (e: PointerEvent<HTMLElement>) => pointerMoved(e, state.current, g),
      onPointerUp: (e: PointerEvent<HTMLElement>) => release(e, state.current, g, false),
      onPointerCancel: (e: PointerEvent<HTMLElement>) => release(e, state.current, g, true),
      onLostPointerCapture: (e: PointerEvent<HTMLElement>) => lostCapture(e, state.current, g),
      onClickCapture: (e: MouseEvent) => swallowDragClick(e, state.current),
      // The browser's own drag of a card's image would cancel the pointer.
      onDragStart: (e: MouseEvent) => e.preventDefault(),
    },
  };
}
