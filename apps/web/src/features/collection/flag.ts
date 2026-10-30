/**
 * Collection mode's feature flag (#553 Phase C), read once at module load like
 * every other `VITE_*` flag. Off in production until the surface is ready
 * (`.env.example`), per the sequential flag-gated PR model (#474).
 *
 * Off means NOT LOADED, not merely hidden: the providers do not mount and the
 * collection UI's lazy chunks are never requested, so the flag also keeps the
 * feature out of the user-facing bundle budget. A build with it off fails when a
 * page can load collection code (`collectionCodeGuard` in `apps/web/build-guards.ts`),
 * so keep this a comparison the bundler can fold: one it can't would keep every
 * branch behind the flag.
 *
 * IT REQUIRES THE ACCOUNTS FLAG. Pressing "Collection" while signed out opens the
 * sign-in dialog (`collectionAction`; the sign-in gate is kept, owner 2026-10-07),
 * so collection on with accounts off would put a sign-in entry point in front of
 * everyone, which is exactly what `VITE_SHOW_ACCOUNTS=false` exists to hide.
 * Accounts can ship before collection; collection can never ship before accounts.
 */
export const SHOW_COLLECTION =
  import.meta.env.VITE_SHOW_COLLECTION === 'true' && import.meta.env.VITE_SHOW_ACCOUNTS === 'true';
