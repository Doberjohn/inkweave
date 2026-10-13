import {useEffect, type RefObject} from 'react';

interface UseDialogFocusParams {
  isOpen: boolean;
  /** Container ref used for focus trapping */
  containerRef: RefObject<HTMLElement | null>;
  /** Element to focus when the dialog opens */
  initialFocusRef: RefObject<HTMLElement | null>;
  /**
   * Element to return focus to on close, instead of the one focused at open.
   * For dialogs whose opener moves focus first (SearchBottomSheet's hidden iOS
   * keyboard proxy). Read when the dialog opens; if empty, focus is left where it is.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The dialog's initial focus, applied on a delay so the open transition has started.
 *
 * Skips when the user already reached something inside. 100ms is long enough to lose
 * that race: a click or a key lands first, and focus was then yanked to the close
 * button. DialogShell's `useFocusRetry` has guarded the same thing since #625; this
 * one-shot never did, which made CardOverviewModal's arrow-key test flaky under load
 * and is a real bug for anyone reaching a control within 100ms of opening.
 *
 * Extracted rather than inlined: the hook sits at CodeScene's complexity threshold,
 * and the guard's two branches tipped it over.
 */
function takeInitialFocus(container: HTMLElement | null, target: HTMLElement | null): void {
  if (container?.contains(document.activeElement)) return;
  target?.focus();
}

/**
 * Whether focus sits inside the dialog on something the trap doesn't count as a control:
 * the container itself (DialogShell's panel, its initial focus when no `initialFocusRef` is
 * passed) or another `tabIndex={-1}` element, such as a message given initial focus.
 */
function isFocusOffControls(container: HTMLElement, focusableElements: Element[]): boolean {
  const active = document.activeElement;
  return active !== null && container.contains(active) && !focusableElements.includes(active);
}

/**
 * The Tab trap: Tab from the last control wraps to the first, and Shift+Tab from the first
 * wraps to the last. Focus off the controls counts as "before the first control" (#732): the
 * browser would move Shift+Tab from there to whatever precedes the portal, outside the modal.
 *
 * Extracted for the same reason as `takeInitialFocus`, Tab check included: CodeScene counts
 * a one-line handler's branches into the hook.
 */
function trapTab(e: React.KeyboardEvent, container: HTMLElement | null): void {
  if (e.key !== 'Tab' || !container) return;

  const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

  if (focusableElements.length === 0) {
    e.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  // Tab leaves from the last control and wraps to the first; Shift+Tab, the reverse.
  const [edge, wrapTo] = e.shiftKey ? [firstElement, lastElement] : [lastElement, firstElement];

  if (document.activeElement === edge || isFocusOffControls(container, focusableElements)) {
    e.preventDefault();
    wrapTo.focus();
  }
}

/**
 * Manages focus for modal/drawer dialogs:
 * - Saves and restores the previously focused element (or `returnFocusRef`)
 * - Moves focus to `initialFocusRef` when the dialog opens
 * - Closes on Escape key
 * - Returns a `handleKeyDown` for focus trapping on Tab/Shift+Tab
 */
export function useDialogFocus({
  isOpen,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  onClose,
}: UseDialogFocusParams) {
  // Save the return target, set initial focus, restore on close
  useEffect(() => {
    if (isOpen) {
      // A given return target never falls back to the focused element: for the
      // search sheet that is the hidden proxy.
      const returnTarget = returnFocusRef
        ? returnFocusRef.current
        : (document.activeElement as HTMLElement | null);
      const timerId = setTimeout(
        () => takeInitialFocus(containerRef.current, initialFocusRef.current),
        100,
      );
      return () => {
        clearTimeout(timerId);
        if (returnTarget && returnTarget.isConnected) {
          returnTarget.focus();
        }
      };
    }
  }, [isOpen, containerRef, initialFocusRef, returnFocusRef]);

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
  const handleKeyDown = (e: React.KeyboardEvent) => trapTab(e, containerRef.current);

  return {handleKeyDown};
}
