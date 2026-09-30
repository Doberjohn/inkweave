import type {CardOverviewModal as CardOverviewModalComponent} from '../../features/synergies/components/CardOverviewModal';

/**
 * The card overview modal's chunk (#640). The modal pulls in the synergy columns, community
 * voting, Supabase and Radix, so it loads on first open instead of riding in the entry chunk
 * every page downloads. CardModalContext renders it through lazyWithRetry with this loader.
 */
let loadedModal: typeof CardOverviewModalComponent | null = null;
const onLoadListeners = new Set<() => void>();

export const loadCardOverviewModal = () =>
  import('../../features/synergies/components/CardOverviewModal').then((module) => {
    if (!loadedModal) {
      loadedModal = module.CardOverviewModal;
      for (const listener of onLoadListeners) listener();
    }
    return module;
  });

/**
 * The modal component once its chunk has arrived, else null. An open that starts after that
 * renders it directly: React.lazy would still suspend once on its first render, and that brief
 * suspension would show CardOverviewModalFallback for nothing. Read it during render only through
 * useSyncExternalStore with subscribeToCardOverviewModal: a plain call reads mutable module state,
 * which the React Compiler may memoize as if it never changed.
 */
export function getLoadedCardOverviewModal(): typeof CardOverviewModalComponent | null {
  return loadedModal;
}

/** Notifies `onLoad` when the modal's chunk arrives. Returns the unsubscribe function. */
export function subscribeToCardOverviewModal(onLoad: () => void): () => void {
  onLoadListeners.add(onLoad);
  return () => onLoadListeners.delete(onLoad);
}

/**
 * Starts downloading the modal ahead of the first open, so the click doesn't wait on the network.
 * A failed warm-up is harmless: the open itself retries.
 */
export function preloadCardOverviewModal(): void {
  loadCardOverviewModal().catch(() => {});
}

const FIRST_INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

/**
 * Warms the modal on the visitor's first interaction anywhere: a tap, click, key or scroll.
 * Phones have no hover before a tap, and the featured cards sit below the hero, so a scroll
 * usually starts the download well before the first card tap. It waits for `load`, so it never
 * competes with the page itself, and visitors who never interact never download the modal.
 * Returns a cleanup function.
 */
export function warmCardOverviewModalOnFirstInteraction(): () => void {
  const stop = () => {
    for (const type of FIRST_INTERACTION_EVENTS) window.removeEventListener(type, warm, true);
  };
  function warm() {
    stop();
    if (document.readyState === 'complete') preloadCardOverviewModal();
    else window.addEventListener('load', preloadCardOverviewModal, {once: true});
  }
  // Capture phase: scroll doesn't bubble, but a window capture listener still sees element scrolls.
  for (const type of FIRST_INTERACTION_EVENTS) {
    window.addEventListener(type, warm, {capture: true, passive: true});
  }
  return () => {
    stop();
    window.removeEventListener('load', preloadCardOverviewModal);
  };
}
