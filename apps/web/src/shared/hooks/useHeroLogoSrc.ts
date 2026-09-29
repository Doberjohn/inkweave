import {useEffect, useState} from 'react';
import {HERO_LOGO_ANIMATED_SRC, HERO_LOGO_IMG} from '../constants';
import {usePrefersReducedMotion} from '../utils/prefersReducedMotion';

/** Where `requestIdleCallback` is missing (Safari), run this long after `load` instead. */
const IDLE_FALLBACK_MS = 200;
/** Upper bound on the idle wait, so a page that never goes idle still gets there. */
const IDLE_TIMEOUT_MS = 2000;

// Set by the first swap. A later mount (returning to `/`) starts on the animated logo: swapping
// again would jump from the static first frame to an image that is already mid-animation.
let animatedLogoShown = false;

/**
 * Runs `callback` once the page has fired `load` and the main thread is idle (right away if
 * `load` already happened). Returns a function that cancels whatever is still pending.
 */
function whenLoadedAndIdle(callback: () => void): () => void {
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const scheduleIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(callback, {timeout: IDLE_TIMEOUT_MS});
    } else {
      timeoutId = setTimeout(callback, IDLE_FALLBACK_MS);
    }
  };
  if (document.readyState === 'complete') scheduleIdle();
  else window.addEventListener('load', scheduleIdle, {once: true});
  return () => {
    window.removeEventListener('load', scheduleIdle);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}

/**
 * The homepage hero logo's `src` (#639): the static logo until the page has loaded and the
 * main thread is idle, then the animated one. The animated SVG repaints the whole image on
 * every frame, so running it from first paint competes with page load for the main thread.
 * Visitors who prefer reduced motion keep the static logo and never download the animated one.
 *
 * The preference is read live, not once: turning it on mid-session cancels a pending swap and
 * puts the static logo back. An animated SVG already on screen can't be trusted to stop by
 * itself, because the browser may not re-evaluate the file's own reduced-motion rule.
 *
 * The prerender crawl captures the page after this swap, so scripts/prerender.mjs rewrites the
 * animated src back to the static one: the shipped HTML must paint the static logo first.
 */
export function useHeroLogoSrc(): string {
  const [animated, setAnimated] = useState(animatedLogoShown);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (animated || reduceMotion) return;
    return whenLoadedAndIdle(() => {
      animatedLogoShown = true;
      setAnimated(true);
    });
  }, [animated, reduceMotion]);

  return animated && !reduceMotion ? HERO_LOGO_ANIMATED_SRC : HERO_LOGO_IMG.src;
}
