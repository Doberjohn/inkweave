import { useState, useCallback } from "react";
import type { LorcanaCard } from "../types";
import { INK_COLORS, COLORS, FONT_SIZES, RADIUS, LAYOUT } from "../../../shared/constants/theme";
import { useCardPreview } from "./CardPreviewContext";

interface CardTileProps {
  card: LorcanaCard;
  onClick: () => void;
  isSelected: boolean;
  onAddToDeck?: (card: LorcanaCard) => void;
  deckQuantity?: number;
}

export function CardTile({ card, onClick, isSelected, onAddToDeck, deckQuantity = 0 }: CardTileProps) {
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

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-pressed={isSelected}
      style={{
        display: "flex",
        gap: "12px",
        padding: "10px",
        borderRadius: `${RADIUS.lg}px`,
        border: `2px solid ${isSelected ? colors.border : "transparent"}`,
        background: isSelected ? colors.bg : COLORS.white,
        boxShadow: isSelected
          ? `0 0 0 2px ${colors.border}40`
          : "0 1px 3px rgba(0,0,0,0.1)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s ease",
        width: "100%",
        alignItems: "center",
      }}
    >
      {card.imageUrl && !imgError ? (
        <img
          src={card.imageUrl}
          alt=""
          onError={() => setImgError(true)}
          style={{
            width: `${LAYOUT.cardTileImageWidth}px`,
            height: `${LAYOUT.cardTileImageHeight}px`,
            borderRadius: `${RADIUS.sm}px`,
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: `${LAYOUT.cardTileImageWidth}px`,
            height: `${LAYOUT.cardTileImageHeight}px`,
            borderRadius: `${RADIUS.sm}px`,
            background: colors.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${FONT_SIZES.lg}px`,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          {card.cost}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <span
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
          </span>
          <span
            style={{
              background: colors.bg,
              color: colors.text,
              padding: "2px 6px",
              borderRadius: "10px",
              fontSize: `${FONT_SIZES.sm}px`,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {card.cost}
          </span>
        </div>
        {card.version && (
          <span
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.gray500,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {card.version}
          </span>
        )}
        <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
          {card.keywords?.slice(0, 2).map((k) => (
            <span
              key={k}
              style={{
                fontSize: `${FONT_SIZES.xs}px`,
                background: COLORS.gray100,
                color: COLORS.gray700,
                padding: "1px 4px",
                borderRadius: "3px",
              }}
            >
              {k.split(" ")[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Add to deck button */}
      {onAddToDeck && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToDeck(card);
          }}
          disabled={deckQuantity >= 4}
          aria-label={deckQuantity >= 4 ? "Maximum 4 copies" : `Add ${card.name} to deck`}
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "none",
            background: deckQuantity >= 4 ? COLORS.gray200 : COLORS.primary500,
            color: deckQuantity >= 4 ? COLORS.gray400 : COLORS.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${FONT_SIZES.sm}px`,
            fontWeight: 600,
            cursor: deckQuantity >= 4 ? "not-allowed" : "pointer",
            flexShrink: 0,
            position: "relative",
          }}
          title={deckQuantity >= 4 ? "Maximum 4 copies" : "Add to deck"}
        >
          {deckQuantity > 0 ? deckQuantity : "+"}
        </button>
      )}
    </button>
  );
}
