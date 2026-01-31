import { useMemo } from "react";
import { CardList, CardPreviewProvider, CardPreviewPopover, filterCards } from "./features/cards";
import { useSynergyFinder, SynergyResults } from "./features/synergies";
import { useDeckBuilder, DeckPanel } from "./features/deck";
import { Header, MobileHeader, MobileNav, ErrorBoundary } from "./shared/components";
import { COLORS, LAYOUT, LAYOUT_MOBILE } from "./shared/constants";
import { useResponsive, useMobileView } from "./shared/hooks";

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
    retryLoad,
  } = useSynergyFinder();

  const deckBuilder = useDeckBuilder();
  const { isMobile } = useResponsive();
  const { activeView, setActiveView } = useMobileView();

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
        <p style={{ color: COLORS.gray600, marginBottom: "20px" }}>{error.message}</p>
        <button
          onClick={retryLoad}
          style={{
            padding: "10px 20px",
            background: COLORS.primary500,
            color: COLORS.white,
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 500,
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg, ${COLORS.bgGradientStart} 0%, ${COLORS.bgGradientEnd} 100%)`,
          fontFamily: "'Inter', -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MobileHeader gameMode={gameMode} onGameModeChange={setGameMode} />

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            paddingBottom: `${LAYOUT_MOBILE.bottomNavHeight}px`,
          }}
        >
          {activeView === "cards" && (
            <ErrorBoundary>
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
                onCardSelect={(card) => {
                  selectCard(card);
                  setActiveView("synergies");
                }}
                onAddToDeck={deckBuilder.addCard}
                getCardQuantity={deckBuilder.getCardQuantity}
                isMobile
              />
            </ErrorBoundary>
          )}

          {activeView === "synergies" && (
            <ErrorBoundary>
              <SynergyResults
                selectedCard={selectedCard}
                synergies={synergies}
                totalSynergyCount={totalSynergyCount}
                onClearSelection={clearSelection}
                onAddToDeck={deckBuilder.addCard}
                getCardQuantity={deckBuilder.getCardQuantity}
                isMobile
              />
            </ErrorBoundary>
          )}

          {activeView === "deck" && (
            <ErrorBoundary>
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
                isMobile
              />
            </ErrorBoundary>
          )}
        </main>

        <MobileNav
          activeView={activeView}
          onViewChange={setActiveView}
          deckCardCount={deckBuilder.deckStats.totalCards}
        />
      </div>
    );
  }

  // Desktop layout
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
