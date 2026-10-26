import type {EventProperties, PostHogApi} from './posthogClient';
import {onSentryReady} from './sentry';
import {whenLoadedAndIdle} from 'inkweave-ui/lib/whenLoadedAndIdle';

/*
 * PostHog (#827), kept off the critical path like Sentry (#640). It loads after `load` and an
 * idle callback, from its own chunk. Events fired before then wait with the time they happened,
 * and go out with that time once it is up. They carry the page PostHog is up on, which can differ
 * from the page they came from; their own props (`source`) still say where.
 *
 * It never loads during our own prerender crawl (scripts/prerender.mjs sets
 * `__INKWEAVE_PRERENDER__`): an import there would bake its modulepreload into every crawled
 * page's HTML, which deploy check 7 rejects.
 */

interface QueuedEvent {
  event: string;
  properties: EventProperties;
  timestamp: Date;
}

let posthog: PostHogApi | null = null;
let loading: Promise<PostHogApi | null> | null = null;
let stopped = false;
let queue: QueuedEvent[] = [];

/**
 * Imports and starts PostHog, once. Resolves to null where PostHog is off (dev, no key, the
 * crawl) or when it fails to load (blocked by an extension, offline).
 */
export function loadPostHog(): Promise<PostHogApi | null> {
  // Literal env checks, so builds without a key drop the import below entirely.
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!import.meta.env.PROD || !key) return Promise.resolve(null);
  if (isPrerenderCrawl()) return Promise.resolve(null);
  // A local module rather than posthog-js itself, so the chunk is named after it and the size
  // budget can find it.
  loading ??= import('./posthogClient')
    // Read the module only as `sdk.startPostHog` inside this callback, and never pass `sdk` on:
    // once the namespace escapes, Rolldown ships the whole module (see supabase.ts).
    //
    // The failure handler sits in this `.then` on purpose. Production builds move the import and
    // this `.then` into Vite's preload wrapper, which turns any rejection inside it into a
    // vite:preloadError, and main.tsx answers that with a page reload. Handled here, a failed
    // download never reaches the wrapper, so an analytics SDK can't reload the page. startPostHog
    // never throws, for the same reason.
    .then(
      (sdk) => sdk.startPostHog(key, reportToSentry),
      () => null,
    )
    // The wrapper can still resolve undefined, for a failure it saw first. No rejection handler
    // here: nothing above rejects, and one here would also catch a failed import in tests, where
    // nothing folds, so they could not tell whether the handler above is there.
    .then((api) => (api ? onPostHogLoaded(api) : stop()));
  return loading;
}

/** Loads PostHog once the page has fired `load` and the main thread is idle. */
export function loadPostHogWhenIdle(): void {
  whenLoadedAndIdle(() => void loadPostHog());
}

/**
 * Sends an event to PostHog: at once when it is up, and while it loads, later with the time it
 * happened. Dropped where PostHog is off or has stopped, so nothing piles up. Never loads it.
 */
export function capturePostHog(event: string, properties: EventProperties): void {
  if (posthog) send(posthog, event, properties);
  else if (isPostHogOn() && !stopped) queue.push({event, properties, timestamp: new Date()});
}

/** The same conditions loadPostHog checks, without its import. */
function isPostHogOn(): boolean {
  return import.meta.env.PROD && Boolean(import.meta.env.VITE_POSTHOG_KEY) && !isPrerenderCrawl();
}

function isPrerenderCrawl(): boolean {
  return window.__INKWEAVE_PRERENDER__ === true;
}

function onPostHogLoaded(api: PostHogApi): PostHogApi | null {
  posthog = api;
  const waiting = queue;
  queue = [];
  for (const {event, properties, timestamp} of waiting) {
    if (!posthog) break; // a throw stopped it
    send(posthog, event, properties, timestamp);
  }
  return posthog;
}

/**
 * One event to the SDK. A throw from it must never reach the click that sent the event, so it
 * stops PostHog for the rest of the page instead, and goes to Sentry once.
 */
function send(api: PostHogApi, event: string, properties: EventProperties, timestamp?: Date): void {
  try {
    api.capture(event, properties, timestamp);
  } catch (error) {
    stop();
    reportToSentry(error);
  }
}

function reportToSentry(error: unknown): void {
  onSentryReady((sentry) => sentry.captureException(error));
}

/** Nothing more is queued or sent on this page. */
function stop(): null {
  posthog = null;
  stopped = true;
  queue = [];
  return null;
}
