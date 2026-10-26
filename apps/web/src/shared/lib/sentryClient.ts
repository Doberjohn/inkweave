// The only module that imports @sentry/react as a value (#640, #838). sentry.ts reaches it
// through a dynamic import, so the SDK ships in this module's own chunk, `sentryClient-*.js`. A
// static import of it anywhere else would load the SDK with that module, at startup if main.tsx
// reaches it. Nor does it import anything from the app: that would reshape the startup chunks.
import {
  addIntegration,
  browserTracingIntegration,
  captureException,
  init,
  startSpan,
  supabaseIntegration,
} from '@sentry/react';

/** The part of Sentry the app calls, once it has loaded. */
export interface SentryApi {
  captureException: typeof captureException;
  startSpan: typeof startSpan;
  /** Instruments the SupabaseClient class, so it covers clients created before or after. */
  addSupabaseIntegration(supabaseClient: unknown): void;
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
  return {
    captureException,
    startSpan,
    addSupabaseIntegration: (supabaseClient) =>
      addIntegration(supabaseIntegration({supabaseClient})),
  };
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
 * neither is a visitor, so both report as preview.
 */
export function sentryEnvironment(deployEnv: string, hostname: string): string {
  return deployEnv === 'production' && hostname !== PRODUCTION_HOST ? 'preview' : deployEnv;
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
    // The Supabase integration joins later, from shared/lib/supabase.ts, once a page creates
    // the client: registering it here would download the Supabase SDK on every page.
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
  };
}
