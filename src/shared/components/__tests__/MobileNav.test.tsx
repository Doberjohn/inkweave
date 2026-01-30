import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileNav } from "../MobileNav";

describe("MobileNav", () => {
  const defaultProps = {
    activeView: "cards" as const,
    onViewChange: vi.fn(),
    deckCardCount: 0,
  };

  it("should render all three navigation buttons", () => {
    render(<MobileNav {...defaultProps} />);

    expect(screen.getByRole("button", { name: /cards/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /synergies/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deck/i })).toBeInTheDocument();
  });

  it("should mark active view with aria-pressed", () => {
    render(<MobileNav {...defaultProps} activeView="cards" />);

    expect(screen.getByRole("button", { name: /cards/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /synergies/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /deck/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("should mark synergies as active when selected", () => {
    render(<MobileNav {...defaultProps} activeView="synergies" />);

    expect(screen.getByRole("button", { name: /cards/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /synergies/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("should call onViewChange with correct view when clicking cards", () => {
    const onViewChange = vi.fn();
    render(<MobileNav {...defaultProps} onViewChange={onViewChange} />);

    fireEvent.click(screen.getByRole("button", { name: /cards/i }));

    expect(onViewChange).toHaveBeenCalledWith("cards");
  });

  it("should call onViewChange with correct view when clicking synergies", () => {
    const onViewChange = vi.fn();
    render(<MobileNav {...defaultProps} onViewChange={onViewChange} />);

    fireEvent.click(screen.getByRole("button", { name: /synergies/i }));

    expect(onViewChange).toHaveBeenCalledWith("synergies");
  });

  it("should call onViewChange with correct view when clicking deck", () => {
    const onViewChange = vi.fn();
    render(<MobileNav {...defaultProps} onViewChange={onViewChange} />);

    fireEvent.click(screen.getByRole("button", { name: /deck/i }));

    expect(onViewChange).toHaveBeenCalledWith("deck");
  });

  it("should display badge when deckCardCount > 0", () => {
    render(<MobileNav {...defaultProps} deckCardCount={15} />);

    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("should not display badge when deckCardCount is 0", () => {
    render(<MobileNav {...defaultProps} deckCardCount={0} />);

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("should display 99+ for deckCardCount > 99", () => {
    render(<MobileNav {...defaultProps} deckCardCount={120} />);

    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
