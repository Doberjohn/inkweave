/**
 * The shape every Supabase-backed repository returns.
 *
 * Promoted out of `features/deck/state/deckRepository.ts` when the profile
 * repository landed: two features that both talk to Supabase should agree on a
 * result contract without importing each other.
 *
 * `data` is null on ANY failure and on an empty read. Callers that need to tell
 * those apart check `error`, which is null only on success.
 */
export interface RepoResult<T> {
  data: T | null;
  error: string | null;
}

/** Returned by every repository call when `getSupabase()` is null. */
export const NOT_CONFIGURED = 'Supabase not configured';
