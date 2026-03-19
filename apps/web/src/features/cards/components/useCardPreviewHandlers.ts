import {useCardPreview} from './useCardPreview';
import {useTouchPreview} from '../../../shared/hooks';
import {isSyntheticMouseEvent} from '../../../shared/utils/touchGuard';
import type {LorcanaCard} from '../types';

interface UseCardPreviewHandlersOptions {
  card: LorcanaCard;
  onTap?: () => void;
}

/**
 * Reusable hook for card preview hover, touch, and keyboard focus handlers.
 * Consolidates the repeated mouse enter/move/leave and focus/blur pattern
 * used across components.
 */
export function useCardPreviewHandlers({card, onTap}: UseCardPreviewHandlersOptions) {
  const {showPreview, updatePosition, hidePreview} = useCardPreview();

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (isSyntheticMouseEvent()) return;
    showPreview(card, e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSyntheticMouseEvent()) return;
    updatePosition(e.clientX, e.clientY);
  };

  // Keyboard focus support for accessibility
  const handleFocus = (e: React.FocusEvent) => {
    if (isSyntheticMouseEvent()) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      showPreview(card, rect.x + rect.width / 2, rect.y);
    }
  };

  // Touch support for mobile
  const {touchHandlers} = useTouchPreview({
    onLongPress: () => {
      showPreview(card, 0, 0, true); // isTouchMode = true, position ignored for centered modal
    },
    onTap,
    onTouchEnd: hidePreview,
  });

  // Combined handlers for easy spreading onto elements
  const previewHandlers = {
    onMouseEnter: handleMouseEnter,
    onMouseMove: handleMouseMove,
    onMouseLeave: hidePreview,
    onFocus: handleFocus,
    onBlur: hidePreview,
    ...touchHandlers,
  };

  return {
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave: hidePreview,
    touchHandlers,
    previewHandlers,
    hidePreview,
  };
}
