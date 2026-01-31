import { useState } from "react";
import type { LorcanaCard } from "../../cards";
import type { DeckSuggestion } from "../hooks";
import { INK_COLORS, COLORS, FONT_SIZES, RADIUS, SPACING } from "../../../shared/constants";
import { CollapsibleSection } from "../../../shared/components";
import { useCardPreviewHandlers } from "../../cards";

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
    <CollapsibleSection title="Suggestions" collapsed={collapsed} onToggle={onToggleCollapse}>
      <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.sm}px` }}>
        {suggestions.slice(0, 8).map((suggestion) => (
          <SuggestionRow key={suggestion.card.id} suggestion={suggestion} onAddCard={onAddCard} />
        ))}
      </div>
    </CollapsibleSection>
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
  const { previewHandlers } = useCardPreviewHandlers({ card });

  return (
    <div
      {...previewHandlers}
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
