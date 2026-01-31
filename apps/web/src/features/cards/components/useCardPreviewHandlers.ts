import { useCallback, useMemo } from "react";
import { useCardPreview } from "./useCardPreview";
import { useTouchPreview } from "../../../shared/hooks";
import type { LorcanaCard } from "../types";

interface UseCardPreviewHandlersOptions {
  card: LorcanaCard;
  onTap?: () => void;
}

/**
 * Reusable hook for card preview hover/touch handlers.
 * Consolidates the repeated mouse enter/move/leave pattern used across components.
 */
export function useCardPreviewHandlers({ card, onTap }: UseCardPreviewHandlersOptions) {
  const { showPreview, updatePosition, hidePreview } = useCardPreview();

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      showPreview(card, e.clientX, e.clientY);
    },
    [card, showPreview]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    },
    [updatePosition]
  );

  const handleMouseLeave = useCallback(() => {
    hidePreview();
  }, [hidePreview]);

  // Touch support for mobile
  const { touchHandlers } = useTouchPreview({
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
      ...touchHandlers,
    }),
    [handleMouseEnter, handleMouseMove, handleMouseLeave, touchHandlers]
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
