import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render with default message", () => {
    render(<LoadingSpinner />);

    expect(screen.getByText(/loading cards from lorcanajson/i)).toBeInTheDocument();
  });

  it("should render with custom message", () => {
    render(<LoadingSpinner message="Please wait..." />);

    expect(screen.getByText("Please wait...")).toBeInTheDocument();
  });
});
