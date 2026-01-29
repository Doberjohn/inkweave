import { useState, useCallback } from "react";
import type { LorcanaCard } from "../types";
import type { DeckSuggestion } from "../hooks/useDeckBuilder";
import { INK_COLORS, COLORS, FONT_SIZES, RADIUS, SPACING } from "../constants/theme";
import { useCardPreview } from "./CardPreviewContext";

interface DeckSuggestionsProps {
  suggestions: DeckSuggestion[];
  onAddCard: (card: LorcanaCard) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DeckSuggestions({
  suggestions,
  onAddCard,
  collapsed = false,
  onToggleCollapse,
}: DeckSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      style={{
        background: COLORS.gray50,
        borderRadius: `${RADIUS.lg}px`,
        padding: `${SPACING.lg}px`,
        border: `1px solid ${COLORS.gray200}`,
      }}
    >
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: onToggleCollapse ? "pointer" : "default",
          padding: 0,
          marginBottom: collapsed ? 0 : `${SPACING.lg}px`,
        }}
      >
        <span
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            color: COLORS.gray700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Suggestions
        </span>
        {onToggleCollapse && (
          <span style={{ color: COLORS.gray500, fontSize: `${FONT_SIZES.base}px` }}>
            {collapsed ? "+" : "-"}
          </span>
        )}
      </button>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.sm}px` }}>
          {suggestions.slice(0, 8).map((suggestion) => (
            <SuggestionRow
              key={suggestion.card.id}
              suggestion={suggestion}
              onAddCard={onAddCard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SuggestionRowProps {
  suggestion: DeckSuggestion;
  onAddCard: (card: LorcanaCard) => void;
}

function SuggestionRow({ suggestion, onAddCard }: SuggestionRowProps) {
  const { card, synergyCount, synergizingWith } = suggestion;
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
    <div
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: "flex",
        alignItems: "center",
        gap: `${SPACING.md}px`,
        padding: `${SPACING.sm}px`,
        borderRadius: `${RADIUS.lg}px`,
        background: COLORS.white,
        border: `1px solid ${colors.border}20`,
      }}
    >
      {/* Card thumbnail */}
      {card.imageUrl && !imgError ? (
        <img
          src={card.imageUrl}
          alt=""
          onError={() => setImgError(true)}
          style={{
            width: 32,
            height: 44,
            borderRadius: `${RADIUS.sm}px`,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 44,
            borderRadius: `${RADIUS.sm}px`,
            background: colors.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: `${FONT_SIZES.sm}px`, fontWeight: 600, color: colors.text }}>
            {card.cost}
          </span>
        </div>
      )}

      {/* Card info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: `${FONT_SIZES.sm}px`,
            color: COLORS.gray800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.name}
        </div>
        <div
          style={{
            fontSize: `${FONT_SIZES.xs}px`,
            color: COLORS.gray500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={synergizingWith.join(", ")}
        >
          Synergizes with {synergyCount} cards
        </div>
      </div>

      {/* Add button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddCard(card);
        }}
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: "none",
          background: COLORS.primary500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${FONT_SIZES.base}px`,
          color: COLORS.white,
          flexShrink: 0,
        }}
        title="Add to deck"
      >
        +
      </button>
    </div>
  );
}
