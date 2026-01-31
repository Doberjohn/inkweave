import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResponsive } from "..";
import { BREAKPOINTS } from "../../constants";

describe("useResponsive", () => {
  const originalInnerWidth = window.innerWidth;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Reset window properties before each test
    vi.stubGlobal("innerWidth", BREAKPOINTS.desktop);
  });

  afterEach(() => {
    vi.stubGlobal("innerWidth", originalInnerWidth);
    vi.stubGlobal("matchMedia", originalMatchMedia);
    vi.restoreAllMocks();
  });

  it("should detect desktop viewport", () => {
    vi.stubGlobal("innerWidth", BREAKPOINTS.desktop + 100);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(false);
  });

  it("should detect tablet viewport", () => {
    vi.stubGlobal("innerWidth", BREAKPOINTS.tablet + 100);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
  });

  it("should detect mobile viewport", () => {
    vi.stubGlobal("innerWidth", BREAKPOINTS.mobile - 1);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(true);
  });

  it("should return current window width", () => {
    const testWidth = 800;
    vi.stubGlobal("innerWidth", testWidth);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.windowWidth).toBe(testWidth);
  });

  it("should update on window resize", () => {
    vi.stubGlobal("innerWidth", BREAKPOINTS.desktop + 100);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(true);

    // Simulate resize to mobile
    act(() => {
      vi.stubGlobal("innerWidth", BREAKPOINTS.mobile - 1);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it("should detect touch device", () => {
    // Mock touch support
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: 1,
      writable: true,
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isTouchDevice).toBe(true);
  });

  it("should clean up resize listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useResponsive());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
