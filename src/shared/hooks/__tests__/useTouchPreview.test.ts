import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTouchPreview } from "../useTouchPreview";

describe("useTouchPreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createTouchEvent = (clientX = 100, clientY = 100): React.TouchEvent => ({
    touches: [{ clientX, clientY }] as unknown as React.TouchList,
    preventDefault: vi.fn(),
  } as unknown as React.TouchEvent);

  it("should call onLongPress after 400ms hold", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useTouchPreview({ onLongPress }));

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent());
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("should call onTap for quick touch", () => {
    const onLongPress = vi.fn();
    const onTap = vi.fn();
    const { result } = renderHook(() => useTouchPreview({ onLongPress, onTap }));

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent());
    });

    // End touch before 400ms
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.touchHandlers.onTouchEnd(createTouchEvent());
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("should call onTouchEnd after long press completes", () => {
    const onLongPress = vi.fn();
    const onTouchEnd = vi.fn();
    const { result } = renderHook(() => useTouchPreview({ onLongPress, onTouchEnd }));

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent());
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onLongPress).toHaveBeenCalled();

    const touchEndEvent = createTouchEvent();
    act(() => {
      result.current.touchHandlers.onTouchEnd(touchEndEvent);
    });

    expect(onTouchEnd).toHaveBeenCalledTimes(1);
    expect(touchEndEvent.preventDefault).toHaveBeenCalled();
  });

  it("should cancel long press on touch move", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useTouchPreview({ onLongPress }));

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(100, 100));
    });

    // Move finger more than 10px
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.touchHandlers.onTouchMove(createTouchEvent(115, 100));
    });

    // Wait for long press duration
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("should not cancel long press for small movements", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useTouchPreview({ onLongPress }));

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent(100, 100));
    });

    // Move finger less than 10px
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.touchHandlers.onTouchMove(createTouchEvent(105, 100));
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("should cancel long press on touch cancel", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useTouchPreview({ onLongPress }));

    act(() => {
      result.current.touchHandlers.onTouchStart(createTouchEvent());
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.touchHandlers.onTouchCancel();
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
