/**
 * Stale-deploy recovery.
 *
 * Hash-named build chunks (e.g. `index-C4YK_2D-.css`) are replaced on every
 * deploy. A tab still running an old bundle references chunk URLs the new deploy
 * has purged, so the next lazy route load (or its CSS preload) 404s. We recover
 * by reloading the page: the browser fetches a fresh `index.html` with current
 * chunk hashes. The reload must be loop-safe — if it lands on the same broken
 * state (CDN serving a stale `index.html`, asset genuinely gone), reloading
 * again would trap the user in a refresh loop.
 */

/** sessionStorage flag marking that we already attempted a recovery reload. */
const GUARD_KEY = 'stale-chunk-reload';

/**
 * Clear the reload guard once a dynamic import has succeeded — the fresh bundle
 * is now being served, so a *later* failure is a new stale reference that should
 * be allowed to reload again. Called from `lazyWithRetry`'s success path.
 */
export function markStaleChunkRecovered(): void {
  sessionStorage.removeItem(GUARD_KEY);
}

/**
 * Reload onto the fresh deploy to recover from a stale chunk reference, guarded
 * against infinite reload loops.
 *
 * Implementation note for the guard: use `GUARD_KEY` in `sessionStorage` so we
 * trigger `window.location.reload()` only when we haven't already tried this
 * session — and set the flag *before* reloading (a reload tears down the page,
 * so anything after `reload()` won't run on this load).
 */
export function reloadForStaleChunk(): void {
  // One-shot per session: bail if we've already tried. The flag is cleared by
  // markStaleChunkRecovered() once an import succeeds, so a fresh stale
  // reference later in the same tab can still trigger another recovery.
  if (sessionStorage.getItem(GUARD_KEY)) return;
  // Set before reloading — the reload tears down the page, so this line must
  // win the race against window.location.reload().
  sessionStorage.setItem(GUARD_KEY, '1');
  window.location.reload();
}
