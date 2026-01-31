import { useRef, useCallback } from "react";

const LONG_PRESS_DURATION = 400; // milliseconds

interface UseTouchPreviewOptions {
  onLongPress: () => void;
  onTap?: () => void;
  onTouchEnd?: () => void;
}

interface UseTouchPreviewReturn {
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchCancel: () => void;
  };
}

export function useTouchPreview({
  onLongPress,
  onTap,
  onTouchEnd,
}: UseTouchPreviewOptions): UseTouchPreviewReturn {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const isScrollingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isLongPressRef.current = false;
      isScrollingRef.current = false;
      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };

      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress();
      }, LONG_PRESS_DURATION);
    },
    [onLongPress]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clearLongPressTimer();

      if (isLongPressRef.current) {
        // Long press was triggered, call onTouchEnd for cleanup
        onTouchEnd?.();
        e.preventDefault();
      } else if (!isScrollingRef.current) {
        // It was a tap (not a scroll or long press)
        onTap?.();
      }
      // If scrolling, do nothing - let the scroll complete naturally

      isLongPressRef.current = false;
      isScrollingRef.current = false;
      startPosRef.current = null;
    },
    [clearLongPressTimer, onTap, onTouchEnd]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current) return;

      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

      // If finger moved more than 10px, this is a scroll, not a tap
      if (deltaX > 10 || deltaY > 10) {
        clearLongPressTimer();
        isScrollingRef.current = true;
      }
    },
    [clearLongPressTimer]
  );

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    isLongPressRef.current = false;
    isScrollingRef.current = false;
    startPosRef.current = null;
  }, [clearLongPressTimer]);

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchMove: handleTouchMove,
      onTouchCancel: handleTouchCancel,
    },
  };
}
