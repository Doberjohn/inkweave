import {loadSupabase, type InkweaveSupabase} from './supabase';
import {NOT_CONFIGURED, type RepoResult} from './repoResult';
import {reportFailure, type FailureSite} from './reportFailure';

/** What a Supabase call answers with, before it becomes a `RepoResult`. */
type Answer<T> = PromiseLike<{data: T | null; error: {message: string} | null}>;

/**
 * Loads the client, makes one call and turns everything into a `RepoResult`: the call every
 * repository makes. A build without Supabase answers `NOT_CONFIGURED`; a refusal answers its own
 * message, or `failure` when the page shows its own words; a throw answers 'Network error'.
 *
 * `loadSupabase()` is INSIDE the try, and that placement is load-bearing (#729). It is a cached
 * dynamic import of the SDK chunk, so it can reject on a failed download, not merely resolve null
 * when unconfigured. Hoisted above the try, that rejection escapes as an unhandled promise
 * instead of becoming the 'Network error' every caller already handles.
 *
 * A refusal and a throw also go to Sentry, named by `site`: the page handles them (a Retry, a
 * message, a quiet retry later), so nothing else would.
 */
export async function callSupabase<T>(
  site: FailureSite,
  call: (client: InkweaveSupabase) => Answer<T>,
  failure?: string,
): Promise<RepoResult<T>> {
  try {
    const supabase = await loadSupabase();
    if (!supabase) return {data: null, error: NOT_CONFIGURED};
    const {data, error} = await call(supabase);
    if (error) {
      console.error(`[${site.area}] ${site.operation} failed:`, error.message);
      reportFailure(site, error);
      return {data: null, error: failure ?? error.message};
    }
    return {data, error: null};
  } catch (e) {
    console.error(`[${site.area}] ${site.operation} failed, no answer:`, e);
    reportFailure(site, e);
    return {data: null, error: 'Network error'};
  }
}
