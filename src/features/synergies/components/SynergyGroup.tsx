import { useState } from "react";
import type { LorcanaCard } from "../../cards";
import type { GroupedSynergies } from "../types";
import { SynergyCard } from "./SynergyCard";
import { COLORS, FONT_SIZES, SPACING } from "../../../shared/constants";

interface SynergyGroupProps {
  group: GroupedSynergies;
  defaultExpanded?: boolean;
  onAddToDeck?: (card: LorcanaCard) => void;
  getCardQuantity?: (cardId: string) => number;
}

export function SynergyGroup({ group, defaultExpanded = true, onAddToDeck, getCardQuantity }: SynergyGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{ marginBottom: `${SPACING.xl}px` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
          color: COLORS.gray700,
          marginBottom: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 0.2s",
          }}
        >
          &#9654;
        </span>
        {group.label} ({group.synergies.length})
      </button>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {group.synergies.map((synergy) => (
            <SynergyCard
              key={synergy.card.id}
              card={synergy.card}
              strength={synergy.strength}
              explanation={synergy.explanation}
              onAddToDeck={onAddToDeck}
              deckQuantity={getCardQuantity?.(synergy.card.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
