import {useSyncExternalStore} from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * One-shot reduced-motion read (#511: replaces five hand-rolled copies).
 * Use at animation-trigger time (FLIP setup, boop, sparkle spawn); for
 * render-time gating of inline `animation` styles use the hook below, which
 * also tracks live preference changes.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** Reactive reduced-motion flag for gating inline animation styles at render time. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
