import { useMemo } from "react";
import { useSynergyFinder, useDeckBuilder } from "./hooks";
import { Header, CardList, SynergyResults, DeckPanel, ErrorBoundary, CardPreviewProvider, CardPreviewPopover } from "./components";
import { COLORS, LAYOUT } from "./constants/theme";
import { filterCards } from "./data/loader";

function SynergyFinderApp() {
  const {
    cards,
    filteredCards,
    isLoading,
    error,
    totalCards,
    selectedCard,
    selectCard,
    clearSelection,
    synergies,
    totalSynergyCount,
    searchQuery,
    setSearchQuery,
    inkFilter,
    setInkFilter,
    gameMode,
    setGameMode,
    filters,
    setFilters,
    uniqueKeywords,
    uniqueClassifications,
    uniqueSets,
  } = useSynergyFinder();

  const deckBuilder = useDeckBuilder();

  // Get cards filtered by game mode for suggestions
  const gameModeFilteredCards = useMemo(() => {
    return filterCards(cards, { gameMode });
  }, [cards, gameMode]);

  // Get deck suggestions
  const deckSuggestions = useMemo(() => {
    return deckBuilder.getDeckSuggestions(gameModeFilteredCards);
  }, [deckBuilder, gameModeFilteredCards]);

  // Get deck synergy analysis
  const deckSynergyAnalysis = useMemo(() => {
    return deckBuilder.getDeckSynergyAnalysis();
  }, [deckBuilder]);

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2 style={{ color: COLORS.error }}>Error loading cards</h2>
        <p style={{ color: COLORS.gray600 }}>{error.message}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${COLORS.bgGradientStart} 0%, ${COLORS.bgGradientEnd} 100%)`,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <Header totalCards={totalCards} isLoading={isLoading} gameMode={gameMode} onGameModeChange={setGameMode} />

      <div style={{ display: "flex", minHeight: `calc(100vh - ${LAYOUT.headerHeight}px)` }}>
        <CardList
          cards={filteredCards}
          isLoading={isLoading}
          selectedCard={selectedCard}
          searchQuery={searchQuery}
          inkFilter={inkFilter}
          filters={filters}
          uniqueKeywords={uniqueKeywords}
          uniqueClassifications={uniqueClassifications}
          uniqueSets={uniqueSets}
          onSearchChange={setSearchQuery}
          onInkFilterChange={setInkFilter}
          onFiltersChange={setFilters}
          onCardSelect={selectCard}
          onAddToDeck={deckBuilder.addCard}
          getCardQuantity={deckBuilder.getCardQuantity}
        />

        <SynergyResults
          selectedCard={selectedCard}
          synergies={synergies}
          totalSynergyCount={totalSynergyCount}
          onClearSelection={clearSelection}
          onAddToDeck={deckBuilder.addCard}
          getCardQuantity={deckBuilder.getCardQuantity}
        />

        <DeckPanel
          deck={deckBuilder.deck}
          deckStats={deckBuilder.deckStats}
          suggestions={deckSuggestions}
          synergyAnalysis={deckSynergyAnalysis}
          onAddCard={deckBuilder.addCard}
          onRemoveCard={deckBuilder.removeCard}
          onRemoveAllCopies={deckBuilder.removeAllCopies}
          onSetQuantity={deckBuilder.setQuantity}
          onClearDeck={deckBuilder.clearDeck}
          onRenameDeck={deckBuilder.renameDeck}
          onNewDeck={deckBuilder.newDeck}
          onSaveDeck={deckBuilder.saveDeck}
          onLoadDeck={deckBuilder.loadDeck}
          onDeleteSavedDeck={deckBuilder.deleteSavedDeck}
          getSavedDecks={deckBuilder.getSavedDecks}
          onExportDeck={deckBuilder.exportDeck}
          onImportDeck={deckBuilder.importDeck}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CardPreviewProvider>
        <SynergyFinderApp />
        <CardPreviewPopover />
      </CardPreviewProvider>
    </ErrorBoundary>
  );
}
