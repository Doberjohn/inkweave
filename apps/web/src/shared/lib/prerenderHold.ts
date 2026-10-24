import {isModifiedClick} from '../utils/touchGuard';

/** The longest a prerendered page is held for the app, from navigation start (#915). */
export const HOLD_CAP_MS = 8000;

/**
 * True for a click that loads another page in this tab, which the link handles: a plain click
 * on a link that opens here, to an address other than the page's own anchors. A click that opens
 * the link elsewhere (a new tab or window, a download) or moves within the page leaves the
 * visitor on it.
 */
function leavesPage(event: Event): boolean {
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(link instanceof HTMLAnchorElement) || !(event instanceof MouseEvent)) return false;
  return opensHere(link, event) && !movesWithinPage(link);
}

/** Whether a click opens `link` in this tab, not in a new tab or window, or as a download. */
function opensHere(link: HTMLAnchorElement, click: MouseEvent): boolean {
  const inThisTab = ['', '_self'].includes(link.target) && !link.hasAttribute('download');
  return inThisTab && !isModifiedClick(click);
}

/** Whether `link` goes to one of the page's own anchors: the page's address with a fragment. */
function movesWithinPage(link: HTMLAnchorElement): boolean {
  const [address, fragment] = link.href.split('#');
  return fragment !== undefined && address === window.location.href.split('#')[0];
}

/**
 * Keeps the prerendered page on screen until the app can render the same page in one commit
 * (#915): `release` runs once, when `ready` settles, when `capMs` from navigation start has
 * passed, or at the visitor's first click or key press, so the next one reaches the app. A
 * click that follows a link to another page is left to the link, and a scroll keeps the hold:
 * the hold ends on `click`, never `pointerdown`, so a scroll that starts on the page doesn't
 * end it.
 */
export function holdPrerenderedPage(
  ready: Promise<unknown>,
  release: () => void,
  capMs = HOLD_CAP_MS,
): void {
  const presses = new AbortController();
  const cap = new Promise((resolve) => setTimeout(resolve, Math.max(0, capMs - performance.now())));
  const pressed = new Promise((resolve) => {
    const onPress = (event: Event) => {
      if (event.type === 'keydown' || !leavesPage(event)) resolve(undefined);
    };
    for (const type of ['click', 'keydown']) {
      window.addEventListener(type, onPress, {capture: true, signal: presses.signal});
    }
  });
  const end = () => {
    presses.abort();
    release();
  };
  void Promise.race([ready, cap, pressed]).then(end, end);
}
