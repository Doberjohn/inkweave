import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  ART_WAIT_MS,
  _resetPrerenderedArt,
  prerenderedArtShown,
  rememberPrerenderedArt,
  renderOverPrerenderedPage,
} from '../prerenderedArt';

/**
 * A prerendered page holding an image of `src` that reports `naturalWidth` pixels across once
 * loaded, approved by index.html's inline script unless `approved` is false.
 */
function pageWith(src: string, {complete = true, naturalWidth = 488, approved = true} = {}) {
  const page = document.createElement('div');
  page.toggleAttribute('data-ready', approved);
  page.append(Object.assign(document.createElement('img'), {src}));
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(complete);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(naturalWidth);
  // jsdom sets no current source without a canvas package.
  vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get').mockImplementation(function (
    this: HTMLImageElement,
  ) {
    return this.src;
  });
  return page;
}

describe('prerenderedArt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    _resetPrerenderedArt();
  });

  it('knows the art the page showed, whichever way the app spells its address', () => {
    rememberPrerenderedArt(pageWith('/card-images/1936.avif'));

    expect(prerenderedArtShown('/card-images/1936.avif')).toBe(true);
    expect(prerenderedArtShown(`${location.origin}/card-images/1936.avif`)).toBe(true);
    expect(prerenderedArtShown('/card-images/1937.avif')).toBe(false);
    expect(prerenderedArtShown(undefined)).toBe(false);
  });

  it("leaves out art the page hadn't loaded, or couldn't", () => {
    rememberPrerenderedArt(pageWith('/card-images/1936.avif', {complete: false}));
    expect(prerenderedArtShown('/card-images/1936.avif')).toBe(false);

    vi.restoreAllMocks();
    rememberPrerenderedArt(pageWith('/card-images/1936.avif', {naturalWidth: 0}));
    expect(prerenderedArtShown('/card-images/1936.avif')).toBe(false);
  });

  it("takes no art from a page the inline script didn't approve, which stayed hidden", () => {
    rememberPrerenderedArt(pageWith('/card-images/1936.avif', {approved: false}));

    expect(prerenderedArtShown('/card-images/1936.avif')).toBe(false);
  });

  it('forgets the art once the visitor leaves the page that showed it, for good', () => {
    const page = location.pathname;
    rememberPrerenderedArt(pageWith('/card-images/1936.avif'));

    history.pushState(null, '', '/browse');
    const elsewhere = prerenderedArtShown('/card-images/1936.avif');
    history.pushState(null, '', page);

    expect(elsewhere).toBe(false);
    expect(prerenderedArtShown('/card-images/1936.avif')).toBe(false);
  });
});

describe('renderOverPrerenderedPage', () => {
  const ART = '/card-images/1936.avif';
  const skipTransition = vi.fn();
  const startViewTransition = vi.fn((update: () => unknown) => ({
    // A browser calls the update once it has captured the page, so never at once.
    updateCallbackDone: Promise.resolve().then(update),
    // Skipped before it animates, as every transition here is.
    ready: Promise.reject(new DOMException('Transition was skipped', 'AbortError')),
    skipTransition,
  }));
  /** Each copy's decode, which the test settles. */
  let decodes: {img: HTMLImageElement; resolve: () => void}[];

  /** Where an `<img>` lies against the viewport, by its `data-place`; on screen without one. */
  const BOXES: Record<string, Partial<DOMRect>> = {
    above: {top: -320, bottom: -100},
    below: {top: window.innerHeight + 100, bottom: window.innerHeight + 320},
    hidden: {top: 0, bottom: 0},
    onScreen: {top: 0, bottom: 220},
  };

  /** The app's first render, which puts these `<img>`s where the page was. */
  const appShowing = (root: HTMLElement, ...images: {src: string; place?: string}[]) =>
    vi.fn(() => {
      root.replaceChildren(
        ...images.map(({src, place}) => {
          const img = Object.assign(document.createElement('img'), {src});
          if (place) img.dataset.place = place;
          return img;
        }),
      );
    });

  const settle = () => vi.advanceTimersByTimeAsync(0);

  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    skipTransition.mockClear();
    startViewTransition.mockClear();
    decodes = [];
    Object.defineProperty(document, 'startViewTransition', {
      value: startViewTransition,
      configurable: true,
    });
    // jsdom has no decode, and lays nothing out.
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value(this: HTMLImageElement) {
        return new Promise<void>((resolve) => decodes.push({img: this, resolve}));
      },
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return BOXES[this.getAttribute('data-place') ?? 'onScreen'] as DOMRect;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'startViewTransition');
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _resetPrerenderedArt();
  });

  it('renders at once where the browser has no view transitions', () => {
    Reflect.deleteProperty(document, 'startViewTransition');
    const root = pageWith(ART);
    const render = appShowing(root, {src: ART});

    renderOverPrerenderedPage(root, render);

    expect(render).toHaveBeenCalledOnce();
  });

  it('renders at once when the page showed no art', () => {
    const root = pageWith(ART, {complete: false});
    const render = appShowing(root, {src: ART});

    renderOverPrerenderedPage(root, render);

    expect(render).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("notes the page's art before the app renders, so the app starts it loaded", () => {
    Reflect.deleteProperty(document, 'startViewTransition');
    const root = pageWith(ART);
    let shownAtRender = false;

    renderOverPrerenderedPage(root, () => {
      shownAtRender = prerenderedArtShown(ART);
    });

    expect(shownAtRender).toBe(true);
  });

  // React renders in one go inside the transition, so the copy is there to wait for.
  it("holds the page until the app's copy of its art decodes, then ends without a fade", async () => {
    const root = pageWith(ART);
    const app = createRoot(root);

    renderOverPrerenderedPage(root, () =>
      app.render(createElement('img', {src: ART, alt: '', 'data-app': ''})),
    );
    await settle();
    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(decodes.map(({img}) => img.hasAttribute('data-app'))).toEqual([true]);
    expect(skipTransition).not.toHaveBeenCalled();

    decodes[0].resolve();
    await settle();
    expect(skipTransition).toHaveBeenCalledOnce();
    app.unmount();
  });

  it('waits only for on-screen copies of art the page showed', async () => {
    const root = pageWith(ART);
    const render = appShowing(
      root,
      {src: ART},
      {src: ART, place: 'above'},
      {src: ART, place: 'below'},
      {src: ART, place: 'hidden'},
      {src: '/card-images/1937.avif'},
    );

    renderOverPrerenderedPage(root, render);
    await settle();
    expect(decodes).toHaveLength(1);

    decodes[0].resolve();
    await settle();
    expect(skipTransition).toHaveBeenCalledOnce();
  });

  it(`gives up on art that never decodes after ${ART_WAIT_MS} ms`, async () => {
    const root = pageWith(ART);

    renderOverPrerenderedPage(root, appShowing(root, {src: ART}));
    await vi.advanceTimersByTimeAsync(ART_WAIT_MS - 1);
    expect(skipTransition).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(skipTransition).toHaveBeenCalledOnce();
  });

  // The browser reports neither, and catches the error before it reaches the page.
  it('ends the transition and reports the error when the app fails to render', async () => {
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    const root = pageWith(ART);
    const failure = new Error('render failed');

    renderOverPrerenderedPage(root, () => {
      throw failure;
    });
    await settle();

    expect(skipTransition).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(failure);
  });

  it("leaves no unhandled rejection from the skipped transition's `ready`", async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const root = pageWith(ART);

    renderOverPrerenderedPage(root, appShowing(root, {src: ART}));
    await vi.advanceTimersByTimeAsync(ART_WAIT_MS);
    await new Promise((done) => setImmediate(done));
    process.off('unhandledRejection', unhandled);

    expect(skipTransition).toHaveBeenCalledOnce();
    expect(unhandled).not.toHaveBeenCalled();
  });
});
