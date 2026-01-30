import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterDrawer } from "../FilterDrawer";

describe("FilterDrawer", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    inkFilter: "all" as const,
    filters: {},
    uniqueKeywords: ["Singer", "Evasive", "Ward"],
    uniqueClassifications: ["Princess", "Hero", "Villain"],
    uniqueSets: ["1", "5", "10"],
    onInkFilterChange: vi.fn(),
    onFiltersChange: vi.fn(),
    onClearAll: vi.fn(),
  };

  it("should not render when closed", () => {
    render(<FilterDrawer {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render when open", () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should render filter title", () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /filters/i })).toBeInTheDocument();
  });

  it("should render all ink filter buttons", () => {
    render(<FilterDrawer {...defaultProps} />);

    // Two "All" buttons exist (one for Ink, one for Type)
    const allButtons = screen.getAllByRole("button", { name: /^all$/i });
    expect(allButtons.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /amber/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /amethyst/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /emerald/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ruby/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sapphire/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /steel/i })).toBeInTheDocument();
  });

  it("should render card type filter buttons", () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.getByRole("button", { name: /character/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /item/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /location/i })).toBeInTheDocument();
  });

  it("should call onInkFilterChange when clicking ink button", () => {
    const onInkFilterChange = vi.fn();
    render(<FilterDrawer {...defaultProps} onInkFilterChange={onInkFilterChange} />);

    fireEvent.click(screen.getByRole("button", { name: /amber/i }));

    expect(onInkFilterChange).toHaveBeenCalledWith("Amber");
  });

  it("should call onClose when clicking Apply button", () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("should call onClose when clicking backdrop", () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close filters/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("should close on Escape key", () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("should show Clear all button when filters are active", () => {
    render(<FilterDrawer {...defaultProps} inkFilter="Amber" />);

    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });

  it("should not show Clear all button when no filters are active", () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("should call onClearAll when clicking Clear all", () => {
    const onClearAll = vi.fn();
    render(<FilterDrawer {...defaultProps} inkFilter="Amber" onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onClearAll).toHaveBeenCalled();
  });

  it("should show active filter count in title", () => {
    render(<FilterDrawer {...defaultProps} inkFilter="Amber" filters={{ type: "Character" }} />);

    expect(screen.getByText(/filters \(2\)/i)).toBeInTheDocument();
  });

  it("should mark current ink as active", () => {
    render(<FilterDrawer {...defaultProps} inkFilter="Ruby" />);

    expect(screen.getByRole("button", { name: /ruby/i })).toHaveAttribute("aria-pressed", "true");
    // The first "All" button (Ink filter) should not be pressed when Ruby is selected
    const allButtons = screen.getAllByRole("button", { name: /^all$/i });
    expect(allButtons[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("should call onFiltersChange when selecting card type", () => {
    const onFiltersChange = vi.fn();
    render(<FilterDrawer {...defaultProps} onFiltersChange={onFiltersChange} />);

    fireEvent.click(screen.getByRole("button", { name: /character/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ type: "Character" });
  });
});
