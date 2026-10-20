import type {SentryApi} from './sentryClient';
import {whenLoadedAndIdle} from './whenLoadedAndIdle';

export type {SentryApi};

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
  // A local module rather than @sentry/react itself, so Sentry's setup ships in the SDK's lazy
  // chunk instead of a startup one (see sentryClient.ts).
  loading ??= import('./sentryClient')
    .then((sdk) => sdk.startSentry())
    // A failed import rejects, except in production builds: there main.tsx cancels Vite's
    // preload error (to reload onto a fresh deploy), so the import resolves empty and
    // `sdk.startSentry()` above throws. Both land here.
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

// Ready callbacks run inside loadSupabase() and React's Profiler, so a throw from Sentry's side
// must not escape into them. It goes to Sentry instead.
function runReadyCallback(callback: (sentry: SentryApi) => void, api: SentryApi): void {
  try {
    callback(api);
  } catch (error) {
    api.captureException(error);
  }
}
