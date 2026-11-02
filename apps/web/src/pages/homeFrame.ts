import type {CSSProperties} from 'react';

/*
 * HomePage's frame, shared with HomePageSkeleton (#914) so the two layouts can't drift: the
 * skeleton centered its content in the whole viewport while the page centers it in the space
 * above its Footer, and the featured row jumped 120px when the page's code arrived.
 */

/**
 * The beta notice, on in builds whose `VITE_SHOW_BETA_NOTICE` is 'true'. HomePage and its
 * skeleton both render it above `<main>`, so the hero sits in the same place before and after
 * the page's code arrives.
 */
export const SHOW_BETA_NOTICE = import.meta.env.VITE_SHOW_BETA_NOTICE === 'true';

/** HomePage's outer column: the beta notice, the page, then the Footer below it. */
export const HOME_PAGE_STYLE: CSSProperties = {minHeight: '100vh', display: 'flex', flexDirection: 'column'};

/** HomePage's `<main>`: fills the column above the Footer and centers the hero on desktop. */
export function homeMainStyle(isMobile: boolean): CSSProperties {
  return {
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: isMobile ? undefined : 'center',
  };
}
