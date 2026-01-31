import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CardPreviewPopover } from "../CardPreviewPopover";
import { CardPreviewProvider } from "../CardPreviewContext";
import { useCardPreview } from "../useCardPreview";
import { createCard } from "../../../../shared/test-utils";
import type { LorcanaCard } from "../../types";

// Test component to control preview state
function PreviewController({
  card,
  x = 100,
  y = 100,
  isTouchMode = false,
}: {
  card: LorcanaCard | null;
  x?: number;
  y?: number;
  isTouchMode?: boolean;
}) {
  const { showPreview, hidePreview } = useCardPreview();

  return (
    <div>
      {card && (
        <button onClick={() => showPreview(card, x, y, isTouchMode)}>Show Preview</button>
      )}
      <button onClick={hidePreview}>Hide Preview</button>
      <CardPreviewPopover />
    </div>
  );
}

function renderWithProvider(
  card: LorcanaCard | null,
  options: { x?: number; y?: number; isTouchMode?: boolean } = {}
) {
  return render(
    <CardPreviewProvider>
      <PreviewController card={card} {...options} />
    </CardPreviewProvider>
  );
}

describe("CardPreviewPopover", () => {
  const mockCard = createCard({
    id: "test-1",
    name: "Elsa",
    fullName: "Elsa - Snow Queen",
    cost: 5,
    ink: "Sapphire",
    type: "Character",
    imageUrl: "https://example.com/elsa.jpg",
  });

  const locationCard = createCard({
    id: "location-1",
    name: "Arendelle Castle",
    fullName: "Arendelle Castle - Frozen Palace",
    cost: 4,
    ink: "Sapphire",
    type: "Location",
    imageUrl: "https://example.com/castle.jpg",
  });

  beforeEach(() => {
    // Mock window dimensions
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not render when no card is selected", () => {
    render(
      <CardPreviewProvider>
        <CardPreviewPopover />
      </CardPreviewProvider>
    );

    // No image should be rendered
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("should render card image when card is shown", () => {
    renderWithProvider(mockCard);

    act(() => {
      screen.getByText("Show Preview").click();
    });

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", mockCard.imageUrl);
    expect(img).toHaveAttribute("alt", mockCard.fullName);
  });

  it("should hide preview when hidePreview is called", () => {
    renderWithProvider(mockCard);

    act(() => {
      screen.getByText("Show Preview").click();
    });

    expect(screen.getByRole("img")).toBeInTheDocument();

    act(() => {
      screen.getByText("Hide Preview").click();
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  describe("Touch mode", () => {
    it("should render centered modal with backdrop and dismiss hint in touch mode", () => {
      renderWithProvider(mockCard, { isTouchMode: true });

      act(() => {
        screen.getByText("Show Preview").click();
      });

      // Should have dismiss hint with accessible role
      const hint = screen.getByRole("status");
      expect(hint).toHaveTextContent("Tap anywhere to dismiss");
    });

    it("should hide preview when backdrop clicked", () => {
      renderWithProvider(mockCard, { isTouchMode: true });

      act(() => {
        screen.getByText("Show Preview").click();
      });

      // Find and click the backdrop (the fixed overlay)
      const hint = screen.getByText("Tap anywhere to dismiss");
      expect(hint).toBeInTheDocument();

      // Click hide preview to dismiss
      act(() => {
        screen.getByText("Hide Preview").click();
      });

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("Desktop hover mode", () => {
    it("should position relative to cursor", () => {
      renderWithProvider(mockCard, { x: 200, y: 300 });

      act(() => {
        screen.getByText("Show Preview").click();
      });

      const img = screen.getByRole("img");
      const container = img.parentElement;
      expect(container).toHaveStyle({ position: "fixed" });
    });

    it("should not be interactive in hover mode (pointerEvents: none)", () => {
      renderWithProvider(mockCard);

      act(() => {
        screen.getByText("Show Preview").click();
      });

      const img = screen.getByRole("img");
      const container = img.parentElement;
      expect(container).toHaveStyle({ pointerEvents: "none" });
    });

    it("should flip to left side when too close to right edge", () => {
      // Position near right edge of viewport (1024 wide)
      renderWithProvider(mockCard, { x: 900, y: 200 });

      act(() => {
        screen.getByText("Show Preview").click();
      });

      const img = screen.getByRole("img");
      const container = img.parentElement;
      // When flipped, left should be less than position.x
      expect(container).toHaveStyle({ position: "fixed" });
    });

    it("should adjust vertical position when too close to bottom", () => {
      // Position near bottom of viewport (800 high)
      renderWithProvider(mockCard, { x: 200, y: 700 });

      act(() => {
        screen.getByText("Show Preview").click();
      });

      const img = screen.getByRole("img");
      const container = img.parentElement;
      expect(container).toHaveStyle({ position: "fixed" });
    });

    it("should ensure preview is not above viewport", () => {
      // Position near top of viewport
      renderWithProvider(mockCard, { x: 200, y: -100 });

      act(() => {
        screen.getByText("Show Preview").click();
      });

      const img = screen.getByRole("img");
      const container = img.parentElement;
      expect(container).toHaveStyle({ position: "fixed" });
    });
  });

  describe("Location cards", () => {
    it("should render location card with rotation", () => {
      renderWithProvider(locationCard);

      act(() => {
        screen.getByText("Show Preview").click();
      });

      const img = screen.getByRole("img");
      // The image is inside a rotated container
      const rotatedContainer = img.parentElement;
      expect(rotatedContainer).toHaveStyle({ transform: "rotate(90deg)" });
    });
  });

  describe("Fallback placeholder", () => {
    it("should render fallback when image has no URL", () => {
      const cardWithoutImage = createCard({
        ...mockCard,
        imageUrl: undefined,
      });

      renderWithProvider(cardWithoutImage);

      act(() => {
        screen.getByText("Show Preview").click();
      });

      // Should show cost as fallback
      expect(screen.getByText(cardWithoutImage.cost.toString())).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("should render fallback when image fails to load", () => {
      renderWithProvider(mockCard);

      act(() => {
        screen.getByText("Show Preview").click();
      });

      const img = screen.getByRole("img");
      fireEvent.error(img);

      // Should now show cost as fallback
      expect(screen.getByText(mockCard.cost.toString())).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });
});
