import {lazy, type ComponentType} from 'react';
import {reloadForStaleChunk} from './staleChunkReload';

/**
 * How long a page waiting on its own reload keeps its loading state up. The reload replaces the
 * page well inside this; a page still here after it gives up with PageLoadError.
 */
export const RELOAD_GRACE_MS = 10_000;

/**
 * A page whose code could not be downloaded, even on a page that already reloaded onto the
 * current deploy. ErrorBoundary offers a reload for it: rendering again can't help, because
 * React keeps a lazy component's failed import.
 */
export class PageLoadError extends Error {
  constructor(cause: unknown) {
    super("This page couldn't load", {cause});
    this.name = 'PageLoadError';
  }
}

/**
 * `React.lazy` for a named export, retrying a failed chunk import before giving up.
 *
 * A tab left open across a deploy asks for chunk hashes that no longer exist (iOS home-screen
 * caches do the same). Once `retries` attempts fail, it reloads the page through
 * reloadForStaleChunk (loop-guarded) so the fresh index.html points at current chunks, and keeps
 * the Suspense fallback up until the reload lands, so the visitor never sees an error. When the
 * guard refuses, this is the reloaded page failing again, and it throws PageLoadError.
 */
// ComponentType<any> is React.lazy's own constraint; `never` fails on class components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<K extends string, M extends Record<K, ComponentType<any>>>(
  importFn: () => Promise<M>,
  exportName: K,
  retries = 2,
) {
  return lazy(() => {
    const load = (attempt: number): Promise<{default: M[K]}> =>
      importFn()
        .then((m) => ({default: namedExport(m, exportName)}))
        .catch((err: unknown) => (attempt < retries ? load(attempt + 1) : giveUp(err)));
    return load(0);
  });
}

/**
 * The export, or a throw when the import resolved empty. That is how a failed chunk arrives in
 * production builds: main.tsx cancels Vite's preload error to reload instead, and Vite then
 * resolves the import to undefined rather than rejecting.
 */
function namedExport<K extends string, M extends Record<K, unknown>>(
  module: M | undefined,
  name: K,
): M[K] {
  if (!module) throw new Error(`The import of ${name} resolved empty`);
  return module[name];
}

/** Every attempt failed: wait for the page to go when it is reloading, else fail at once. */
function giveUp(cause: unknown): Promise<never> {
  const error = new PageLoadError(cause);
  if (!reloadForStaleChunk()) return Promise.reject(error);
  return new Promise((_, reject) => setTimeout(() => reject(error), RELOAD_GRACE_MS));
}
