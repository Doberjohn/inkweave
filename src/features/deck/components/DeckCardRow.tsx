import { useCallback, useMemo } from "react";
import type { LorcanaCard } from "../../cards";
import { INK_COLORS, COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT } from "../../../shared/constants";
import { CardImage } from "../../../shared/components";
import { useCardPreview } from "../../cards";
import { useTouchPreview, useResponsive } from "../../../shared/hooks";

interface DeckCardRowProps {
  card: LorcanaCard;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemoveAll: () => void;
}

// Minimum touch target size for mobile
const TOUCH_TARGET_SIZE = 44;
const DESKTOP_BUTTON_SIZE = 28;
const DESKTOP_REMOVE_SIZE = 24;
const MOBILE_REMOVE_SIZE = 36;

export function DeckCardRow({
  card,
  quantity,
  onIncrement,
  onDecrement,
  onRemoveAll,
}: DeckCardRowProps) {
  const colors = INK_COLORS[card.ink];
  const { showPreview, updatePosition, hidePreview } = useCardPreview();
  const { isMobile } = useResponsive();

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
      showPreview(card, 0, 0, true);
    },
    onTouchEnd: hidePreview,
  });

  const totalCost = card.cost * quantity;

  // Memoize derived sizing values to avoid recalculating on every render
  const { buttonSize, removeButtonSize, buttonFontSize, removeFontSize, quantityMinWidth, rowPadding } = useMemo(
    () => ({
      buttonSize: isMobile ? TOUCH_TARGET_SIZE : DESKTOP_BUTTON_SIZE,
      removeButtonSize: isMobile ? MOBILE_REMOVE_SIZE : DESKTOP_REMOVE_SIZE,
      buttonFontSize: `${isMobile ? FONT_SIZES.xl : FONT_SIZES.lg}px`,
      removeFontSize: `${isMobile ? FONT_SIZES.xl : FONT_SIZES.base}px`,
      quantityMinWidth: isMobile ? 28 : 20,
      rowPadding: isMobile ? `${SPACING.md}px` : `${SPACING.sm}px ${SPACING.md}px`,
    }),
    [isMobile]
  );

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...touchHandlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: `${SPACING.md}px`,
        padding: rowPadding,
        borderRadius: `${RADIUS.lg}px`,
        background: COLORS.white,
        border: `1px solid ${colors.border}30`,
      }}
    >
      {/* Card thumbnail */}
      <CardImage
        src={card.imageUrl}
        alt=""
        width={LAYOUT.cardTileImageWidth}
        height={LAYOUT.cardTileImageHeight}
        inkColor={card.ink}
        cost={card.cost}
        lazy={true}
        borderRadius={RADIUS.sm}
      />

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
            width: buttonSize,
            height: buttonSize,
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.gray300}`,
            background: COLORS.white,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: buttonFontSize,
            color: COLORS.gray600,
          }}
          title="Remove one"
        >
          -
        </button>

        <span
          style={{
            fontSize: buttonFontSize,
            fontWeight: 600,
            color: COLORS.gray800,
            minWidth: quantityMinWidth,
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
            width: buttonSize,
            height: buttonSize,
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${quantity >= 4 ? COLORS.gray200 : COLORS.gray300}`,
            background: COLORS.white,
            cursor: quantity >= 4 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: buttonFontSize,
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
          width: removeButtonSize,
          height: removeButtonSize,
          borderRadius: "50%",
          border: "none",
          background: COLORS.gray100,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: removeFontSize,
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
