import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "../Header";

describe("Header", () => {
  const defaultProps = {
    totalCards: 500,
    isLoading: false,
    gameMode: "infinity" as const,
    onGameModeChange: vi.fn(),
  };

  it("should render the app title", () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /lorcana synergy finder/i })).toBeInTheDocument();
  });

  it("should show loading state", () => {
    render(<Header {...defaultProps} isLoading={true} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should show card count when loaded", () => {
    render(<Header {...defaultProps} totalCards={1234} isLoading={false} />);

    expect(screen.getByText(/1234 cards loaded/i)).toBeInTheDocument();
  });

  it("should mark correct button as active based on gameMode", () => {
    const { rerender } = render(<Header {...defaultProps} gameMode="infinity" />);

    expect(screen.getByRole("button", { name: /infinity/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /core/i })).toHaveAttribute("aria-pressed", "false");

    rerender(<Header {...defaultProps} gameMode="core" />);

    expect(screen.getByRole("button", { name: /infinity/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: /core/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("should call onGameModeChange when clicking buttons", () => {
    const onGameModeChange = vi.fn();
    render(<Header {...defaultProps} onGameModeChange={onGameModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: /infinity/i }));
    expect(onGameModeChange).toHaveBeenCalledWith("infinity");

    fireEvent.click(screen.getByRole("button", { name: /core/i }));
    expect(onGameModeChange).toHaveBeenCalledWith("core");
  });

  it("should have game mode group with accessible label", () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByRole("group", { name: /game mode/i })).toBeInTheDocument();
  });
});
