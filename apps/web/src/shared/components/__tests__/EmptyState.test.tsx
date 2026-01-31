import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("should render title", () => {
    render(<EmptyState title="No results found" />);

    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("should render subtitle when provided", () => {
    render(<EmptyState title="No results" subtitle="Try a different search" />);

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("Try a different search")).toBeInTheDocument();
  });

  it("should not render subtitle when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);

    // Only one paragraph should be rendered (the title)
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
  });

  it("should render custom icon when provided", () => {
    render(<EmptyState title="Custom" icon={<span data-testid="custom-icon">🔍</span>} />);

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
