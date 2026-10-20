import {useSyncExternalStore} from 'react';
import {modalCardSize} from './cardOverviewModalStyles';

function subscribeToResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

const readViewportHeight = () => window.innerHeight;
const noViewport = () => Number.POSITIVE_INFINITY;

/**
 * The card's size in the modal for this screen (`modalCardSize`), kept current as the window
 * resizes: a desktop screen too short for the window shrinks every card alike.
 */
export function useModalCardSize(isMobile: boolean): {cardWidth: number; cardHeight: number} {
  const viewportHeight = useSyncExternalStore(subscribeToResize, readViewportHeight, noViewport);
  return modalCardSize(isMobile, viewportHeight);
}
