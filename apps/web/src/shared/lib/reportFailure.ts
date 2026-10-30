import {loadSentry} from './sentry';

/** The parts of the app whose handled failures go to Sentry. */
export type FailureArea = 'collection' | 'sharing' | 'friends' | 'profile' | 'votes';

/** Where a failure happened. `storage` marks the browser refusing local storage. */
export interface FailureSite {
  area: FailureArea;
  /** What the code was doing, in a few words ('save', 'read switch'). Never data. */
  operation: string;
  storage?: boolean;
}

type FailureKind = 'database' | 'network' | 'storage' | 'unexpected';

/** postgrest-js names a request that never reached the database after the error that stopped it. */
const NETWORK_FAILURE = /^(TypeError|FetchError|AbortError|TimeoutError): /;

/** What this page has reported, so a failure that repeats (a Retry, a sync on every mount) goes once. */
const reported = new Set<string>();

function messageOf(failure: unknown): string {
  if (failure instanceof Error) return failure.message;
  const message = (failure as {message?: unknown} | null)?.message;
  return typeof message === 'string' ? message : String(failure);
}

/** A database refusal's code ('42501', 'PGRST301'), or '' for anything else. */
function codeOf(failure: unknown): string {
  const code = (failure as {code?: unknown} | null)?.code;
  return typeof code === 'string' ? code : '';
}

function kindOf(site: FailureSite, message: string, code: string): FailureKind {
  if (site.storage) return 'storage';
  if (NETWORK_FAILURE.test(message)) return 'network';
  return code ? 'database' : 'unexpected';
}

/**
 * Sends a failure the page already handled to Sentry, which would otherwise see only its console
 * line: once per page for each place, kind and code, tagged with where it happened. Loads Sentry if
 * it hasn't loaded, as the error boundary does, so a failure early in the page is kept. Nothing
 * goes while the browser is offline: that failure is the connection's.
 */
export function reportFailure(site: FailureSite, failure: unknown): void {
  if (navigator.onLine === false) return;
  const message = messageOf(failure);
  const code = codeOf(failure);
  const kind = kindOf(site, message, code);
  const key = [site.area, site.operation, kind, code].join('|');
  if (reported.has(key)) return;
  reported.add(key);
  const error = new Error(`${site.area} ${site.operation} failed: ${message}`);
  void loadSentry().then((sentry) =>
    sentry?.captureException(error, {
      level: kind === 'network' || kind === 'storage' ? 'warning' : 'error',
      tags: {area: site.area, operation: site.operation, failure: kind},
      fingerprint: ['handled-failure', site.area, site.operation, kind, code],
    }),
  );
}

/** @internal Tests only: forget what this page has reported. */
export function _resetReportedFailures(): void {
  reported.clear();
}
