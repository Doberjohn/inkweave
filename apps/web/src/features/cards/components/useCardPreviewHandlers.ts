import {useCallback, useMemo} from 'react';
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

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (isSyntheticMouseEvent()) return;
      showPreview(card, e.clientX, e.clientY);
    },
    [card, showPreview],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isSyntheticMouseEvent()) return;
      updatePosition(e.clientX, e.clientY);
    },
    [updatePosition],
  );

  const handleMouseLeave = useCallback(() => {
    hidePreview();
  }, [hidePreview]);

  // Keyboard focus support for accessibility
  const handleFocus = useCallback(
    (e: React.FocusEvent) => {
      if (isSyntheticMouseEvent()) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        showPreview(card, rect.x + rect.width / 2, rect.y);
      }
    },
    [card, showPreview],
  );

  const handleBlur = useCallback(() => {
    hidePreview();
  }, [hidePreview]);

  // Touch support for mobile
  const {touchHandlers} = useTouchPreview({
    onLongPress: () => {
      showPreview(card, 0, 0, true); // isTouchMode = true, position ignored for centered modal
    },
    onTap,
    onTouchEnd: hidePreview,
  });

  // Combined handlers for easy spreading onto elements
  const previewHandlers = useMemo(
    () => ({
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      ...touchHandlers,
    }),
    [handleMouseEnter, handleMouseMove, handleMouseLeave, handleFocus, handleBlur, touchHandlers],
  );

  return {
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    touchHandlers,
    previewHandlers,
    hidePreview,
  };
}
