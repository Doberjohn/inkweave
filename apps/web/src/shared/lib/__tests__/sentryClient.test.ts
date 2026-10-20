import {describe, it, expect, vi, afterEach} from 'vitest';

const failure = new Error('integration setup broke');

afterEach(() => {
  vi.doUnmock('@sentry/react');
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('startSentry', () => {
  // Production builds run it inside Vite's preload wrapper, where a throw becomes a page reload
  // (see sentry.ts), so a broken SDK has to come back as null, even when reporting throws too.
  it('returns null, never a throw, when the SDK fails to start', async () => {
    vi.resetModules();
    vi.doMock('@sentry/react', () => ({
      init: () => {
        throw failure;
      },
      browserTracingIntegration: vi.fn(),
      captureException: () => {
        throw new Error('capture broke too');
      },
      startSpan: vi.fn(),
      addIntegration: vi.fn(),
      supabaseIntegration: vi.fn(),
    }));
    const {startSentry} = await import('../sentryClient');

    expect(startSentry()).toBeNull();
  });

  // The real SDK, with only the tracing integration swapped for one that throws while init sets it
  // up. init binds its client before it sets up the integrations, so the failure still goes out: an
  // SDK upgrade that changes that order fails here.
  it('sends the failure to Sentry when an integration throws during init', async () => {
    const sent: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, request?: RequestInit) => {
        const body = request?.body;
        sent.push(typeof body === 'string' ? body : new TextDecoder().decode(body as Uint8Array));
        return new Response('{}');
      }),
    );
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
    vi.resetModules();
    vi.doMock('@sentry/react', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@sentry/react')>()),
      browserTracingIntegration: () => ({
        name: 'BrowserTracing',
        setup: () => {
          throw failure;
        },
      }),
    }));
    const {startSentry} = await import('../sentryClient');

    expect(startSentry()).toBeNull();
    await vi.waitFor(() => expect(sent.join('\n')).toContain(failure.message));
  });
});
