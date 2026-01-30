import { useState, useCallback } from "react";
import type { LorcanaCard } from "../../cards/types";
import { INK_COLORS, COLORS, FONT_SIZES, RADIUS, SPACING } from "../../../shared/constants/theme";
import { useCardPreview } from "../../cards";

interface DeckCardRowProps {
  card: LorcanaCard;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemoveAll: () => void;
}

export function DeckCardRow({
  card,
  quantity,
  onIncrement,
  onDecrement,
  onRemoveAll,
}: DeckCardRowProps) {
  const colors = INK_COLORS[card.ink];
  const [imgError, setImgError] = useState(false);
  const { showPreview, updatePosition, hidePreview } = useCardPreview();

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      showPreview(card, e.clientX, e.clientY);
    },
    [card, showPreview]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    },
    [updatePosition]
  );

  const handleMouseLeave = useCallback(() => {
    hidePreview();
  }, [hidePreview]);

  const totalCost = card.cost * quantity;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: "flex",
        alignItems: "center",
        gap: `${SPACING.md}px`,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        borderRadius: `${RADIUS.lg}px`,
        background: COLORS.white,
        border: `1px solid ${colors.border}30`,
      }}
    >
      {/* Card thumbnail */}
      {card.imageUrl && !imgError ? (
        <img
          src={card.imageUrl}
          alt=""
          onError={() => setImgError(true)}
          style={{
            width: 40,
            height: 56,
            borderRadius: `${RADIUS.sm}px`,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 56,
            borderRadius: `${RADIUS.sm}px`,
            background: colors.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: `${FONT_SIZES.lg}px`, fontWeight: 600, color: colors.text }}>
            {card.cost}
          </span>
        </div>
      )}

      {/* Card info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.gray800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.name}
        </div>
        {card.version && (
          <div
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.gray500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {card.version}
          </div>
        )}
      </div>

      {/* Quantity controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: `${SPACING.sm}px`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDecrement();
          }}
          aria-label={`Remove one copy of ${card.name}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.gray300}`,
            background: COLORS.white,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${FONT_SIZES.lg}px`,
            color: COLORS.gray600,
          }}
          title="Remove one"
        >
          -
        </button>

        <span
          style={{
            fontSize: `${FONT_SIZES.lg}px`,
            fontWeight: 600,
            color: COLORS.gray800,
            minWidth: 20,
            textAlign: "center",
          }}
        >
          {quantity}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onIncrement();
          }}
          disabled={quantity >= 4}
          aria-label={quantity >= 4 ? `Maximum 4 copies of ${card.name}` : `Add one copy of ${card.name}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${quantity >= 4 ? COLORS.gray200 : COLORS.gray300}`,
            background: COLORS.white,
            cursor: quantity >= 4 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${FONT_SIZES.lg}px`,
            color: quantity >= 4 ? COLORS.gray400 : COLORS.gray600,
          }}
          title={quantity >= 4 ? "Maximum 4 copies" : "Add one"}
        >
          +
        </button>
      </div>

      {/* Cost badge */}
      <div
        style={{
          background: colors.bg,
          color: colors.text,
          padding: `4px ${SPACING.sm}px`,
          borderRadius: `${RADIUS.md}px`,
          fontSize: `${FONT_SIZES.sm}px`,
          fontWeight: 600,
          flexShrink: 0,
          minWidth: 28,
          textAlign: "center",
        }}
        title={`${card.cost} ink x ${quantity} = ${totalCost} total`}
      >
        {card.cost}
      </div>

      {/* Remove all button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemoveAll();
        }}
        aria-label={`Remove all copies of ${card.name} from deck`}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "none",
          background: COLORS.gray100,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${FONT_SIZES.base}px`,
          color: COLORS.gray500,
          flexShrink: 0,
        }}
        title="Remove all copies"
      >
        ×
      </button>
    </div>
  );
}
