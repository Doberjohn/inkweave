import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMobileView } from "..";

describe("useMobileView", () => {
  it("should default to 'cards' view", () => {
    const { result } = renderHook(() => useMobileView());

    expect(result.current.activeView).toBe("cards");
  });

  it("should accept custom initial view", () => {
    const { result } = renderHook(() => useMobileView("deck"));

    expect(result.current.activeView).toBe("deck");
  });

  it("should switch to synergies view", () => {
    const { result } = renderHook(() => useMobileView());

    act(() => {
      result.current.setActiveView("synergies");
    });

    expect(result.current.activeView).toBe("synergies");
  });

  it("should switch to deck view", () => {
    const { result } = renderHook(() => useMobileView());

    act(() => {
      result.current.setActiveView("deck");
    });

    expect(result.current.activeView).toBe("deck");
  });

  it("should switch back to cards view", () => {
    const { result } = renderHook(() => useMobileView("deck"));

    act(() => {
      result.current.setActiveView("cards");
    });

    expect(result.current.activeView).toBe("cards");
  });

  it("should maintain stable setActiveView reference", () => {
    const { result, rerender } = renderHook(() => useMobileView());

    const initialSetActiveView = result.current.setActiveView;

    rerender();

    expect(result.current.setActiveView).toBe(initialSetActiveView);
  });
});
