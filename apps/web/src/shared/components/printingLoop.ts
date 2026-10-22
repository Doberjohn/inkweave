import {useState} from 'react';

/** A turn's step: -1 to the printing before the card, 1 to the one after. */
export type Step = -1 | 1;

/** The place `step` from `from` round a loop of `count`: the turns loop (owner, 2026-10-22). */
export function round(from: number, step: number, count: number): number {
  return (from + step + count) % count;
}

/**
 * How many slides the stack holds: one per printing. With two printings the other one is both
 * before the card and after it, round the loop, so each printing has a second slide, and the
 * other's two sit behind both of the card's sides.
 */
export function slideCount(count: number): number {
  return count === 2 ? 4 : count;
}

/**
 * Where slide `slide` sits from the one in front: 0 in front, -1 behind the card's left side (the
 * printing before it), 1 behind its right (the one after), and 2 further back, out of sight.
 */
export function placeOf(slide: number, front: number, slides: number): number {
  if (slide === front) return 0;
  if (slide === round(front, 1, slides)) return 1;
  return slide === round(front, -1, slides) ? -1 : 2;
}

/**
 * The slide in front: the printing `index` names, on whichever of its slides a turn brought in,
 * so a turn the other way brings in the slide from that side. An `index` no turn here set (the
 * printing a card opens on, a comparison's return to the Standard) takes its printing's own slide.
 */
export function useFrontSlide(index: number, count: number) {
  const [front, setFront] = useState(index);
  const slide = front < slideCount(count) && front % count === index ? front : index;
  if (slide !== front) setFront(slide);
  const turn = (step: Step) => {
    const to = round(slide, step, slideCount(count));
    setFront(to);
    return to;
  };
  return {slide, turn};
}
