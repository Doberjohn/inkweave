import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CardPreviewProvider, CardPreviewContext } from "../CardPreviewContext";
import { useCardPreview } from "../useCardPreview";
import { useContext } from "react";
import { createCard } from "../../../../shared/test-utils";

// Test component that displays preview state
function PreviewStateDisplay() {
  const { previewState, showPreview, updatePosition, hidePreview } = useCardPreview();

  return (
    <div>
      <div data-testid="card-name">{previewState.card?.name || "none"}</div>
      <div data-testid="position-x">{previewState.position.x}</div>
      <div data-testid="position-y">{previewState.position.y}</div>
      <div data-testid="is-touch">{previewState.isTouchMode ? "touch" : "mouse"}</div>
      <button onClick={() => showPreview(createCard({ name: "Test Card" }), 100, 200)}>
        Show Preview
      </button>
      <button onClick={() => showPreview(createCard({ name: "Touch Card" }), 0, 0, true)}>
        Show Touch Preview
      </button>
      <button onClick={() => updatePosition(300, 400)}>Update Position</button>
      <button onClick={hidePreview}>Hide Preview</button>
    </div>
  );
}

// Component that tries to use context without provider
function ContextWithoutProvider() {
  const context = useContext(CardPreviewContext);
  return <div>{context ? "has context" : "no context"}</div>;
}

describe("CardPreviewContext", () => {
  it("should provide initial state with no card", () => {
    render(
      <CardPreviewProvider>
        <PreviewStateDisplay />
      </CardPreviewProvider>
    );

    expect(screen.getByTestId("card-name")).toHaveTextContent("none");
    expect(screen.getByTestId("position-x")).toHaveTextContent("0");
    expect(screen.getByTestId("position-y")).toHaveTextContent("0");
    expect(screen.getByTestId("is-touch")).toHaveTextContent("mouse");
  });

  it("should show preview with card and position", () => {
    render(
      <CardPreviewProvider>
        <PreviewStateDisplay />
      </CardPreviewProvider>
    );

    act(() => {
      screen.getByText("Show Preview").click();
    });

    expect(screen.getByTestId("card-name")).toHaveTextContent("Test Card");
    expect(screen.getByTestId("position-x")).toHaveTextContent("100");
    expect(screen.getByTestId("position-y")).toHaveTextContent("200");
    expect(screen.getByTestId("is-touch")).toHaveTextContent("mouse");
  });

  it("should show preview in touch mode", () => {
    render(
      <CardPreviewProvider>
        <PreviewStateDisplay />
      </CardPreviewProvider>
    );

    act(() => {
      screen.getByText("Show Touch Preview").click();
    });

    expect(screen.getByTestId("card-name")).toHaveTextContent("Touch Card");
    expect(screen.getByTestId("is-touch")).toHaveTextContent("touch");
  });

  it("should update position", () => {
    render(
      <CardPreviewProvider>
        <PreviewStateDisplay />
      </CardPreviewProvider>
    );

    act(() => {
      screen.getByText("Show Preview").click();
    });

    act(() => {
      screen.getByText("Update Position").click();
    });

    expect(screen.getByTestId("position-x")).toHaveTextContent("300");
    expect(screen.getByTestId("position-y")).toHaveTextContent("400");
  });

  it("should hide preview", () => {
    render(
      <CardPreviewProvider>
        <PreviewStateDisplay />
      </CardPreviewProvider>
    );

    act(() => {
      screen.getByText("Show Preview").click();
    });

    expect(screen.getByTestId("card-name")).toHaveTextContent("Test Card");

    act(() => {
      screen.getByText("Hide Preview").click();
    });

    expect(screen.getByTestId("card-name")).toHaveTextContent("none");
    expect(screen.getByTestId("position-x")).toHaveTextContent("0");
    expect(screen.getByTestId("position-y")).toHaveTextContent("0");
  });

  it("should return null context when not wrapped in provider", () => {
    render(<ContextWithoutProvider />);

    expect(screen.getByText("no context")).toBeInTheDocument();
  });
});

describe("useCardPreview", () => {
  it("should throw error when used outside provider", () => {
    // Suppress console.error for cleaner test output
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<PreviewStateDisplay />);
    }).toThrow("useCardPreview must be used within CardPreviewProvider");

    consoleSpy.mockRestore();
  });
});
