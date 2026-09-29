import {useEffect, useState} from 'react';
import {HERO_LOGO_ANIMATED_SRC, HERO_LOGO_IMG} from '../constants';
import {prefersReducedMotion} from '../utils/prefersReducedMotion';

/** Where `requestIdleCallback` is missing (Safari), swap this long after `load` instead. */
const IDLE_FALLBACK_MS = 200;
/** Upper bound on the idle wait, so a page that never goes idle still animates. */
const IDLE_TIMEOUT_MS = 2000;

// Set by the first swap. A later mount (returning to `/`) starts on the animated logo: swapping
// again would jump from the static first frame to an image that is already mid-animation.
let animatedLogoShown = false;

/**
 * The homepage hero logo's `src` (#639): the static logo until the page has loaded and the
 * main thread is idle, then the animated one. The animated SVG repaints the whole image on
 * every frame, so running it from first paint competes with page load for the main thread.
 * Visitors who prefer reduced motion keep the static logo and never download the animated one.
 *
 * The prerender crawl captures the page after this swap, so scripts/prerender.mjs rewrites the
 * animated src back to the static one: the shipped HTML must paint the static logo first.
 */
export function useHeroLogoSrc(): string {
  const [animated, setAnimated] = useState(animatedLogoShown);

  useEffect(() => {
    if (animated || prefersReducedMotion()) return;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const swap = () => {
      animatedLogoShown = true;
      setAnimated(true);
    };
    const swapWhenIdle = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(swap, {timeout: IDLE_TIMEOUT_MS});
      } else {
        timeoutId = setTimeout(swap, IDLE_FALLBACK_MS);
      }
    };
    if (document.readyState === 'complete') swapWhenIdle();
    else window.addEventListener('load', swapWhenIdle, {once: true});
    return () => {
      window.removeEventListener('load', swapWhenIdle);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [animated]);

  return animated ? HERO_LOGO_ANIMATED_SRC : HERO_LOGO_IMG.src;
}
