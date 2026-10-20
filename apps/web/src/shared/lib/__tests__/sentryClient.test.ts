import {describe, it, expect, vi, afterEach} from 'vitest';

const failure = new Error('init broke');

/** A fresh sentryClient.ts over an SDK whose init throws, as when an integration fails to set up. */
async function loadClient(captureException: () => void) {
  vi.resetModules();
  vi.doMock('@sentry/react', () => ({
    init: () => {
      throw failure;
    },
    browserTracingIntegration: vi.fn(),
    captureException,
    startSpan: vi.fn(),
    addIntegration: vi.fn(),
    supabaseIntegration: vi.fn(),
  }));
  return import('../sentryClient');
}

afterEach(() => {
  vi.doUnmock('@sentry/react');
});

describe('startSentry', () => {
  // Production builds run it inside Vite's preload wrapper, where a throw becomes a page reload
  // (see sentry.ts), so a broken SDK has to come back as null, even when reporting throws too.
  it('returns null, never a throw, when the SDK fails to start', async () => {
    const {startSentry} = await loadClient(() => {
      throw new Error('capture broke too');
    });

    expect(startSentry()).toBeNull();
  });

  it('reports the failure, which reaches Sentry when init got as far as binding its client', async () => {
    const captureException = vi.fn();
    const {startSentry} = await loadClient(captureException);

    startSentry();

    expect(captureException).toHaveBeenCalledExactlyOnceWith(failure);
  });
});
