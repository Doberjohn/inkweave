import { useState } from "react";
import type { LorcanaCard, Ink, CardType } from "../types";
import type { CardFilterOptions } from "../data/loader";
import { CardTile } from "./CardTile";
import { LoadingSpinner } from "./LoadingSpinner";
import { INK_COLORS, ALL_INKS, COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT } from "../constants/theme";

const CARD_TYPES: CardType[] = ["Character", "Action", "Item", "Location"];

function isCardType(value: unknown): value is CardType {
  return typeof value === "string" && CARD_TYPES.includes(value as CardType);
}
const COST_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface CardListProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  selectedCard: LorcanaCard | null;
  searchQuery: string;
  inkFilter: Ink | "all";
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueSets: string[];
  onSearchChange: (query: string) => void;
  onInkFilterChange: (ink: Ink | "all") => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  onCardSelect: (card: LorcanaCard) => void;
  onAddToDeck?: (card: LorcanaCard) => boolean;
  getCardQuantity?: (cardId: string) => number;
}

export function CardList({
  cards,
  isLoading,
  selectedCard,
  searchQuery,
  inkFilter,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  uniqueSets,
  onSearchChange,
  onInkFilterChange,
  onFiltersChange,
  onCardSelect,
  onAddToDeck,
  getCardQuantity,
}: CardListProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const displayedCards = cards.slice(0, LAYOUT.maxDisplayedCards);

  const selectedType = isCardType(filters.type) ? filters.type : undefined;
  const activeFilterCount = [
    filters.type,
    filters.minCost !== undefined,
    filters.maxCost !== undefined,
    filters.keywords?.length,
    filters.classifications?.length,
    filters.setCode,
  ].filter(Boolean).length;

  const updateFilter = <K extends keyof CardFilterOptions>(key: K, value: CardFilterOptions[K]) => {
    const newFilters = { ...filters };
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
    onInkFilterChange("all");
    onSearchChange("");
  };

  return (
    <div
      style={{
        width: `${LAYOUT.sidebarWidth}px`,
        borderRight: `1px solid ${COLORS.gray200}`,
        background: COLORS.white,
        display: "flex",
        flexDirection: "column",
        maxHeight: `calc(100vh - ${LAYOUT.headerHeight}px)`,
      }}
    >
      {isLoading ? (
        <div style={{ padding: `${SPACING.lg}px` }}>
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Filter Panel - Fixed */}
          <div style={{ padding: `${SPACING.lg}px`, paddingBottom: `${SPACING.sm}px`, flexShrink: 0 }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: `${RADIUS.lg}px`,
                border: `1px solid ${COLORS.gray200}`,
                fontSize: `${FONT_SIZES.lg}px`,
                marginBottom: `${SPACING.md}px`,
                boxSizing: "border-box",
              }}
            />

            {/* Ink Filter */}
            <div style={{ marginBottom: `${SPACING.md}px` }}>
              <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: "4px" }}>
                Ink
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                <FilterButton
                  active={inkFilter === "all"}
                  onClick={() => onInkFilterChange("all")}
                >
                  All
                </FilterButton>
                {ALL_INKS.map((ink) => (
                  <FilterButton
                    key={ink}
                    active={inkFilter === ink}
                    onClick={() => onInkFilterChange(ink)}
                    activeColor={INK_COLORS[ink].border}
                    inactiveColor={INK_COLORS[ink].bg}
                    inactiveTextColor={INK_COLORS[ink].text}
                  >
                    {ink}
                  </FilterButton>
                ))}
              </div>
            </div>

            {/* Card Type Filter */}
            <div style={{ marginBottom: `${SPACING.md}px` }}>
              <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: "4px" }}>
                Type
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                <FilterButton
                  active={!selectedType}
                  onClick={() => updateFilter("type", undefined)}
                >
                  All
                </FilterButton>
                {CARD_TYPES.map((type) => (
                  <FilterButton
                    key={type}
                    active={selectedType === type}
                    onClick={() => updateFilter("type", type)}
                  >
                    {type}
                  </FilterButton>
                ))}
              </div>
            </div>

            {/* Cost Range */}
            <div style={{ marginBottom: `${SPACING.md}px` }}>
              <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: "4px" }}>
                Cost
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <select
                  value={filters.minCost ?? ""}
                  onChange={(e) => updateFilter("minCost", e.target.value ? Number(e.target.value) : undefined)}
                  style={selectStyle}
                >
                  <option value="">Min</option>
                  {COST_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span style={{ color: COLORS.gray400 }}>-</span>
                <select
                  value={filters.maxCost ?? ""}
                  onChange={(e) => updateFilter("maxCost", e.target.value ? Number(e.target.value) : undefined)}
                  style={selectStyle}
                >
                  <option value="">Max</option>
                  {COST_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* More Filters Toggle */}
            <button
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: COLORS.primary600,
                fontSize: `${FONT_SIZES.sm}px`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ transform: showMoreFilters ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                &#9654;
              </span>
              More filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
            </button>

            {/* Expanded Filters */}
            {showMoreFilters && (
              <div style={{ marginTop: `${SPACING.md}px` }}>
                {/* Keywords */}
                <div style={{ marginBottom: `${SPACING.md}px` }}>
                  <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: "4px" }}>
                    Keyword
                  </div>
                  <select
                    value={filters.keywords?.[0] ?? ""}
                    onChange={(e) => updateFilter("keywords", e.target.value ? [e.target.value] : undefined)}
                    style={{ ...selectStyle, width: "100%" }}
                  >
                    <option value="">Any keyword</option>
                    {uniqueKeywords.map((kw) => (
                      <option key={kw} value={kw}>{kw}</option>
                    ))}
                  </select>
                </div>

                {/* Classifications */}
                <div style={{ marginBottom: `${SPACING.md}px` }}>
                  <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: "4px" }}>
                    Classification
                  </div>
                  <select
                    value={filters.classifications?.[0] ?? ""}
                    onChange={(e) => updateFilter("classifications", e.target.value ? [e.target.value] : undefined)}
                    style={{ ...selectStyle, width: "100%" }}
                  >
                    <option value="">Any classification</option>
                    {uniqueClassifications.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Set */}
                <div style={{ marginBottom: `${SPACING.md}px` }}>
                  <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: "4px" }}>
                    Set
                  </div>
                  <select
                    value={filters.setCode ?? ""}
                    onChange={(e) => updateFilter("setCode", e.target.value || undefined)}
                    style={{ ...selectStyle, width: "100%" }}
                  >
                    <option value="">Any set</option>
                    {uniqueSets.map((s) => (
                      <option key={s} value={s}>Set {s}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Clear Filters */}
            {(searchQuery || inkFilter !== "all" || activeFilterCount > 0) && (
              <button
                onClick={clearAllFilters}
                style={{
                  marginTop: `${SPACING.sm}px`,
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: COLORS.gray500,
                  fontSize: `${FONT_SIZES.sm}px`,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Clear all filters
              </button>
            )}

            {/* Card Count */}
            <p
              style={{
                fontSize: `${FONT_SIZES.md}px`,
                color: COLORS.gray400,
                marginTop: `${SPACING.md}px`,
                marginBottom: 0,
              }}
            >
              Showing {displayedCards.length} of {cards.length} cards
            </p>
          </div>

          {/* Card List - Scrollable */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: `${SPACING.sm}px ${SPACING.lg}px ${SPACING.lg}px`,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {displayedCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  onClick={() => onCardSelect(card)}
                  isSelected={selectedCard?.id === card.id}
                  onAddToDeck={onAddToDeck}
                  deckQuantity={getCardQuantity?.(card.id) ?? 0}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: `${RADIUS.md}px`,
  border: `1px solid ${COLORS.gray200}`,
  fontSize: `${FONT_SIZES.sm}px`,
  background: COLORS.white,
  cursor: "pointer",
};

function FilterButton({
  active,
  onClick,
  children,
  activeColor = COLORS.primary600,
  inactiveColor = COLORS.gray100,
  inactiveTextColor = COLORS.gray700,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
  inactiveColor?: string;
  inactiveTextColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "5px 10px",
        borderRadius: `${RADIUS.md}px`,
        border: "none",
        background: active ? activeColor : inactiveColor,
        color: active ? COLORS.white : inactiveTextColor,
        fontSize: `${FONT_SIZES.sm}px`,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
