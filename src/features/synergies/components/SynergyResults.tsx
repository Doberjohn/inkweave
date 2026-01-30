import type { LorcanaCard } from "../../cards/types";
import type { GroupedSynergies } from "../types";
import { CardDetail } from "./CardDetail";
import { SynergyGroup } from "./SynergyGroup";
import { EmptyState } from "../../../shared/components/EmptyState";
import { COLORS, FONT_SIZES, SPACING, LAYOUT } from "../../../shared/constants/theme";

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
            <div style={{ textAlign: "center", padding: `${SPACING.xxl * 2}px`, color: COLORS.gray400 }}>
              <p>No synergies found for this card.</p>
              <p style={{ fontSize: `${FONT_SIZES.base}px`, marginTop: `${SPACING.sm}px` }}>
                Try a card with Singer, Shift, Evasive, or Bodyguard.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: `${SPACING.lg}px` }}>
                <span style={{ fontSize: `${FONT_SIZES.lg}px`, color: COLORS.gray500 }}>
                  Found{" "}
                  <strong style={{ color: COLORS.primary600 }}>{totalSynergyCount}</strong>{" "}
                  synergistic cards
                </span>
              </div>
              {synergies.map((group) => (
                <SynergyGroup
                  key={group.type}
                  group={group}
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
