import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

// The SDK as the app sees it. Tests of a broken SDK register their own mock instead.
const sentryMock = () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({name: 'BrowserTracing'})),
  captureException: vi.fn(),
  startSpan: vi.fn(),
  addIntegration: vi.fn(),
  supabaseIntegration: vi.fn(),
});

// sentry.ts keeps its loaded state at module level, so each test loads fresh copies of it and
// of the mocked SDK.
async function loadModules() {
  vi.resetModules();
  vi.doMock('@sentry/react', sentryMock);
  const sentryLib = await import('../sentry');
  const Sentry = await import('@sentry/react');
  return {...sentryLib, Sentry};
}

beforeEach(() => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.__INKWEAVE_PRERENDER__;
});

describe('sentry', () => {
  it('initializes Sentry once, however often it is asked', async () => {
    const {loadSentry, Sentry} = await loadModules();

    const [first, second] = await Promise.all([loadSentry(), loadSentry()]);

    expect(first?.captureException).toBe(Sentry.captureException);
    expect(second).toBe(first);
    expect(Sentry.init).toHaveBeenCalledOnce();
  });

  it.each([
    ['during the prerender crawl', () => (window.__INKWEAVE_PRERENDER__ = true)],
    ['without a DSN', () => vi.stubEnv('VITE_SENTRY_DSN', '')],
  ])('never loads Sentry %s', async (_label, setUp) => {
    setUp();
    const {loadSentry, Sentry} = await loadModules();

    await expect(loadSentry()).resolves.toBeNull();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('holds onSentryReady callbacks until Sentry loads, without loading it, then runs later ones at once', async () => {
    const {loadSentry, onSentryReady, Sentry} = await loadModules();
    const early = vi.fn();
    const late = vi.fn();

    onSentryReady(early);
    await vi.dynamicImportSettled();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(early).not.toHaveBeenCalled();

    const sentry = await loadSentry();
    expect(early).toHaveBeenCalledWith(sentry);

    onSentryReady(late);
    expect(late).toHaveBeenCalledWith(sentry);
  });

  it('waits for load and an idle moment before loading Sentry', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const {loadSentryWhenIdle, Sentry} = await loadModules();

    loadSentryWhenIdle();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(Sentry.init).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.dynamicImportSettled();
    expect(Sentry.init).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'the import fails',
      () => {
        throw new Error('blocked by an extension');
      },
    ],
    [
      // What production sees: main.tsx cancels Vite's preload error, so the import resolves empty.
      'init throws on an empty module',
      () => ({
        browserTracingIntegration: vi.fn(),
        init: () => {
          throw new TypeError("Cannot read properties of undefined (reading 'init')");
        },
      }),
    ],
  ])('resolves to null and drops waiting callbacks when %s', async (_label, brokenSdk) => {
    vi.resetModules();
    vi.doMock('@sentry/react', brokenSdk);
    const {loadSentry, onSentryReady} = await import('../sentry');
    const callback = vi.fn();

    onSentryReady(callback);
    await expect(loadSentry()).resolves.toBeNull();
    onSentryReady(callback);

    expect(callback).not.toHaveBeenCalled();
  });

  it('sends a throwing ready callback to Sentry instead of into its caller', async () => {
    const {loadSentry, onSentryReady, Sentry} = await loadModules();
    const failure = new Error('supabase-js changed shape');
    const throwing = () => {
      throw failure;
    };
    const next = vi.fn();

    onSentryReady(throwing);
    onSentryReady(next);
    await loadSentry();

    expect(next).toHaveBeenCalled();
    expect(() => onSentryReady(throwing)).not.toThrow();
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
    expect(Sentry.captureException).toHaveBeenCalledWith(failure);
  });
});
