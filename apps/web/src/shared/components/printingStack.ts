import type {CSSProperties} from 'react';
import {DURATION, EASING, SHADOWS, SPACING} from '../constants';
import type {PeekSide} from './PrintingPeek';

/** How big the printings behind the card are, beside it. */
const TUCKED = 0.94;
/** How far the card leans, in degrees, across a drag of its own width. */
const DRAG_TILT = 7;
/**
 * How far, in degrees, the printings beside the card lean out from behind it, fanned from its
 * foot (owner, 2026-10-22: more of them showing at rest), and further while a peek is open.
 */
const FAN_TILT = {rest: 1.25, peek: 2.5} as const;
/**
 * How much darker the printing beside the card is, until a drag brings it forward. It lights up
 * while its peek is open: the frame around the card leaves the lean little more room.
 */
const BEHIND_DIM = {rest: 0.35, peek: 0.15} as const;
/** And the ones further back, which never show. */
const BURIED_DIM = 0.5;

/**
 * How far a printing behind the card shows past its side at the card's foot, its lean showing
 * more above: a little under a mouse or trackpad, which opens to the peek near that side, and
 * more on touch, where the edges are the sign that the card turns.
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
 * How a printing beside the card fans out past its side, at rest or with its peek open: how far
 * it slides out, how far it leans and how dark it is. The lean swings the printing's top corner
 * out by about its height times the lean's sine, so where the card's frame would clip that, the
 * slide and the lean shrink until the corner fits.
 */
function fanOut({height, edge, room, peeking}: StackState, side: PeekSide): {out: number; tilt: number; dim: number} {
  const look = peeking[side] ? 'peek' : 'rest';
  const lean = height * TUCKED * Math.sin((FAN_TILT[look] * Math.PI) / 180);
  const fit = Math.min(1, room / (edge[look] + lean));
  return {out: edge[look] * fit, tilt: FAN_TILT[look] * fit, dim: BEHIND_DIM[look]};
}

/** The printing before the card (`dir` -1) or after it (1), behind it and coming forward, upright, as a drag reveals it. */
function besidePose(dir: -1 | 1, state: StackState): Pose {
  const {width, dx} = state;
  const inset = (width * (1 - TUCKED)) / 2;
  const fan = fanOut(state, dir < 0 ? 'prev' : 'next');
  const toward = dir > 0 ? dx < 0 : dx > 0;
  // 1 at rest beside the card, 0 once a drag has brought it all the way forward.
  const back = 1 - (toward ? Math.min(1, Math.abs(dx) / width) : 0);
  return {
    x: dir * (inset + fan.out) * back,
    rotate: dir * fan.tilt * back,
    scale: 1 - (1 - TUCKED) * back,
    z: 2,
    dim: fan.dim * back,
    opacity: 1,
  };
}

/**
 * Where the printing `rel` places from the card sits (owner, 2026-10-22, prototype B): the card
 * in front, leaning with a drag; the printing before it and the one after behind it, a little
 * smaller and darker, fanned out past its sides, each coming forward as a drag reveals it; the
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
