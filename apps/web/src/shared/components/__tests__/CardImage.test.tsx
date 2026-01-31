import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CardImage } from "../CardImage";

describe("CardImage", () => {
  const defaultProps = {
    src: "https://example.com/card.jpg",
    alt: "Test card",
    width: 60,
    height: 84,
    inkColor: "Amber" as const,
    cost: 3,
  };

  it("should render image when src is provided", () => {
    render(<CardImage {...defaultProps} />);

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", defaultProps.src);
    expect(img).toHaveAttribute("alt", defaultProps.alt);
  });

  it("should use lazy loading by default", () => {
    render(<CardImage {...defaultProps} />);

    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });

  it("should not use lazy loading when lazy=false", () => {
    render(<CardImage {...defaultProps} lazy={false} />);

    expect(screen.getByRole("img")).not.toHaveAttribute("loading");
  });

  it("should render fallback when no src provided", () => {
    render(<CardImage {...defaultProps} src={undefined} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should render fallback on image error", () => {
    render(<CardImage {...defaultProps} />);

    const img = screen.getByRole("img");
    fireEvent.error(img);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should apply custom border radius", () => {
    render(<CardImage {...defaultProps} borderRadius={12} />);

    const img = screen.getByRole("img");
    expect(img).toHaveStyle({ borderRadius: "12px" });
  });
});
