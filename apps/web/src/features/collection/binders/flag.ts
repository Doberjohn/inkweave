/**
 * Binders' feature flag (#1074), read once at module load like every other `VITE_*` flag
 * (`.env.example`), per the flag-gated PR model (#474). Off in Production until #1075's last
 * step; on in Preview, so staging and PR previews show binders as they grow.
 *
 * Off means NOT LOADED, not merely hidden: no read goes to the binder tables, and no page can
 * load a module from this folder but this one. Code outside the folder reaches a binder module
 * only through a choice the bundler folds on `SHOW_BINDERS` (a lazy component, or a hook picked
 * at module level), never an `if` inside a render. A build with the flag off fails when a page
 * can load binder code (`binderCodeGuard` in `apps/web/build-guards.ts`), so keep this a
 * comparison the bundler can fold.
 */
export const SHOW_BINDERS = import.meta.env.VITE_SHOW_BINDERS === 'true';
