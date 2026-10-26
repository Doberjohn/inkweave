import {describe, it, expect, vi, afterEach} from 'vitest';

const failure = new Error('integration setup broke');

afterEach(() => {
  vi.doUnmock('@sentry/react');
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// What the SDK sends, decoded. The SDK keeps the first fetch it is handed for as long as its
// modules live, which outlasts vi.resetModules, so every test stubs fetch with this one function
// and starts from an empty list.
const sentBodies: string[] = [];

async function recordingFetch(_url: string, request?: RequestInit): Promise<Response> {
  const body = request?.body;
  sentBodies.push(typeof body === 'string' ? body : new TextDecoder().decode(body as Uint8Array));
  return new Response('{}');
}

/** Stubs fetch, which the SDK sends through, and returns the list of what it sends. */
function captureSent(): string[] {
  sentBodies.length = 0;
  vi.stubGlobal('fetch', recordingFetch);
  return sentBodies;
}

/** Swaps the SDK for stubs, with `init` and `captureException` as the test needs them. */
function stubSdk(sdk: {init: (options: unknown) => void; captureException?: () => void}): void {
  vi.resetModules();
  vi.doMock('@sentry/react', () => ({
    browserTracingIntegration: vi.fn(),
    captureException: vi.fn(),
    startSpan: vi.fn(),
    addIntegration: vi.fn(),
    supabaseIntegration: vi.fn(),
    ...sdk,
  }));
}

/** An error whose stack, as Chrome writes it, says it was thrown in the script at `url`. */
function errorThrownIn(url: string, message: string): Error {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at ne (${url}:1:14620)\n    at f (${url}:1:15901)`;
  return error;
}

describe('sentryEnvironment', () => {
  // Vercel opens every new deployment at its own vercel.app address, and a PR's Deploy dry run
  // stages a production build there too, so only inkweave.ink is production.
  it.each([
    {deployEnv: 'production', hostname: 'inkweave.ink', expected: 'production'},
    {
      deployEnv: 'production',
      hostname: 'inkweave-abc123-johnfanidis-projects.vercel.app',
      expected: 'preview',
    },
    {deployEnv: 'preview', hostname: 'staging.inkweave.ink', expected: 'preview'},
    {deployEnv: 'unknown', hostname: 'localhost', expected: 'unknown'},
  ])('reports $expected for a $deployEnv build on $hostname', async ({deployEnv, hostname, expected}) => {
    const {sentryEnvironment} = await import('../sentryClient');

    expect(sentryEnvironment(deployEnv, hostname)).toBe(expected);
  });
});

describe('startSentry', () => {
  // Production builds run it inside Vite's preload wrapper, where a throw becomes a page reload
  // (see sentry.ts), so a broken SDK has to come back as null, even when reporting throws too.
  it('returns null, never a throw, when the SDK fails to start', async () => {
    stubSdk({
      init: () => {
        throw failure;
      },
      captureException: () => {
        throw new Error('capture broke too');
      },
    });
    const {startSentry} = await import('../sentryClient');

    expect(startSentry()).toBeNull();
  });

  // The page's own address goes in: a production build anywhere but inkweave.ink, as on jsdom's
  // localhost here, starts Sentry as preview.
  it('starts a production build away from inkweave.ink as preview', async () => {
    vi.stubGlobal('__DEPLOY_ENV__', 'production');
    const init = vi.fn();
    stubSdk({init});
    const {startSentry} = await import('../sentryClient');

    startSentry();

    expect(init).toHaveBeenCalledWith(expect.objectContaining({environment: 'preview'}));
  });

  // The real SDK, with only the tracing integration swapped for one that throws while init sets it
  // up. init binds its client before it sets up the integrations, so the failure still goes out: an
  // SDK upgrade that changes that order fails here.
  it('sends the failure to Sentry when an integration throws during init', async () => {
    const sent = captureSent();
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

  // Vercel adds its toolbar to previews and staging for people signed in to the team, and the SDK
  // wraps the toolbar's requestAnimationFrame callbacks too, so its errors reached Sentry as the
  // app's (INKWEAVE-15). The real SDK, which sends in order: once the app error captured second
  // is out, the toolbar's would be too.
  it("never sends an error thrown inside Vercel's toolbar", async () => {
    const sent = captureSent();
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
    vi.resetModules();
    const {startSentry} = await import('../sentryClient');
    const sentry = startSentry();
    expect(sentry).not.toBeNull();

    sentry?.captureException(
      errorThrownIn(
        'https://staging.inkweave.ink/_next-live/feedback/593.45704f248a6990f8d21e.js',
        'toolbar broke',
      ),
    );
    sentry?.captureException(errorThrownIn('https://staging.inkweave.ink/assets/BrowsePage-x1.js', 'app broke'));

    await vi.waitFor(() => expect(sent.join('\n')).toContain('app broke'));
    expect(sent.join('\n')).not.toContain('toolbar broke');
  });
});
