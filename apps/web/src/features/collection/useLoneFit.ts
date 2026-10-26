import {useLayoutEffect, useState} from 'react';
import {loneFitFor, THREE_ROWS, type LoneFit, type LoneRoom} from '../cards/components/binderGeometry';

/**
 * The room inside `section`'s padding. Its width is its border box's, as if no scrollbar stood in
 * it: a short phone's 3-row page scrolls its section, and a scrollbar that took width there could
 * tip the rows to 4, whose page fits, the scrollbar going with it, and back.
 */
function roomOf(section: HTMLElement): LoneRoom {
  const style = getComputedStyle(section);
  const px = (value: string) => parseFloat(value) || 0;
  return {
    width: section.offsetWidth - px(style.paddingLeft) - px(style.paddingRight),
    height: section.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
  };
}

const sameFit = (a: LoneFit, b: LoneFit) => a.rows === b.rows && a.maxWidth === b.maxWidth;

/**
 * How a phone's lone page fits the binder's section (`loneFitFor`): measured in a layout
 * effect, so the first paint already has the page's rows, and again whenever the section resizes
 * (a rotation, the browser's bars). The loaded binder and its loading frame both read it, so the
 * one takes over the other's rows. `on`: only a phone's section is measured.
 *
 * `section` is the element itself, held in state by a callback ref, not a ref object: the
 * element can be replaced while the component stays mounted (the error state draws its own box,
 * and Try again mounts a new one), and only a new value re-runs the effect on the new element.
 */
export function useLoneFit(section: HTMLElement | null, on: boolean): LoneFit {
  // Before the section is measured, and anywhere it isn't (a test renderer lays nothing out): 3 rows.
  const [fit, setFit] = useState<LoneFit>(THREE_ROWS);
  useLayoutEffect(() => {
    if (!on || !section) return;
    const measure = () => {
      const room = roomOf(section);
      if (room.width <= 0 || room.height <= 0) return;
      const next = loneFitFor(room);
      setFit((shown) => (sameFit(shown, next) ? shown : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    return () => observer.disconnect();
  }, [section, on]);
  return on ? fit : THREE_ROWS;
}
