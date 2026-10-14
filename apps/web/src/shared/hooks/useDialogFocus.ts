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
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * The stops Tab reaches inside the dialog, in DOM order: the selector's matches minus any with a
 * negative tabIndex. A roving grid keeps its inactive items in the DOM at -1, as SynergyGroup's
 * tiles do in the card overview modal. Counted as controls, they made the trap's edges tiles Tab
 * never reaches, so Tab from the grid's active tile left the dialog.
 */
function tabStops(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.tabIndex >= 0,
  );
}

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
 * Whether focus sits inside the dialog on something that isn't one of the trap's stops: the
 * container itself (DialogShell's panel, its initial focus when no `initialFocusRef` is passed),
 * another `tabIndex={-1}` element, such as a message given initial focus, or a scroll container
 * the browser lets Tab reach, such as CardOverviewModal's printing strip.
 */
function isFocusOffControls(container: HTMLElement, focusableElements: Element[]): boolean {
  const active = document.activeElement;
  return active !== null && container.contains(active) && !focusableElements.includes(active);
}

/** The nearest stop past `from` in DOM order: the next one, or with `back` the previous one. */
function nearestStop(stops: HTMLElement[], from: Element, back: boolean): HTMLElement | undefined {
  const side = back ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
  const ahead = stops.filter((stop) => from.compareDocumentPosition(stop) & side);
  return back ? ahead[ahead.length - 1] : ahead[0];
}

/**
 * Where the trap sends Tab, or Shift+Tab with `back`; undefined leaves the key to the browser.
 * With no stop left that way, focus wraps to the far end. Focus off the stops moves to the
 * nearest stop that way. The browser can't be left to it: from the panel or a message,
 * Shift+Tab lands outside the modal (#732). Nor can focus off the stops always wrap: Chrome and
 * Firefox let Tab reach a scroll container with nothing focusable inside, such as the card
 * overview modal's printing strip, and wrapping from there kept Tab off the synergy tiles below.
 */
function trapTarget(container: HTMLElement, stops: HTMLElement[], back: boolean): HTMLElement | undefined {
  const next = nearestStop(stops, document.activeElement ?? container, back);
  if (!next) return back ? stops[stops.length - 1] : stops[0];
  return isFocusOffControls(container, stops) ? next : undefined;
}

/**
 * The Tab trap: Tab from the last stop wraps to the first, and Shift+Tab from the first wraps
 * to the last (see `trapTarget`).
 *
 * Extracted for the same reason as `takeInitialFocus`, Tab check included: CodeScene counts
 * a one-line handler's branches into the hook.
 */
function trapTab(e: React.KeyboardEvent, container: HTMLElement | null): void {
  if (e.key !== 'Tab' || !container) return;

  const stops = tabStops(container);

  if (stops.length === 0) {
    e.preventDefault();
    return;
  }

  const target = trapTarget(container, stops, e.shiftKey);
  if (target) {
    e.preventDefault();
    target.focus();
  }
}

/**
 * Manages focus for modal/drawer dialogs:
 * - Saves and restores the previously focused element (or `returnFocusRef`)
 * - Moves focus to `initialFocusRef` when the dialog opens
 * - Closes on Escape key
 * - Returns a `handleKeyDown` for focus trapping on Tab/Shift+Tab
 *
 * Both effects return early while closed. Wrapping their bodies in `if (isOpen) {…}` put a
 * conditional inside a conditional twice, and CodeScene's Bumpy Road check fails a function
 * at two such blocks.
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
    if (!isOpen) return;
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
  }, [isOpen, containerRef, initialFocusRef, returnFocusRef]);

  // Escape key listener (separate effect to avoid spurious focus restore)
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap: keep Tab/Shift+Tab within the container
  const handleKeyDown = (e: React.KeyboardEvent) => trapTab(e, containerRef.current);

  return {handleKeyDown};
}
