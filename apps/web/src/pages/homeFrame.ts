import type {CSSProperties} from 'react';

/*
 * HomePage's frame, shared with HomePageSkeleton (#914) so the two layouts can't drift: the
 * skeleton centered its content in the whole viewport while the page centers it in the space
 * above its Footer, and the featured row jumped 120px when the page's code arrived.
 */

/** HomePage's outer column: the page, then the Footer below it. */
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
