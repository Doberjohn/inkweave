import {useEffect, useRef, type RefObject} from 'react';

interface UseDialogFocusParams {
  isOpen: boolean;
  /** Container ref used for focus trapping */
  containerRef: RefObject<HTMLElement | null>;
  /** Element to focus when the dialog opens */
  initialFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Manages focus for modal/drawer dialogs:
 * - Saves and restores the previously focused element
 * - Moves focus to `initialFocusRef` when the dialog opens
 * - Closes on Escape key
 * - Returns a `handleKeyDown` for focus trapping on Tab/Shift+Tab
 */
export function useDialogFocus({
  isOpen,
  containerRef,
  initialFocusRef,
  onClose,
}: UseDialogFocusParams) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Save previous focus, set initial focus, restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      const timerId = setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 100);
      return () => {
        clearTimeout(timerId);
        const prev = previousActiveElement.current;
        if (prev && prev.isConnected) {
          prev.focus();
        }
      };
    }
  }, [isOpen, initialFocusRef]);

  // Escape key listener (separate effect to avoid spurious focus restore)
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Focus trap: keep Tab/Shift+Tab within the container
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !containerRef.current) return;

    const focusableElements =
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  return {handleKeyDown};
}
