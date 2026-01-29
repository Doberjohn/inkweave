import { useState, useMemo, useRef } from "react";
import type { LorcanaCard, Deck, DeckStats as DeckStatsType } from "../types";
import type { DeckSuggestion, DeckSynergyAnalysis as DeckSynergyAnalysisType } from "../hooks/useDeckBuilder";
import { COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT } from "../constants/theme";
import { DeckCardRow } from "./DeckCardRow";
import { DeckStats } from "./DeckStats";
import { DeckSuggestions } from "./DeckSuggestions";
import { DeckSynergyAnalysis } from "./DeckSynergyAnalysis";
import { SavedDecksModal } from "./SavedDecksModal";

interface DeckPanelProps {
  deck: Deck;
  deckStats: DeckStatsType;
  allCards: LorcanaCard[];
  suggestions: DeckSuggestion[];
  synergyAnalysis: DeckSynergyAnalysisType;
  onAddCard: (card: LorcanaCard) => void;
  onRemoveCard: (cardId: string) => void;
  onRemoveAllCopies: (cardId: string) => void;
  onSetQuantity: (cardId: string, quantity: number) => void;
  onClearDeck: () => void;
  onRenameDeck: (name: string) => void;
  onNewDeck: () => void;
  onSaveDeck: () => void;
  onLoadDeck: (id: string) => void;
  onDeleteSavedDeck: (id: string) => void;
  getSavedDecks: () => Deck[];
  onExportDeck: () => string;
  onImportDeck: (json: string) => boolean;
}

export function DeckPanel({
  deck,
  deckStats,
  suggestions,
  synergyAnalysis,
  onAddCard,
  onRemoveCard,
  onRemoveAllCopies,
  onSetQuantity,
  onClearDeck,
  onRenameDeck,
  onNewDeck,
  onSaveDeck,
  onLoadDeck,
  onDeleteSavedDeck,
  getSavedDecks,
  onExportDeck,
  onImportDeck,
}: DeckPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(deck.name);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sort deck cards by cost, then name
  const sortedCards = useMemo(() => {
    return [...deck.cards].sort((a, b) => {
      if (a.card.cost !== b.card.cost) {
        return a.card.cost - b.card.cost;
      }
      return a.card.name.localeCompare(b.card.name);
    });
  }, [deck.cards]);

  const handleNameSubmit = () => {
    onRenameDeck(editName);
    setIsEditing(false);
  };

  const handleExport = () => {
    const json = onExportDeck();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name.replace(/[^a-z0-9]/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        const success = onImportDeck(content);
        if (!success) {
          alert("Failed to import deck. Invalid format.");
        }
      }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = "";
  };

  const handleLoadDeck = (id: string) => {
    onLoadDeck(id);
    setShowLoadModal(false);
  };

  return (
    <div
      style={{
        width: `${LAYOUT.deckPanelWidth}px`,
        background: COLORS.white,
        borderLeft: `1px solid ${COLORS.gray200}`,
        display: "flex",
        flexDirection: "column",
        height: `calc(100vh - ${LAYOUT.headerHeight}px)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${SPACING.lg}px`,
          borderBottom: `1px solid ${COLORS.gray200}`,
        }}
      >
        {/* Deck name */}
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACING.md}px`, marginBottom: `${SPACING.md}px` }}>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") {
                  setEditName(deck.name);
                  setIsEditing(false);
                }
              }}
              autoFocus
              style={{
                flex: 1,
                fontSize: `${FONT_SIZES.xl}px`,
                fontWeight: 600,
                border: `2px solid ${COLORS.primary500}`,
                borderRadius: `${RADIUS.md}px`,
                padding: `${SPACING.sm}px ${SPACING.md}px`,
                outline: "none",
              }}
            />
          ) : (
            <button
              onClick={() => {
                setEditName(deck.name);
                setIsEditing(true);
              }}
              style={{
                flex: 1,
                fontSize: `${FONT_SIZES.xl}px`,
                fontWeight: 600,
                color: COLORS.gray800,
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                padding: `${SPACING.xs}px 0`,
              }}
              title="Click to rename"
            >
              {deck.name}
            </button>
          )}

          {/* Card count badge */}
          <span
            style={{
              fontSize: `${FONT_SIZES.base}px`,
              fontWeight: 600,
              color: deckStats.totalCards === 60 ? COLORS.primary600 : COLORS.gray600,
              background: deckStats.totalCards === 60 ? COLORS.primary100 : COLORS.gray100,
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: `${RADIUS.lg}px`,
              flexShrink: 0,
            }}
          >
            {deckStats.totalCards}/60
          </span>
        </div>

        {/* Ink warning */}
        {deckStats.inkCount > 2 && (
          <div
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.error,
              background: "#fef2f2",
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: `${RADIUS.md}px`,
              marginBottom: `${SPACING.md}px`,
            }}
          >
            {deckStats.inkCount} ink colors (2 recommended)
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: `${SPACING.sm}px`, flexWrap: "wrap" }}>
          <ActionButton onClick={onNewDeck} title="New deck">
            New
          </ActionButton>
          <ActionButton onClick={onSaveDeck} title="Save deck">
            Save
          </ActionButton>
          <ActionButton onClick={() => setShowLoadModal(true)} title="Load saved deck">
            Load
          </ActionButton>
          <ActionButton onClick={handleExport} title="Export as JSON">
            Export
          </ActionButton>
          <ActionButton onClick={handleImportClick} title="Import from JSON">
            Import
          </ActionButton>
          <ActionButton
            onClick={() => {
              if (deck.cards.length === 0 || confirm("Clear all cards from deck?")) {
                onClearDeck();
              }
            }}
            title="Clear all cards"
            variant="danger"
          >
            Clear
          </ActionButton>
        </div>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          style={{ display: "none" }}
        />
      </div>

      {/* Card list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `${SPACING.md}px`,
        }}
      >
        {sortedCards.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: `${SPACING.xxl}px ${SPACING.lg}px`,
              color: COLORS.gray500,
            }}
          >
            <div style={{ fontSize: `${FONT_SIZES.xl}px`, marginBottom: `${SPACING.md}px` }}>
              No cards in deck
            </div>
            <div style={{ fontSize: `${FONT_SIZES.base}px` }}>
              Click the + button on cards to add them
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.sm}px` }}>
            {sortedCards.map(({ card, quantity }) => (
              <DeckCardRow
                key={card.id}
                card={card}
                quantity={quantity}
                onIncrement={() => onSetQuantity(card.id, quantity + 1)}
                onDecrement={() => onRemoveCard(card.id)}
                onRemoveAll={() => onRemoveAllCopies(card.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats and Suggestions */}
      <div
        style={{
          borderTop: `1px solid ${COLORS.gray200}`,
          padding: `${SPACING.md}px`,
          display: "flex",
          flexDirection: "column",
          gap: `${SPACING.md}px`,
          maxHeight: "40%",
          overflowY: "auto",
        }}
      >
        <DeckStats
          stats={deckStats}
          collapsed={statsCollapsed}
          onToggleCollapse={() => setStatsCollapsed(!statsCollapsed)}
        />

        {synergyAnalysis.cardSynergies.length > 0 && (
          <DeckSynergyAnalysis
            analysis={synergyAnalysis}
            onRemoveCard={onRemoveAllCopies}
            collapsed={analysisCollapsed}
            onToggleCollapse={() => setAnalysisCollapsed(!analysisCollapsed)}
          />
        )}

        {suggestions.length > 0 && (
          <DeckSuggestions
            suggestions={suggestions}
            onAddCard={onAddCard}
            collapsed={suggestionsCollapsed}
            onToggleCollapse={() => setSuggestionsCollapsed(!suggestionsCollapsed)}
          />
        )}
      </div>

      {/* Load modal */}
      <SavedDecksModal
        decks={getSavedDecks()}
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={handleLoadDeck}
        onDelete={onDeleteSavedDeck}
      />
    </div>
  );
}

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  variant?: "default" | "danger";
}

function ActionButton({ children, onClick, title, variant = "default" }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        background: variant === "danger" ? "#fef2f2" : COLORS.gray100,
        color: variant === "danger" ? COLORS.error : COLORS.gray700,
        border: "none",
        borderRadius: `${RADIUS.md}px`,
        cursor: "pointer",
        fontSize: `${FONT_SIZES.sm}px`,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}
