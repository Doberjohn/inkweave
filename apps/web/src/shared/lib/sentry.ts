import {whenLoadedAndIdle} from './whenLoadedAndIdle';

type SentryModule = typeof import('@sentry/react');

/** The part of Sentry the app calls, once it has loaded. */
export interface SentryApi {
  captureException: SentryModule['captureException'];
  startSpan: SentryModule['startSpan'];
  /** Instruments the SupabaseClient class, so it covers clients created before or after. */
  addSupabaseIntegration(supabaseClient: unknown): void;
}

/*
 * Sentry, kept off the critical path (#640). It loads after `load` and an idle callback, or at
 * once when an error boundary has something to report. Code that wants Sentry once it is there
 * (render spans, the Supabase integration) queues through onSentryReady, which never loads it.
 *
 * It never loads during our own prerender crawl (scripts/prerender.mjs sets
 * `__INKWEAVE_PRERENDER__`): a Sentry import there would bake its modulepreload into every
 * crawled page's HTML, which deploy check 7 rejects.
 */

let sentry: SentryApi | null = null;
let loading: Promise<SentryApi | null> | null = null;
let loadFailed = false;
let readyCallbacks: ((sentry: SentryApi) => void)[] = [];

/**
 * Imports and initializes Sentry, once. Resolves to null where Sentry is off (dev, no DSN, the
 * crawl) or when it fails to load (blocked by an extension, offline).
 */
export function loadSentry(): Promise<SentryApi | null> {
  // Literal env checks, so builds without a DSN drop the import below entirely.
  if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return Promise.resolve(null);
  if (isPrerenderCrawl()) return Promise.resolve(null);
  loading ??= import('@sentry/react')
    // Read the module only as `Sentry.<name>` inside this callback, and never pass `Sentry` on:
    // Rolldown drops the exports a dynamic import never names, but once the namespace escapes it
    // ships all of @sentry/react, Replay and Feedback included (55 kB gzip became 147 kB).
    .then((Sentry): SentryApi => {
      Sentry.init(sentryOptions(Sentry.browserTracingIntegration()));
      return {
        captureException: Sentry.captureException,
        startSpan: Sentry.startSpan,
        addSupabaseIntegration: (supabaseClient) =>
          Sentry.addIntegration(Sentry.supabaseIntegration({supabaseClient})),
      };
    })
    // A failed import rejects, except in production builds: there main.tsx cancels Vite's
    // preload error (to reload onto a fresh deploy), so the import resolves empty and
    // `Sentry.init` above throws. Both land here.
    .then(onSentryLoaded, () => {
      loadFailed = true;
      readyCallbacks = [];
      return null;
    });
  return loading;
}

/** Loads Sentry once the page has fired `load` and the main thread is idle. */
export function loadSentryWhenIdle(): void {
  whenLoadedAndIdle(() => void loadSentry());
}

/** Runs `callback` with Sentry once it has loaded, right away if it already has. Never loads it. */
export function onSentryReady(callback: (sentry: SentryApi) => void): void {
  if (sentry) runReadyCallback(callback, sentry);
  else if (!loadFailed && !isPrerenderCrawl()) readyCallbacks.push(callback);
}

function isPrerenderCrawl(): boolean {
  return window.__INKWEAVE_PRERENDER__ === true;
}

function onSentryLoaded(api: SentryApi): SentryApi {
  sentry = api;
  const callbacks = readyCallbacks;
  readyCallbacks = [];
  for (const callback of callbacks) runReadyCallback(callback, api);
  return api;
}

// Ready callbacks run inside getSupabase() and React's Profiler, so a throw from Sentry's side
// must not escape into them. It goes to Sentry instead.
function runReadyCallback(callback: (sentry: SentryApi) => void, api: SentryApi): void {
  try {
    callback(api);
  } catch (error) {
    api.captureException(error);
  }
}

function sentryOptions(
  browserTracing: ReturnType<SentryModule['browserTracingIntegration']>,
): Parameters<SentryModule['init']>[0] {
  // Sentry 11 collects user info, cookies, request/response bodies and query data by
  // default (v10 did not), and bodies here could include Supabase sign-in and vote
  // payloads. This is the migration guide's block for restoring v10's restrictive
  // defaults; piiDeny drops IP, proxy and user identifiers from headers and query params.
  const piiDeny = {deny: ['forwarded', '-ip', 'remote-', 'via', '-user']};

  return {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    // The Supabase integration joins later, from shared/lib/supabase.ts, once a page creates
    // the client: registering it here would download supabase-js on every page.
    integrations: [browserTracing],
    tracesSampleRate: 0.1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {request: piiDeny, response: piiDeny},
      httpBodies: [],
      urlQueryParams: piiDeny,
      genAI: {inputs: false, outputs: false},
      databaseQueryData: false,
      queues: false,
      graphQL: {document: false, variables: false},
    },
    // Stale-deploy chunk mismatches are auto-recovered via reload (see the
    // vite:preloadError handler in main.tsx), so they're noise, not bugs. Drop the
    // whole family: the preload re-throw plus the dynamic-import variants.
    ignoreErrors: [
      'Unable to preload CSS',
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
      'error loading dynamically imported module',
    ],
  };
}
