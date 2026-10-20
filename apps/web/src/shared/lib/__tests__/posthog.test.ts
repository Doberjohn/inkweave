import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

/**
 * A fresh posthog.ts over a mocked posthogClient and Sentry, since the loader keeps its state at
 * module level. `imported` counts the loader's imports of the client, so a test can prove it
 * never fetched the SDK. Tests of a broken client pass their own module instead.
 */
async function loadLoader(brokenClient?: () => object) {
  const capture = vi.fn();
  const startPostHog = vi.fn<
    (key: string, onError: (error: unknown) => void) => {capture: typeof capture}
  >(() => ({capture}));
  const imported = vi.fn();
  const onSentryReady = vi.fn();
  vi.resetModules();
  vi.doMock('../posthogClient', () => {
    imported();
    return brokenClient ? brokenClient() : {startPostHog};
  });
  vi.doMock('../sentry', () => ({onSentryReady}));
  return {...(await import('../posthog')), capture, startPostHog, imported, onSentryReady};
}

const KEY = 'phc_test';
const SEARCH = {query: 'elsa', source: 'home'};
const SORT = {sortOrder: 'cost', previousSort: 'newest'};

beforeEach(() => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_POSTHOG_KEY', KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.__INKWEAVE_PRERENDER__;
});

describe('posthog', () => {
  it('starts PostHog once with the project key, however often it is asked', async () => {
    const {loadPostHog, startPostHog} = await loadLoader();

    const [first, second] = await Promise.all([loadPostHog(), loadPostHog()]);

    expect(startPostHog).toHaveBeenCalledExactlyOnceWith(KEY, expect.any(Function));
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('hands the SDK a way to report a failed start to Sentry', async () => {
    const {loadPostHog, startPostHog, onSentryReady} = await loadLoader();
    await loadPostHog();
    const failure = new Error('init broke');

    startPostHog.mock.calls[0][1](failure);

    const sentry = {captureException: vi.fn()};
    onSentryReady.mock.calls[0][0](sentry);
    expect(sentry.captureException).toHaveBeenCalledWith(failure);
  });

  it.each([
    ['in dev builds', () => vi.stubEnv('PROD', false)],
    ['without a key', () => vi.stubEnv('VITE_POSTHOG_KEY', '')],
    ['during the prerender crawl', () => (window.__INKWEAVE_PRERENDER__ = true)],
  ])('never imports PostHog %s', async (_label, setUp) => {
    setUp();
    const {loadPostHog, imported} = await loadLoader();

    await expect(loadPostHog()).resolves.toBeNull();
    await vi.dynamicImportSettled();
    expect(imported).not.toHaveBeenCalled();
  });

  it('holds events fired before PostHog is up, without loading it, then sends them in order with their own times', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    const {loadPostHog, capturePostHog, capture, imported} = await loadLoader();

    capturePostHog('search_submitted', SEARCH);
    vi.setSystemTime(new Date('2026-10-20T10:00:02Z'));
    capturePostHog('sort_changed', SORT);
    await vi.dynamicImportSettled();
    expect(imported).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-10-20T10:00:05Z'));
    await loadPostHog();

    expect(capture.mock.calls).toEqual([
      ['search_submitted', SEARCH, new Date('2026-10-20T10:00:00Z')],
      ['sort_changed', SORT, new Date('2026-10-20T10:00:02Z')],
    ]);
  });

  it('sends an event at once when PostHog is up, without a timestamp, so the SDK batches it', async () => {
    const {loadPostHog, capturePostHog, capture} = await loadLoader();
    await loadPostHog();

    capturePostHog('search_submitted', SEARCH);

    expect(capture).toHaveBeenCalledExactlyOnceWith('search_submitted', SEARCH, undefined);
  });

  it('drops events fired while PostHog is off, so none pile up for later', async () => {
    vi.stubEnv('PROD', false);
    const {loadPostHog, capturePostHog, capture} = await loadLoader();
    capturePostHog('search_submitted', SEARCH);

    vi.stubEnv('PROD', true);
    await loadPostHog();

    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    [
      'the import fails',
      () => {
        throw new Error('blocked by an extension');
      },
    ],
    // What production sees when the download fails: Vite's preload wrapper catches it, fires
    // vite:preloadError (main.tsx cancels it) and resolves undefined.
    ['the load resolves empty', () => ({startPostHog: () => undefined})],
  ])(
    'resolves to null when %s, and drops the waiting and later events without an error',
    async (_label, brokenClient) => {
      const {loadPostHog, capturePostHog} = await loadLoader(brokenClient);

      capturePostHog('search_submitted', SEARCH);
      await expect(loadPostHog()).resolves.toBeNull();

      expect(() => capturePostHog('search_submitted', SEARCH)).not.toThrow();
    },
  );

  it('keeps a throw from the SDK away from the caller, stops PostHog for the page and tells Sentry once', async () => {
    const {loadPostHog, capturePostHog, capture, onSentryReady} = await loadLoader();
    await loadPostHog();
    const failure = new Error('SDK broke');
    capture.mockImplementation(() => {
      throw failure;
    });

    expect(() => capturePostHog('search_submitted', SEARCH)).not.toThrow();
    capturePostHog('sort_changed', SORT);

    expect(capture).toHaveBeenCalledOnce();
    expect(onSentryReady).toHaveBeenCalledOnce();
    const sentry = {captureException: vi.fn()};
    onSentryReady.mock.calls[0][0](sentry);
    expect(sentry.captureException).toHaveBeenCalledWith(failure);
  });

  it('stops at the first throw while sending the events that waited', async () => {
    const {loadPostHog, capturePostHog, capture} = await loadLoader();
    capture.mockImplementation(() => {
      throw new Error('SDK broke');
    });
    capturePostHog('search_submitted', SEARCH);
    capturePostHog('sort_changed', SORT);

    await expect(loadPostHog()).resolves.toBeNull();

    expect(capture).toHaveBeenCalledOnce();
  });

  it('waits for load and an idle moment before loading PostHog', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const {loadPostHogWhenIdle, startPostHog} = await loadLoader();

    loadPostHogWhenIdle();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(startPostHog).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(startPostHog).toHaveBeenCalledOnce();
  });
});
