/**
 * A touchmove with `fingers` on the screen. jsdom has no `Touch` to build a real one's fingers
 * from, so it carries only how many there are, which is all `useTouchHold` reads.
 */
export function fingerMove({fingers = 1, cancelable = true} = {}): Event {
  const move = new Event('touchmove', {bubbles: true, cancelable});
  Object.defineProperty(move, 'touches', {value: {length: fingers}});
  return move;
}

/** Whether a finger's move on `el` is kept from the page's scroll (`useTouchHold`), its listeners run. */
export function touchMoveKept(el: Element, fingers = 1): boolean {
  const move = fingerMove({fingers});
  el.dispatchEvent(move);
  return move.defaultPrevented;
}
