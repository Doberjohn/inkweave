import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {HOLD_CAP_MS, holdPrerenderedPage} from '../prerenderHold';

/** How far into the visit the app's script runs in these tests. */
const STARTED_AT = 3000;

/** A route's readiness that the test settles, so it can hold the page open. */
function held() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return {promise, resolve, reject};
}

/** Lets settled promises run their callbacks, without moving the clock. */
const settle = () => vi.advanceTimersByTimeAsync(0);

const click = (target: Element) =>
  target.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));

describe('holdPrerenderedPage', () => {
  const release = vi.fn();
  let route: ReturnType<typeof held>;

  beforeEach(() => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    vi.spyOn(performance, 'now').mockReturnValue(STARTED_AT);
    release.mockClear();
    route = held();
    document.body.innerHTML =
      '<main><p>Featured cards</p><a href="/browse"><span>Browse all</span></a></main>';
  });

  afterEach(async () => {
    // Ends a hold the test left open, so its listeners don't answer the next test's presses.
    route.resolve();
    await settle();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('lets go once the route has what it waits for', async () => {
    holdPrerenderedPage(route.promise, release);
    await settle();
    expect(release).not.toHaveBeenCalled();

    route.resolve();
    await settle();
    expect(release).toHaveBeenCalledOnce();
  });

  it('lets go when what the route waits for fails, so the app can show its own error', async () => {
    holdPrerenderedPage(route.promise, release);

    route.reject(new Error('offline'));
    await settle();
    expect(release).toHaveBeenCalledOnce();
  });

  it('lets go at the cap, counted from the start of the visit', async () => {
    holdPrerenderedPage(route.promise, release);

    await vi.advanceTimersByTimeAsync(HOLD_CAP_MS - STARTED_AT - 1);
    expect(release).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(release).toHaveBeenCalledOnce();
  });

  it("lets go at the visitor's first click", async () => {
    holdPrerenderedPage(route.promise, release);

    click(document.querySelector('p')!);
    await settle();
    expect(release).toHaveBeenCalledOnce();
  });

  // Even on a link: the key press reaches the link either way.
  it("lets go at the visitor's first key press", async () => {
    holdPrerenderedPage(route.promise, release);

    document
      .querySelector('a')!
      .dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'Enter'}));
    await settle();
    expect(release).toHaveBeenCalledOnce();
  });

  // The link loads its own route's prerendered page.
  it('leaves a click on a link to the link', async () => {
    holdPrerenderedPage(route.promise, release);
    // jsdom can't load another page.
    document.querySelector('a')!.addEventListener('click', (event) => event.preventDefault());

    click(document.querySelector('a span')!);
    await settle();
    expect(release).not.toHaveBeenCalled();
  });

  // The visitor stays on the page, so their next press must reach the app.
  it.each([
    {opens: "at one of the page's own anchors", link: '<a href="#cards">Cards</a>'},
    {opens: 'in a new tab', link: '<a href="/browse" target="_blank">Browse</a>'},
    {opens: 'in a new tab, at a Ctrl+click', link: '<a href="/browse">Browse</a>', ctrlKey: true},
    {opens: 'as a download', link: '<a href="/browse" download>Browse</a>'},
  ])('lets go at a click on a link that opens $opens', async ({link, ctrlKey = false}) => {
    holdPrerenderedPage(route.promise, release);
    document.body.innerHTML = link;
    const anchor = document.querySelector('a')!;
    // jsdom can't load another page, or open one.
    anchor.addEventListener('click', (event) => event.preventDefault());

    anchor.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, ctrlKey}));
    await settle();
    expect(release).toHaveBeenCalledOnce();
  });

  it('keeps holding through a scroll, which presses without clicking', async () => {
    holdPrerenderedPage(route.promise, release);

    const page = document.querySelector('main')!;
    for (const type of ['pointerdown', 'touchstart', 'wheel', 'scroll', 'pointerup', 'touchend']) {
      page.dispatchEvent(new Event(type, {bubbles: true}));
    }
    await settle();
    expect(release).not.toHaveBeenCalled();
  });

  it('lets go only once, and stops listening for presses when it does', async () => {
    const listen = vi.spyOn(window, 'addEventListener');
    holdPrerenderedPage(route.promise, release);

    route.resolve();
    await settle();
    click(document.querySelector('p')!);
    await vi.advanceTimersByTimeAsync(HOLD_CAP_MS);
    expect(release).toHaveBeenCalledOnce();
    const signals = listen.mock.calls.map(
      ([, , options]) => (options as AddEventListenerOptions).signal,
    );
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
  });
});
