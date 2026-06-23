/**
 * Stale-deploy recovery.
 *
 * Hash-named build chunks (e.g. `index-C4YK_2D-.css`) are replaced on every
 * deploy. A tab still running an old bundle references chunk URLs the new deploy
 * has purged, so the next lazy route load (or its CSS preload) 404s. We recover
 * by reloading the page: the browser fetches a fresh `index.html` with current
 * chunk hashes.
 *
 * The reload must be loop-safe. The old design used a one-shot flag cleared on
 * every successful import — but the reloaded page always loads `HomePage`
 * successfully, which re-armed the flag immediately, so a *different*
 * repeatedly-failing chunk could still drive an infinite reload loop (the
 * success signal was decoupled from the failure). This version is time-based:
 * we record *when* we last reloaded and refuse to reload again until a window
 * has elapsed. One stale-deploy episode costs at most one reload, no matter
 * which imports succeed in between; a genuinely new episode (a later deploy)
 * lands outside the window and is allowed to recover.
 */

/** sessionStorage key holding the timestamp (ms) of our last recovery reload. */
const GUARD_KEY = 'stale-chunk-reload-at';

/**
 * Minimum gap between recovery reloads. Long enough that a single stale-deploy
 * episode (including a slow CDN still serving a stale `index.html` for a few
 * seconds after the reload) collapses to one reload; short enough that a real
 * later deploy in a long-lived tab still auto-recovers.
 */
const RELOAD_WINDOW_MS = 30_000;

/**
 * Whether enough time has passed since our last recovery reload to attempt
 * another. A missing or unparseable timestamp means we've never reloaded (or
 * the value was tampered with), which must count as "allowed".
 */
function canReload(now: number): boolean {
  const last = Number(sessionStorage.getItem(GUARD_KEY));
  // NaN (non-numeric/tampered value) means "never reloaded" → allow. A missing
  // key parses to 0, which the window check below also treats as long-elapsed.
  return Number.isNaN(last) || now - last >= RELOAD_WINDOW_MS;
}

/**
 * Reload onto the fresh deploy to recover from a stale chunk reference, guarded
 * against infinite reload loops by a time window (see `canReload`).
 */
export function reloadForStaleChunk(): void {
  const now = Date.now();
  if (!canReload(now)) return;
  // Persist *before* reloading — the reload tears down the page, so this write
  // must win the race against window.location.reload().
  sessionStorage.setItem(GUARD_KEY, String(now));
  window.location.reload();
}
