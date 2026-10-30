import {loadSentry, onSentryReady, type SentryApi} from './sentry';

/** The parts of the app whose handled failures go to Sentry. */
export type FailureArea = 'collection' | 'sharing' | 'friends' | 'profile' | 'votes';

/** Where a failure happened. `storage` marks the browser refusing local storage. */
export interface FailureSite {
  area: FailureArea;
  /** What the code was doing, in a few words ('save', 'read switch'). Never data. */
  operation: string;
  storage?: boolean;
}

type FailureKind = 'database' | 'network' | 'server' | 'storage' | 'unexpected';

/**
 * A request that never got an answer, by the name of the error that stopped it: fetch throws a
 * TypeError (or an AbortError or TimeoutError when cut short), and postgrest-js hands back the
 * error its fetch threw, auth-js's AuthRetryableFetchError among them, as "<name>: <message>".
 */
const NETWORK_FAILURE = /^(TypeError|\w*FetchError|AbortError|TimeoutError): /;

/** The kinds that are the connection's, the browser's or the database host's, not the app's. */
const WARNING_KINDS = new Set<FailureKind>(['network', 'server', 'storage']);

/** How much of a failure's message a report carries: an outage's error page comes back whole. */
const MESSAGE_LIMIT = 200;

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

/** Whether `failure` is postgrest-js's answer rather than something thrown. */
function isAnswer(failure: unknown): boolean {
  return typeof failure === 'object' && failure !== null && !(failure instanceof Error);
}

function kindOf(site: FailureSite, failure: unknown, code: string): FailureKind {
  if (site.storage) return 'storage';
  const named = failure instanceof Error ? `${failure.name}: ${failure.message}` : messageOf(failure);
  if (NETWORK_FAILURE.test(named)) return 'network';
  if (code) return 'database';
  // An answer with no code is an error page postgrest-js couldn't read, such as a gateway's.
  return isAnswer(failure) ? 'server' : 'unexpected';
}

/**
 * One report per page for each place, kind and code. A browser that refuses storage refuses it at
 * every site, so that goes once per page whichever site meets it first.
 */
function reportKey(site: FailureSite, kind: FailureKind, code: string): string {
  return kind === 'storage' ? kind : [site.area, site.operation, kind, code].join('|');
}

/**
 * Sends a failure the page already handled to Sentry, which would otherwise see only its console
 * line: once per page, tagged with where it happened, with a thrown error as its cause. Loads
 * Sentry if it hasn't loaded, as the error boundary does, so a failure early in the page is kept,
 * except for a storage refusal, which can meet every page as it starts and waits for Sentry's own
 * load. Nothing goes while the browser is offline: that failure is the connection's.
 */
export function reportFailure(site: FailureSite, failure: unknown): void {
  if (navigator.onLine === false) return;
  const code = codeOf(failure);
  const kind = kindOf(site, failure, code);
  const key = reportKey(site, kind, code);
  if (reported.has(key)) return;
  reported.add(key);
  const message = messageOf(failure).slice(0, MESSAGE_LIMIT);
  const error = new Error(
    `${site.area} ${site.operation} failed: ${message}`,
    failure instanceof Error ? {cause: failure} : undefined,
  );
  const send = (sentry: SentryApi) =>
    sentry.captureException(error, {
      level: WARNING_KINDS.has(kind) ? 'warning' : 'error',
      tags: {area: site.area, operation: site.operation, failure: kind},
      fingerprint: ['handled-failure', site.area, site.operation, kind, code],
    });
  if (kind === 'storage') onSentryReady(send);
  else void loadSentry().then((sentry) => sentry && send(sentry));
}

/** @internal Tests only: forget what this page has reported. */
export function _resetReportedFailures(): void {
  reported.clear();
}
