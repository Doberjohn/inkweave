import {lazy, type ComponentType} from 'react';
import {reloadForStaleChunk} from './staleChunkReload';

/**
 * `React.lazy` for a named export, retrying a failed chunk import before giving up.
 *
 * A tab left open across a deploy asks for chunk hashes that no longer exist (iOS home-screen
 * caches do the same). Once `retries` attempts fail, it reloads the page through
 * reloadForStaleChunk (loop-guarded) so the fresh index.html points at current chunks.
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
        .then((m) => ({default: m[exportName]}))
        .catch((err: unknown) => {
          if (attempt < retries) return load(attempt + 1);
          // All retries exhausted. Likely stale chunks after deploy — reload to
          // fetch a new index.html with current chunk hashes (loop-guarded).
          reloadForStaleChunk();
          throw err;
        });
    return load(0);
  });
}
