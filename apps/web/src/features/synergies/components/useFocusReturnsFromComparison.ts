import {useLayoutEffect, useRef, type RefObject} from 'react';

/** Focus fell to <body>, or sits inside an inert view, which no key reaches. */
function focusLeftInert(active: Element | null): boolean {
  return active === document.body || !!active?.closest('[inert]');
}

/**
 * Focus returns to the synergy tile that opened a comparison once it closes (BACK or Escape),
 * or to the close × if that tile is gone, as a tile of the expanded group view is (WCAG 2.4.3).
 * The × takes it wherever it was: focus left on a control in the comparison's panel, which stays
 * mounted through the exit animation, would fall to <body> when the panel unmounts. BACK takes
 * focus when the comparison opens (BackButton). A shared link's comparison has no BACK, and it can
 * arrive while focus sits in the synergy column, after its Try again: the comparison makes the
 * column inert, so the × takes focus then. Returns what keeps the opener: call it with what held
 * focus when the tile was pressed.
 */
export function useFocusReturnsFromComparison(inComparison: boolean, fallbackRef: RefObject<HTMLElement | null>) {
  const openerRef = useRef<HTMLElement | null>(null);
  const wasInComparison = useRef(inComparison);
  useLayoutEffect(() => {
    const changed = wasInComparison.current !== inComparison;
    wasInComparison.current = inComparison;
    if (!changed) return;
    if (inComparison) {
      if (focusLeftInert(document.activeElement)) fallbackRef.current?.focus({preventScroll: true});
      return;
    }
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus({preventScroll: true});
    else fallbackRef.current?.focus({preventScroll: true});
  }, [inComparison, fallbackRef]);
  return (opener: HTMLElement | null) => {
    openerRef.current = opener;
  };
}
