import {describe, it, expect, vi, afterEach} from 'vitest';

const failure = new Error('integration setup broke');

afterEach(() => {
  vi.doUnmock('@sentry/react');
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

// Made-up account ids, in the forms the repositories send them.
const ACCOUNT = '00000000-0000-4000-8000-0000000000a1';
const FRIEND = '00000000-0000-4000-8000-0000000000b2';
const REST = 'https://example.supabase.co/rest/v1';

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
  // stages a production build there too, so only inkweave.ink is production, also when the
  // address ends in a fully qualified name's dot, which serves the same site.
  it.each([
    {deployEnv: 'production', hostname: 'inkweave.ink', expected: 'production'},
    {deployEnv: 'production', hostname: 'inkweave.ink.', expected: 'production'},
    {
      deployEnv: 'production',
      hostname: 'inkweave-abc123-johnfanidis-projects.vercel.app',
      expected: 'preview',
    },
    {deployEnv: 'preview', hostname: 'staging.inkweave.ink', expected: 'preview'},
    {deployEnv: 'unknown', hostname: 'localhost', expected: 'unknown'},
  ])(
    'reports $expected for a $deployEnv build on $hostname',
    async ({deployEnv, hostname, expected}) => {
      const {sentryEnvironment} = await import('../sentryClient');

      expect(sentryEnvironment(deployEnv, hostname)).toBe(expected);
    },
  );
});

describe('scrubAccountData', () => {
  it.each([
    [`${REST}/collections?select=entries&owner_id=eq.${ACCOUNT}`, `${REST}/collections?select=entries&owner_id=eq.[id]`],
    // Encoded, the id follows %28, whose 8 is a hex digit: the match can't lean on a word boundary.
    [
      `${REST}/profiles?select=id%2Chandle&id=in.%28${ACCOUNT}%2C${FRIEND}%29`,
      `${REST}/profiles?select=id%2Chandle&id=in.%28[id]%2C[id]%29`,
    ],
    [`${REST}/profiles?select=id&handle=eq.ruby_hero_042`, `${REST}/profiles?select=id&handle=[Filtered]`],
    ['https://inkweave.ink/browse?binder=all&friend=ruby_hero_042', 'https://inkweave.ink/browse?binder=all&friend=[Filtered]'],
    ['https://inkweave.ink/auth/callback?code=4f2a9c', 'https://inkweave.ink/auth/callback?code=[Filtered]'],
    [
      `${REST}/pair_scores?select=*&card_a_id=eq.14001&card_b_id=eq.2998`,
      `${REST}/pair_scores?select=*&card_a_id=eq.14001&card_b_id=eq.2998`,
    ],
  ])('scrubs %s', async (input, expected) => {
    const {scrubAccountData} = await import('../sentryClient');

    expect(scrubAccountData(input)).toBe(expected);
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
  // app's (INKWEAVE-15). The real SDK, whose flush waits until both errors have been processed
  // and sent, so the check holds whatever order it sends them in.
  it("never sends an error thrown inside Vercel's toolbar", async () => {
    const sent = captureSent();
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
    vi.resetModules();
    const {startSentry} = await import('../sentryClient');
    const {flush} = await import('@sentry/react');
    const sentry = startSentry();
    expect(sentry).not.toBeNull();

    sentry?.captureException(
      errorThrownIn(
        'https://staging.inkweave.ink/_next-live/feedback/593.45704f248a6990f8d21e.js',
        'toolbar broke',
      ),
    );
    sentry?.captureException(
      errorThrownIn('https://staging.inkweave.ink/assets/BrowsePage-x1.js', 'app broke'),
    );

    expect(await flush(2000)).toBe(true);
    expect(sent.join('\n')).toContain('app broke');
    expect(sent.join('\n')).not.toContain('toolbar broke');
  });

  // The SDK sends the page's address as it is and keeps every request's query, and the app's
  // addresses name accounts and friends. The breadcrumbs and the span are written as the SDK writes
  // its own (a fetch breadcrumb's data.url, a request span's url.full), so these hold whether or not
  // an earlier test's SDK still has fetch instrumented.
  it('sends no account id, handle or sign-in code in an error report', async () => {
    const sent = captureSent();
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
    window.history.replaceState(null, '', '/browse?binder=all&friend=ruby_hero_042&code=4f2a9c');
    vi.resetModules();
    const {startSentry} = await import('../sentryClient');
    const {addBreadcrumb, flush} = await import('@sentry/react');
    const sentry = startSentry();
    addBreadcrumb({
      category: 'fetch',
      type: 'http',
      data: {method: 'GET', url: `${REST}/collections?select=entries&owner_id=eq.${ACCOUNT}`},
    });
    addBreadcrumb({category: 'fetch', type: 'http', data: {method: 'GET', url: `${REST}/profiles?select=id&id=in.%28${FRIEND}%29`}});

    sentry?.captureException(new Error(`row for ${ACCOUNT} unusable`));

    expect(await flush(2000)).toBe(true);
    const body = sent.join('\n');
    expect(body).toContain('owner_id=eq.[id]');
    expect(body).toContain('row for [id] unusable');
    for (const secret of [ACCOUNT, FRIEND, 'ruby_hero_042', '4f2a9c']) expect(body).not.toContain(secret);
  });

  it('sends no account id in a trace', async () => {
    const sent = captureSent();
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
    vi.resetModules();
    const {startSentry} = await import('../sentryClient');
    const {flush, startNewTrace} = await import('@sentry/react');
    const sentry = startSentry();
    // A new trace draws its sample value from Math.random: 0 is under tracesSampleRate's 0.1.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    startNewTrace(() =>
      sentry?.startSpan({name: 'probe', forceTransaction: true}, () =>
        sentry.startSpan(
          {name: 'GET /rest/v1/collections', attributes: {'url.full': `${REST}/collections?owner_id=eq.${ACCOUNT}`}},
          () => undefined,
        ),
      ),
    );

    expect(await flush(2000)).toBe(true);
    const body = sent.join('\n');
    expect(body).toContain('owner_id=eq.[id]');
    expect(body).not.toContain(ACCOUNT);
  });
});
