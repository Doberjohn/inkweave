// The only module that imports @sentry/react as a value (#640, #838). sentry.ts reaches it
// through a dynamic import, so the SDK ships in this module's own chunk, `sentryClient-*.js`. A
// static import of it anywhere else would load the SDK with that module, at startup if main.tsx
// reaches it. Nor does it import anything from the app: that would reshape the startup chunks.
import {browserTracingIntegration, captureException, init, startSpan} from '@sentry/react';

/** The part of Sentry the app calls, once it has loaded. */
export interface SentryApi {
  captureException: typeof captureException;
  startSpan: typeof startSpan;
}

/**
 * Starts Sentry and returns the part of it the app calls, or null when the SDK fails to start.
 * Never throws: this runs inside Vite's preload wrapper, where a throw becomes a page reload
 * (see sentry.ts).
 */
export function startSentry(): SentryApi | null {
  try {
    init(sentryOptions());
  } catch (error) {
    reportStartFailure(error);
    return null;
  }
  return {captureException, startSpan};
}

/**
 * init binds its client before it sets up the integrations, so when one of them throws, Sentry is
 * half started: the client is bound, and the integrations set up before the throw keep running.
 * The failure goes to Sentry through that client. With no client bound yet, this does nothing. It
 * never throws, since a broken SDK can throw here too.
 */
function reportStartFailure(error: unknown): void {
  try {
    captureException(error);
  } catch {
    // Nothing left to report through.
  }
}

/** The one address where a production build serves visitors. */
const PRODUCTION_HOST = 'inkweave.ink';

/**
 * Sentry's environment: the build's (production, preview or unknown, #740), except that a
 * production build counts as production only on inkweave.ink. Vercel opens every new deployment
 * at its own vercel.app address, and a PR's Deploy dry run stages a production build there too:
 * neither is a visitor, so both report as preview. The hostname keeps a fully qualified name's
 * trailing dot, and inkweave.ink. serves the same site, so the dot is dropped first.
 */
export function sentryEnvironment(deployEnv: string, hostname: string): string {
  const host = hostname.replace(/[.]$/, '');
  return deployEnv === 'production' && host !== PRODUCTION_HOST ? 'preview' : deployEnv;
}

/**
 * An account id. Supabase's user ids are UUIDs written with dashes; card ids are numbers, and
 * Sentry's event, trace and span ids have no dashes, so neither matches (its debug ids do, which
 * is why scrubEvent passes them by). No word boundaries: in an encoded `id=in.(…)` filter the id
 * follows `%28`, whose 8 is a hex digit.
 */
const ACCOUNT_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Address params whose value names a player, or is a sign-in's one-time code: a friend's binder
 * (binderCards' FRIEND_PARAM; a literal, since this module imports nothing from the app), a
 * profile looked up by handle, and the sign-in return.
 */
const ACCOUNT_PARAM = /\b((?:friend|handle|code)=)[^&#\s"']*/gi;

/** `text` with its account ids, handles and sign-in codes replaced. */
export function scrubAccountData(text: string): string {
  return text.replace(ACCOUNT_ID, '[id]').replace(ACCOUNT_PARAM, '$1[Filtered]');
}

/** Scrubs every string inside `value` in place: request addresses, breadcrumbs, spans and messages alike. */
function scrubStrings<T>(value: T): T {
  if (typeof value === 'string') return scrubAccountData(value) as T;
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) record[key] = scrubStrings(record[key]);
  return value;
}

/**
 * An event's fields that hold Sentry's own data, never the app's: `debug_meta` names each script's
 * debug id, a dashed UUID that ties its frames to the uploaded source map, and
 * `sdkProcessingMetadata` holds the SDK's live state, which never leaves the browser.
 */
const SENTRY_OWN_FIELDS = new Set(['debug_meta', 'sdkProcessingMetadata']);

/** Scrubs every string an error report carries except in Sentry's own fields. */
function scrubEvent<E extends object>(event: E): E {
  const record = event as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!SENTRY_OWN_FIELDS.has(key)) record[key] = scrubStrings(record[key]);
  }
  return event;
}

function sentryOptions(): Parameters<typeof init>[0] {
  // Sentry 11 collects user info, cookies, request/response bodies and query data by
  // default (v10 did not), and bodies here could include Supabase sign-in and vote
  // payloads. This is the migration guide's block for restoring v10's restrictive
  // defaults; piiDeny drops IP, proxy and user identifiers from headers and query params.
  const piiDeny = {deny: ['forwarded', '-ip', 'remote-', 'via', '-user']};

  return {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: sentryEnvironment(__DEPLOY_ENV__, window.location.hostname),
    // No Supabase integration: every Supabase call reports its own failures, named by where
    // they happened (reportFailure.ts), so the integration would send each refusal twice.
    integrations: [browserTracingIntegration()],
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
    // Vercel's toolbar, which Vercel adds to previews and staging for people signed in to the
    // team: an error thrown inside it isn't the app's (INKWEAVE-15).
    denyUrls: ['/_next-live/'],
    // The SDK keeps request queries and sends the page's address as it is, and the app's
    // addresses name accounts and friends: every string an error or a span carries, Sentry's own
    // fields aside, is scrubbed on the way out, so no report ties to an account. Sentry 11 sends
    // each span on its own (its default `traceLifecycle`, 'stream'), so traces pass through
    // beforeSendSpan, never beforeSendTransaction.
    beforeSend: (event) => scrubEvent(event),
    beforeSendSpan: (span) => scrubStrings(span),
  };
}
