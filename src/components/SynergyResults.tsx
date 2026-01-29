import { useState } from "react";
import type { LorcanaCard, GroupedSynergies } from "../types";
import { CardDetail } from "./CardDetail";
import { SynergyGroup } from "./SynergyGroup";
import { EmptyState } from "./EmptyState";
import { COLORS, FONT_SIZES, SPACING, LAYOUT, RADIUS } from "../constants/theme";

interface SynergyResultsProps {
  selectedCard: LorcanaCard | null;
  synergies: GroupedSynergies[];
  totalSynergyCount: number;
  onClearSelection: () => void;
  onAddToDeck?: (card: LorcanaCard) => boolean;
  getCardQuantity?: (cardId: string) => number;
}

export function SynergyResults({
  selectedCard,
  synergies,
  totalSynergyCount,
  onClearSelection,
  onAddToDeck,
  getCardQuantity,
}: SynergyResultsProps) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div
      style={{
        flex: 1,
        padding: `${SPACING.xl}px`,
        overflowY: "auto",
        maxHeight: `calc(100vh - ${LAYOUT.headerHeight}px)`,
      }}
    >
      {!selectedCard ? (
        <EmptyState
          title="Select a card to see synergies"
          subtitle='Try "Elsa" or filter by Amethyst'
        />
      ) : (
        <>
          <CardDetail card={selectedCard} onClear={onClearSelection} />

          {synergies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: COLORS.gray400 }}>
              <p>No synergies found for this card.</p>
              <p style={{ fontSize: `${FONT_SIZES.base}px`, marginTop: `${SPACING.sm}px` }}>
                Try a card with Singer, Shift, Evasive, or Bodyguard.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: `${SPACING.lg}px`,
                }}
              >
                <span style={{ fontSize: `${FONT_SIZES.lg}px`, color: COLORS.gray500 }}>
                  Found{" "}
                  <strong style={{ color: COLORS.primary600 }}>{totalSynergyCount}</strong>{" "}
                  synergistic cards
                </span>
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: `${RADIUS.md}px`,
                    border: "none",
                    background: showDebug ? COLORS.primary600 : COLORS.gray100,
                    color: showDebug ? COLORS.white : COLORS.gray600,
                    fontSize: `${FONT_SIZES.sm}px`,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {showDebug ? "Hide Debug" : "Show Debug"}
                </button>
              </div>
              {synergies.map((group) => (
                <SynergyGroup
                  key={group.type}
                  group={group}
                  showDebug={showDebug}
                  onAddToDeck={onAddToDeck}
                  getCardQuantity={getCardQuantity}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
