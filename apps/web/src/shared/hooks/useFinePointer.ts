import {useSyncExternalStore} from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';

function canHover(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/**
 * Whether the screen's main pointer is a mouse or a trackpad, which can hover: the printings'
 * peek waits for it near the card's side there, and shows at rest where touch is the way in.
 * A tablet in the desktop layout is touch, so this, not the layout, decides.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, canHover, () => false);
}
