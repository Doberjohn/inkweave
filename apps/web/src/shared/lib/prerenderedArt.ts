import {flushSync} from 'react-dom';

/** The addresses of the art the prerendered page showed as the app took over from it (#915). */
let shownArt = new Set<string>();
/** The path of the page that showed it, the only page where it counts as shown. */
let shownOn = '';

/** The longest the prerendered page stays on screen for the app's copies of its art to decode. */
export const ART_WAIT_MS = 300;

/**
 * Notes the art a prerendered page shows, its `<img>`s that have loaded, just before the app
 * renders over it. A page index.html's inline script didn't approve (`data-ready`) was hidden,
 * so it showed none.
 */
export function rememberPrerenderedArt(root: HTMLElement): void {
  const images = root.hasAttribute('data-ready') ? [...root.querySelectorAll('img')] : [];
  shownArt = new Set(
    images.filter((img) => img.complete && img.naturalWidth > 0).map((img) => img.currentSrc),
  );
  shownOn = window.location.pathname;
}

/**
 * Whether the prerendered page showed the art at `src`, as its own `<img>` names it. Once the
 * visitor leaves that page, its art loads as any other on every page, that one too.
 */
export function prerenderedArtShown(src: string | undefined): boolean {
  if (window.location.pathname !== shownOn) shownArt.clear();
  return src !== undefined && shownArt.has(new URL(src, document.baseURI).href);
}

/**
 * Renders the app in place of the prerendered page in `root`, with no frame between them that
 * leaves out the page's art (#915). Chromium gives a new `<img>` its image a task after it
 * mounts, even an image already on screen, so the app's first frame would draw that art blank.
 * Where the browser has view transitions, the page stays on screen while the app renders, in one
 * go, and its on-screen copies of that art decode, for up to ART_WAIT_MS. The transition is then
 * skipped, so the app shows without a fade. Elsewhere, or when the page showed no art, the app
 * renders as usual. main.tsx calls it as it lets go of the page.
 */
export function renderOverPrerenderedPage(root: HTMLElement, render: () => void): void {
  rememberPrerenderedArt(root);
  if (shownArt.size === 0 || !('startViewTransition' in document)) {
    render();
    return;
  }
  const transition = document.startViewTransition(() => {
    flushSync(render);
    return artDecoded(root);
  });
  // Skipped before it animates, a transition rejects `ready`, which nothing else awaits.
  void transition.ready.catch(() => undefined);
  const skip = () => transition.skipTransition();
  // The browser keeps an error thrown inside the update to the transition, so it's reported here.
  void transition.updateCallbackDone.then(skip, (error: unknown) => {
    skip();
    reportError(error);
  });
}

/** Settles once the app's on-screen copies of the page's art have decoded, or at ART_WAIT_MS. */
function artDecoded(root: HTMLElement): Promise<unknown> {
  const copies = [...root.querySelectorAll('img')].filter(
    (img) => shownArt.has(img.src) && onScreen(img),
  );
  return Promise.race([
    Promise.all(copies.map((img) => img.decode().catch(() => undefined))),
    new Promise((done) => setTimeout(done, ART_WAIT_MS)),
  ]);
}

/** Whether `element` lies across the viewport. One not rendered has a box of zeros, so it doesn't. */
function onScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.bottom > 0 && box.top < window.innerHeight;
}

/** @internal reset for testing */
export function _resetPrerenderedArt(): void {
  shownArt = new Set();
  shownOn = '';
}
