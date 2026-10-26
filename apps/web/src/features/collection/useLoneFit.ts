import {useLayoutEffect, useState, type RefObject} from 'react';
import {loneFitFor, type LoneFit, type LoneRoom} from '../cards/components/binderGeometry';

/** Before the section is measured, and anywhere it isn't (a test renderer lays nothing out): the 3-row page. */
const THREE_ROWS: LoneFit = {rows: 3};

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
 */
export function useLoneFit(section: RefObject<HTMLElement | null>, on: boolean): LoneFit {
  const [fit, setFit] = useState<LoneFit>(THREE_ROWS);
  useLayoutEffect(() => {
    const box = section.current;
    if (!on || !box) return;
    const measure = () => {
      const room = roomOf(box);
      if (room.width <= 0 || room.height <= 0) return;
      const next = loneFitFor(room);
      setFit((shown) => (sameFit(shown, next) ? shown : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [section, on]);
  return on ? fit : THREE_ROWS;
}
