import { useCardPreview } from "./CardPreviewContext";
import { INK_COLORS, RADIUS } from "../constants/theme";

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 390;
const OFFSET_X = 20;
const OFFSET_Y = 10;

export function CardPreviewPopover() {
  const { previewState } = useCardPreview();
  const { card, position } = previewState;

  if (!card) return null;

  const colors = INK_COLORS[card.ink];
  const isLocation = card.type === "Location";

  // Locations are displayed rotated (landscape)
  const containerWidth = isLocation ? PREVIEW_HEIGHT : PREVIEW_WIDTH;
  const containerHeight = isLocation ? PREVIEW_WIDTH : PREVIEW_HEIGHT;

  // Calculate position to keep popover in viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = position.x + OFFSET_X;
  let top = position.y + OFFSET_Y;

  // Flip to left side if too close to right edge
  if (left + containerWidth > viewportWidth - 20) {
    left = position.x - containerWidth - OFFSET_X;
  }

  // Adjust vertical position if too close to bottom
  if (top + containerHeight > viewportHeight - 20) {
    top = viewportHeight - containerHeight - 20;
  }

  // Ensure not above viewport
  if (top < 20) {
    top = 20;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        borderRadius: `${RADIUS.xl}px`,
        boxShadow: "0 20px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
        zIndex: 9999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {card.imageUrl ? (
        isLocation ? (
          <div
            style={{
              width: `${PREVIEW_WIDTH}px`,
              height: `${PREVIEW_HEIGHT}px`,
              transform: "rotate(90deg)",
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: `${PREVIEW_HEIGHT}px`,
            }}
          >
            <img
              src={card.imageUrl}
              alt={card.fullName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        ) : (
          <img
            src={card.imageUrl}
            alt={card.fullName}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        )
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.border}40 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "48px", fontWeight: 700, color: colors.text }}>
            {card.cost}
          </span>
        </div>
      )}
    </div>
  );
}
