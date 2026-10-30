import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import type {SentryApi} from '../sentry';

// The SDK as the app sees it. Tests of a broken SDK register their own mock instead.
const sentryMock = () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({name: 'BrowserTracing'})),
  captureException: vi.fn(),
  startSpan: vi.fn(),
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
  // resetModules keeps registered mocks, so a test that replaced the client must remove it.
  vi.doUnmock('../sentryClient');
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

  it('reports the build environment, never a hard-coded production', async () => {
    const {loadSentry, Sentry} = await loadModules();

    await loadSentry();

    // vite.config.ts pins the fallback under Vitest, whatever VERCEL_ENV the shell has (#740).
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({environment: 'unknown'}));
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
      '@sentry/react',
      () => {
        throw new Error('blocked by an extension');
      },
    ],
    [
      'Sentry.init throws',
      '@sentry/react',
      () => ({
        ...sentryMock(),
        init: () => {
          throw new Error('init broke');
        },
      }),
    ],
    // What the loader gets when a failure reaches Vite's preload wrapper, as every failed download
    // did before #838: production builds move the import's first `.then` into the wrapper, which
    // fires vite:preloadError (main.tsx cancels it to reload) and resolves undefined.
    ['the load resolves empty', '../sentryClient', () => ({startSentry: () => undefined})],
  ])('resolves to null and drops waiting callbacks when %s', async (_label, mocked, broken) => {
    vi.resetModules();
    vi.doMock(mocked, broken);
    const {loadSentry, onSentryReady} = await import('../sentry');
    // Uses the API, as posthog.ts's callback does, so it throws when handed anything else.
    const waiting = vi.fn((sentry: SentryApi) => sentry.captureException(new Error('probe')));
    const later = vi.fn();

    onSentryReady(waiting);
    await expect(loadSentry()).resolves.toBeNull();
    onSentryReady(later);

    expect(waiting).not.toHaveBeenCalled();
    expect(later).not.toHaveBeenCalled();
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
