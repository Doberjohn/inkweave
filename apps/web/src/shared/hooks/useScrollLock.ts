import {useEffect} from 'react';

/**
 * Lock body scroll while a modal/drawer/overlay is open.
 * Restores the previous overflow value on cleanup.
 */
export function useScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);
}
