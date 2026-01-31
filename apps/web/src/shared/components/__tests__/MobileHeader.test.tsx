import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileHeader } from "../MobileHeader";

describe("MobileHeader", () => {
  const defaultProps = {
    gameMode: "infinity" as const,
    onGameModeChange: vi.fn(),
  };

  it("should render the app title", () => {
    render(<MobileHeader {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /lorcana synergy/i })).toBeInTheDocument();
  });

  it("should mark correct button as active based on gameMode", () => {
    // Test infinity mode
    const { rerender } = render(<MobileHeader {...defaultProps} gameMode="infinity" />);

    expect(screen.getByRole("button", { name: /infinity/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /core/i })).toHaveAttribute("aria-pressed", "false");

    // Test core mode
    rerender(<MobileHeader {...defaultProps} gameMode="core" />);

    expect(screen.getByRole("button", { name: /infinity/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: /core/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("should call onGameModeChange with correct mode when clicking buttons", () => {
    const onGameModeChange = vi.fn();
    render(<MobileHeader {...defaultProps} onGameModeChange={onGameModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: /infinity/i }));
    expect(onGameModeChange).toHaveBeenCalledWith("infinity");

    fireEvent.click(screen.getByRole("button", { name: /core/i }));
    expect(onGameModeChange).toHaveBeenCalledWith("core");
  });

  it("should have game mode group with accessible label", () => {
    render(<MobileHeader {...defaultProps} />);

    expect(screen.getByRole("group", { name: /game mode/i })).toBeInTheDocument();
  });
});
