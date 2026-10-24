import {useEffect, useRef} from 'react';

/**
 * Shows each new route's page from its top. The first render keeps the visitor's place, which
 * they may have scrolled while the prerendered page was held (#915). It compares paths rather
 * than counting runs, so React's second run of effects in development doesn't scroll either.
 */
export function useScrollToTopOnRouteChange(pathname: string): void {
  const shownPathname = useRef(pathname);
  useEffect(() => {
    if (pathname === shownPathname.current) return;
    shownPathname.current = pathname;
    window.scrollTo(0, 0);
  }, [pathname]);
}
