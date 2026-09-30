import {act, fireEvent} from '@testing-library/react';

/** jsdom lays nothing out, so a strip gets this width before it scrolls. */
const STRIP_WIDTH = 300;

/**
 * Swipes a PrintingCarousel strip onto `slide` the way a finger does: touch, scroll across
 * (the strip reports each slide it crosses), lift. The strip is not at rest yet: `restStrip`
 * ends the scroll.
 */
export function swipeStrip(strip: HTMLElement, slide: number) {
  Object.defineProperty(strip, 'clientWidth', {value: STRIP_WIDTH, configurable: true});
  fireEvent.touchStart(strip);
  strip.scrollLeft = slide * STRIP_WIDTH;
  act(() => {
    fireEvent.scroll(strip);
  });
  fireEvent.touchEnd(strip);
}

/** Ends a strip's scroll, as the browser's `scrollend` does. */
export function restStrip(strip: HTMLElement) {
  fireEvent(strip, new Event('scrollend'));
}
