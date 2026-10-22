import {fireEvent} from '@testing-library/react';

/** How far the swipe drags the card: past a fifth of any card the app shows. */
const SWIPE_PX = 150;

/**
 * Swipes across a PrintingCarousel's card the way a finger does, throwing it aside: touch, drag
 * across, lift. `step` 1 swipes it left, to the printing after it; -1 right, to the one before.
 */
export function swipeCard(stack: HTMLElement, step: -1 | 1 = 1) {
  const at = (dx: number) => ({pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 200 + dx, clientY: 200});
  const across = -step * SWIPE_PX;
  fireEvent.pointerDown(stack, at(0));
  fireEvent.pointerMove(stack, at(across / 2));
  fireEvent.pointerMove(stack, at(across));
  fireEvent.pointerUp(stack, at(across));
}
