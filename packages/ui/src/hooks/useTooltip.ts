import {useEffect, useId, useRef, useState, type MouseEvent} from 'react';
import {isSyntheticMouseEvent} from '../utils/touchGuard';

/** How long a tooltip stays once the pointer leaves its control or itself: time to cross the gap. */
const CLOSE_DELAY_MS = 150;

/**
 * A tooltip's open state, in the form WCAG 1.4.13 asks (owner ruling 2026-10-20, in
 * `.claude/rules/overlays.md`): it opens on hover or focus, stays while the pointer crosses onto
 * it (CLOSE_DELAY_MS of grace), and Escape hides it without moving focus or closing a dialog
 * underneath. Render the tooltip only while `open`: the control names it in `aria-describedby`
 * only then, so a hidden tooltip leaves nothing in the page, or in a prerendered one.
 *
 * Spread `triggerProps` on the control, or on a wrapper around it (React's focus and pointer
 * events bubble), and `tooltipProps` on the tooltip. Render the tooltip beside the control, never
 * inside it: a portal's events bubble through the React tree, so a click on the tooltip would
 * reach the control.
 *
 * A mouse click's focus doesn't hold the tooltip open, as in Radix's Tooltip: the pointer already
 * does, and a clicked tile would otherwise keep its tooltip over the page once the pointer moved
 * on. `disabled` keeps it closed, for a control that shows its text inline instead.
 */
export function useTooltip({disabled = false}: {disabled?: boolean} = {}) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressing = useRef(false);
  const open = !disabled && (hovered || focused);

  // In the capture phase on document, this runs before useDialogFocus's listener there, and
  // stopping the event keeps a dialog open: the first Escape hides the tooltip, the next closes
  // the dialog.
  useEffect(() => {
    if (!open) return;
    const hideOnEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      clearTimeout(closeTimer.current);
      setHovered(false);
      setFocused(false);
    };
    document.addEventListener('keydown', hideOnEscape, true);
    return () => document.removeEventListener('keydown', hideOnEscape, true);
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const stay = () => clearTimeout(closeTimer.current);
  const leave = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
  };
  const release = () => {
    pressing.current = false;
  };

  return {
    open,
    describedBy: open ? id : undefined,
    triggerProps: {
      onMouseEnter: () => {
        if (isSyntheticMouseEvent()) return; // iOS's hover after a tap, which useHover skips too
        stay();
        setHovered(true);
      },
      onMouseLeave: leave,
      // Safari doesn't focus a clicked button, so the flag clears on the pointer's release, not
      // on the focus it may never get.
      onPointerDown: () => {
        pressing.current = true;
        document.addEventListener('pointerup', release, {once: true});
      },
      onFocus: () => {
        if (!pressing.current) setFocused(true);
      },
      onBlur: () => setFocused(false),
    },
    tooltipProps: {
      id,
      role: 'tooltip' as const,
      onMouseEnter: stay,
      onMouseLeave: leave,
      // A click on the tooltip leaves focus where it was. Focus on <body> would let Tab out of a
      // dialog, which keeps Tab inside itself only while focus is in it, and the tooltip is
      // portaled out of it.
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
    },
  };
}
