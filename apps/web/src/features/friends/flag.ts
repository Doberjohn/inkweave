/**
 * Friends' feature flag (#852), read once at module load like every other `VITE_*` flag.
 * Off in production until the owner turns it on (`.env.example`).
 *
 * Off means NOT LOADED: /account never requests the Friends section's module, so the
 * section stays out of the user-facing bundle budget too.
 *
 * IT REQUIRES THE ACCOUNTS FLAG, as collection mode does (collection/flag.ts): friends
 * need an account, so accounts can ship first, never second.
 */
export const SHOW_FRIENDS =
  import.meta.env.VITE_SHOW_FRIENDS === 'true' && import.meta.env.VITE_SHOW_ACCOUNTS === 'true';
