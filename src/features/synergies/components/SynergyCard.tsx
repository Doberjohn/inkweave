import { useCallback } from "react";
import type { LorcanaCard } from "../../cards";
import type { SynergyStrength } from "../types";
import { INK_COLORS, STRENGTH_STYLES, COLORS, FONT_SIZES, RADIUS, LAYOUT } from "../../../shared/constants";
import { CardImage } from "../../../shared/components";
import { useCardPreview } from "../../cards";
import { useTouchPreview } from "../../../shared/hooks";

interface SynergyCardProps {
  card: LorcanaCard;
  strength: SynergyStrength;
  explanation: string;
  onAddToDeck?: (card: LorcanaCard) => void;
  deckQuantity?: number;
}

export function SynergyCard({ card, strength, explanation, onAddToDeck, deckQuantity = 0 }: SynergyCardProps) {
  const colors = INK_COLORS[card.ink];
  const strengthStyle = STRENGTH_STYLES[strength];
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

  // Touch support for mobile
  const { touchHandlers } = useTouchPreview({
    onLongPress: () => {
      showPreview(card, 0, 0, true); // isTouchMode = true
    },
    onTouchEnd: hidePreview,
  });

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...touchHandlers}
      style={{
        display: "flex",
        gap: "12px",
        padding: "12px",
        borderRadius: `${RADIUS.lg}px`,
        border: `1px solid ${colors.border}40`,
        background: COLORS.white,
      }}
    >
      <CardImage
        src={card.imageUrl}
        alt=""
        width={LAYOUT.synergyCardImageWidth}
        height={LAYOUT.synergyCardImageHeight}
        inkColor={card.ink}
        cost={card.cost}
        lazy={true}
        borderRadius={RADIUS.sm}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: `${FONT_SIZES.lg}px`,
                color: COLORS.gray800,
                display: "block",
              }}
            >
              {card.name}
            </span>
            {card.version && (
              <span style={{ fontSize: `${FONT_SIZES.md}px`, color: COLORS.gray500 }}>
                {card.version}
              </span>
            )}
          </div>
          <span
            style={{
              background: strengthStyle.bg,
              color: strengthStyle.text,
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: `${FONT_SIZES.sm}px`,
              fontWeight: 500,
              textTransform: "capitalize",
              flexShrink: 0,
            }}
          >
            {strength}
          </span>
        </div>
        <p
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.gray600,
            marginTop: "6px",
            lineHeight: 1.4,
          }}
        >
          {explanation}
        </p>
        <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              background: colors.bg,
              color: colors.text,
              padding: "2px 6px",
              borderRadius: `${RADIUS.sm}px`,
            }}
          >
            {card.ink}
          </span>
          <span
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              background: COLORS.gray100,
              color: COLORS.gray700,
              padding: "2px 6px",
              borderRadius: `${RADIUS.sm}px`,
            }}
          >
            Cost {card.cost}
          </span>
        </div>
      </div>

      {/* Add to deck button */}
      {onAddToDeck && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToDeck(card);
          }}
          disabled={deckQuantity >= 4}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: deckQuantity >= 4 ? COLORS.gray200 : COLORS.primary500,
            color: deckQuantity >= 4 ? COLORS.gray400 : COLORS.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            cursor: deckQuantity >= 4 ? "not-allowed" : "pointer",
            flexShrink: 0,
            alignSelf: "center",
          }}
          title={deckQuantity >= 4 ? "Maximum 4 copies" : "Add to deck"}
        >
          {deckQuantity > 0 ? deckQuantity : "+"}
        </button>
      )}
    </div>
  );
}
