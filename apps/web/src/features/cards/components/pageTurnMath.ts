/**
 * The page turn's plan and the grab's arithmetic (#942), as the owner tried them on the
 * check-in page (2026-10-24): which sheet a turn swings and what lies beside it, and how far
 * over a page held in the hand is. Pure, so every number is tested without a browser.
 *
 * Views are named by their first slot (`start`), and a spread's right page starts `perPage`
 * after its left: the first spread's left page, slot -12, is the inside front cover. `poseLeaf`
 * alone touches the page, writing a pose to the sheet.
 */

export type Side = 'left' | 'right';

/** One page of a turn: the slot it starts at and the side it is drawn as. */
export interface TurnPage {
  from: number;
  side: Side;
}

/** The sheet that swings and the flat page beside it. */
export interface TurnPlan {
  /** Which page's box the sheet starts in. */
  lifts: Side;
  /** The sheet's front, the page it lifts from (on a phone going back, the page swinging in). */
  front: TurnPage;
  /** Its back, the page it lands as (spreads only). */
  back?: TurnPage;
  /** A flat page over what the binder shows beneath, where that differs from the picture. */
  flat?: TurnPage;
  /** Degrees about the spine. */
  startAngle: number;
  endAngle: number;
}

interface TurnOptions {
  /** A phone's lone page rather than a spread. */
  single: boolean;
  /** The page is in the pointer's hand (see `turnPlan`). */
  held: boolean;
  perPage: number;
}

/** A turn between two views, as the four cases below read it. */
interface Span {
  from: number;
  to: number;
  held: boolean;
  perPage: number;
}

/** Forward on a spread: the right page lifts and lands as the next spread's left. */
const spreadForward = ({from, to, held, perPage}: Span): TurnPlan => ({
  lifts: 'right',
  front: {from: from + perPage, side: 'right'},
  back: {from: to, side: 'left'},
  flat: held ? {from: to + perPage, side: 'right'} : {from, side: 'left'},
  startAngle: 0,
  endAngle: -180,
});

/** Back on a spread: the left page lifts and lands as the spread before's right. */
const spreadBack = ({from, to, held, perPage}: Span): TurnPlan => ({
  lifts: 'left',
  front: {from, side: 'left'},
  back: {from: to + perPage, side: 'right'},
  flat: held ? {from: to, side: 'left'} : {from: from + perPage, side: 'right'},
  startAngle: 0,
  endAngle: 180,
});

/** Forward on a phone: the lone page swings away to the left, past standing on edge. */
const phoneForward = ({from, to, held}: Span): TurnPlan => ({
  lifts: 'right',
  front: {from, side: 'right'},
  flat: held ? {from: to, side: 'right'} : undefined,
  startAngle: 0,
  endAngle: -100,
});

/** Back on a phone: the page before swings back in over the lone page. */
const phoneBack = ({from, to, held}: Span): TurnPlan => ({
  lifts: 'right',
  front: {from: to, side: 'right'},
  flat: held ? undefined : {from, side: 'right'},
  startAngle: -100,
  endAngle: 0,
});

/**
 * The sheet a turn from the view at `from` to the view at `to` moves. `held`: the page is in the
 * pointer's hand, so the binder beneath still shows `from` and the flat page is the one the sheet
 * uncovers; otherwise the binder already shows `to` and the flat page is the one it lands on, as
 * it was.
 */
export function turnPlan(from: number, to: number, {single, held, perPage}: TurnOptions): TurnPlan {
  const span = {from, to, held, perPage};
  if (single) return to > from ? phoneForward(span) : phoneBack(span);
  return to > from ? spreadForward(span) : spreadBack(span);
}

export const SLOP = 8; // px: a press that moves less is a press
export const FLICK_SPEED = 0.5; // px per ms
const FLICK_WINDOW_MS = 80;

/** Where a held page was taken: the press's x, the spine's middle, the page's width, the turn's way. */
export interface Grip {
  x0: number;
  pivot: number;
  width: number;
  /** 1 forward, -1 back. */
  dir: 1 | -1;
  single: boolean;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** How far over a held page is, 0 (where it lay) to 1 (landed), with the pointer at `x`. */
export function grabProgress(x: number, {x0, pivot, width, dir, single}: Grip): number {
  // A phone's page before swings back in from the left, following the finger across.
  if (single && dir < 0) return clamp((x - x0) / (width * 0.85), 0, 1);
  // The spot held stays under the pointer: it sits `reach` from the rings and swings round them.
  const reach = Math.max(width * 0.3, Math.abs(x0 - pivot));
  const across = clamp((dir > 0 ? x - pivot : pivot - x) / reach, -1, 1);
  return clamp((Math.acos(across) * 180) / Math.PI / (single ? 100 : 180), 0, 1);
}

/**
 * The pointer's speed as it let go, px per ms, rightward positive, over the last 80 ms of
 * [timeStamp, x] samples, the release among them.
 */
export function flickSpeed(trail: readonly (readonly [number, number])[]): number {
  const [t1, x1] = trail[trail.length - 1];
  let i = trail.length - 1;
  while (i > 0 && t1 - trail[i - 1][0] <= FLICK_WINDOW_MS) i--;
  const [t0, x0] = trail[i];
  return t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
}

/** Whether a page let go at `t`, moving `toward` px/ms its turn's way, lands; otherwise it falls back. */
export const landsOnRelease = (t: number, toward: number) => t > 0.5 || (toward > FLICK_SPEED && t > 0.04);
/** How long the glide over (or back) takes from `t`, in ms. */
export const glideMs = (t: number, lands: boolean) => (lands ? 140 + 420 * (1 - t) : 140 + 320 * t);
export const easeOut = (k: number) => 1 - (1 - k) ** 3;
/** The shade across the sheet: none flat, darkest on edge. */
export const shadeAt = (t: number) => 0.75 * Math.sin(Math.PI * t);

/** Puts the sheet `t` of the way over, 0 where it lay to 1 landed, shaded as it stands. */
export function poseLeaf(leaf: HTMLElement, plan: TurnPlan, t: number): void {
  leaf.style.transform = `rotateY(${plan.startAngle + (plan.endAngle - plan.startAngle) * t}deg)`;
  leaf.style.setProperty('--binder-shade', String(shadeAt(t)));
}
