import type {CSSProperties} from 'react';
import {DURATION, EASING, SHADOWS, SPACING} from '../constants';
import type {PeekSide} from './PrintingPeek';

/** How big the printings behind the card are, beside it. */
const TUCKED = 0.94;
/** How far the card leans, in degrees, across a drag of its own width. */
const DRAG_TILT = 7;
/** How far a printing leans out from behind the card while its peek is open. */
const PEEK_TILT = 2.5;
/** How much darker the printing beside the card is, until a drag brings it forward. */
const BEHIND_DIM = 0.42;
/** And the ones further back, which never show. */
const BURIED_DIM = 0.5;

/**
 * How far a printing behind the card shows past its side: a sliver under a mouse or trackpad,
 * which opens to the peek near that side, and more on touch, where the edges are the sign that
 * the card turns.
 */
export const STACK_EDGE = {
  fine: {rest: SPACING.xs, peek: SPACING.lg},
  touch: {rest: SPACING.md, peek: SPACING.md},
} as const;

/** Where a printing sits in the stack. */
interface Pose {
  x: number;
  /** Degrees, about the card's foot. */
  rotate: number;
  scale: number;
  z: number;
  /** How much darker than the card it sits behind, 0 to 1. */
  dim: number;
  opacity: number;
}

export interface StackState {
  width: number;
  height: number;
  /** The drag's offset, 0 when none is under way. */
  dx: number;
  /** Whether each side's peek is open: a pointer near it, or keyboard focus on the card. */
  peeking: Record<PeekSide, boolean>;
  edge: {rest: number; peek: number};
  /** How far past the card's sides the stack may show before its frame clips it. */
  room: number;
  /** A comparison: the card alone, with nothing behind it. */
  locked: boolean;
}

/**
 * How far an open peek slides its printing out and leans it. The lean swings the printing's top
 * corner out by about its height times the lean's sine, so where the card's frame would clip
 * that, both shrink until the corner fits.
 */
function peekReach({height, edge, room}: StackState): {out: number; tilt: number} {
  const lean = height * TUCKED * Math.sin((PEEK_TILT * Math.PI) / 180);
  const fit = Math.min(1, room / (edge.peek + lean));
  return {out: edge.peek * fit, tilt: PEEK_TILT * fit};
}

/** The printing before the card (`dir` -1) or after it (1), behind it and coming forward as a drag reveals it. */
function besidePose(dir: -1 | 1, state: StackState): Pose {
  const {width, dx} = state;
  const inset = (width * (1 - TUCKED)) / 2;
  const peek = state.peeking[dir < 0 ? 'prev' : 'next'] ? peekReach(state) : {out: state.edge.rest, tilt: 0};
  const toward = dir > 0 ? dx < 0 : dx > 0;
  const progress = toward ? Math.min(1, Math.abs(dx) / width) : 0;
  return {
    x: dir * (inset + peek.out) * (1 - progress),
    rotate: dir * peek.tilt,
    scale: TUCKED + (1 - TUCKED) * progress,
    z: 2,
    dim: BEHIND_DIM * (1 - progress),
    opacity: 1,
  };
}

/**
 * Where the printing `rel` places from the card sits (owner, 2026-10-22, prototype B): the card
 * in front, leaning with a drag; the printing before it and the one after behind it, a little
 * smaller and darker, their edges past its sides, each coming forward as a drag reveals it; the
 * rest out of sight behind those.
 */
export function stackPose(rel: number, state: StackState): Pose {
  const {width, dx} = state;
  if (rel === 0) return {x: dx, rotate: (dx / width) * DRAG_TILT, scale: 1, z: 3, dim: 0, opacity: 1};
  const dir = rel < 0 ? -1 : 1;
  if (Math.abs(rel) > 1 || state.locked) {
    return {x: (dir * width * (1 - TUCKED)) / 2, rotate: 0, scale: TUCKED, z: 1, dim: BURIED_DIM, opacity: 0};
  }
  return besidePose(dir, state);
}

interface SlideLook {
  borderRadius: number;
  /** A drag under way: the card follows the pointer, so only the dimming eases. */
  dragging: boolean;
  /** The printing a turn sends back, hidden while it passes behind the one coming forward. */
  tucked: boolean;
  reducedMotion: boolean;
}

function slideTransition({dragging, reducedMotion}: SlideLook): string | undefined {
  if (reducedMotion) return undefined;
  const fades = `filter ${DURATION.slow}ms ${EASING.snappy}, opacity ${DURATION.fast}ms ${EASING.smooth}`;
  return dragging ? fades : `transform ${DURATION.slow}ms ${EASING.smooth}, ${fades}`;
}

/** To the hundredth: a transform needs no finer, and reads plainer. */
function hundredths(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A printing's place in the stack, as its slide's style. */
export function slideStyle(pose: Pose, look: SlideLook): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: pose.z,
    borderRadius: look.borderRadius,
    boxShadow: SHADOWS.card,
    transform: `translate3d(${hundredths(pose.x)}px, 0, 0) rotate(${hundredths(pose.rotate)}deg) scale(${hundredths(pose.scale)})`,
    transformOrigin: '50% 100%',
    filter: pose.dim ? `brightness(${1 - pose.dim})` : undefined,
    opacity: look.tucked ? 0 : pose.opacity,
    transition: slideTransition(look),
    willChange: 'transform',
    // The box takes the pointer, so its cursor shows while the card is dragged.
    pointerEvents: look.dragging ? 'none' : undefined,
  };
}
