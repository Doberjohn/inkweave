import {useState, type CSSProperties, type ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useDeck} from '../features/deck/state';
import {DeckPanel, DeckPoolGrid, type DeckRow} from '../features/deck/components';
import {useDeckPoolFilters, applyPoolFilters} from '../features/deck/hooks/useDeckPoolFilters';
import {useDeckAnalysis} from '../features/deck/hooks/useDeckAnalysis';
import {calculateDeckStats} from '../features/deck/analysis/deckStats';
import {BrowseToolbar} from '../features/cards';
import {CompactHeader, FilterDialog} from '../shared/components';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';

// Desktop split: the deck panel takes ~40% (min 500px) so it has room for the
// synergy / suggestion / analysis content to come; the pool gets the rest, with
// larger, more readable card scans (see DeckPoolGrid's min column width).
const DECK_PANE_COLUMNS = 'minmax(0, 1fr) minmax(500px, 37%)';

// The visible page chrome is CompactHeader; keep one h1 in the a11y tree so the
// heading outline stays intact without a second visible title.
const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function CenteredNotice({children}: {children: ReactNode}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        fontFamily: FONTS.body,
      }}>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`, textAlign: 'center', maxWidth: 360}}>
        {children}
      </p>
    </main>
  );
}

/**
 * `/decks/new` and `/decks/:id/edit` — the builder shell (#467). Two panes on
 * desktop: a filterable, virtualized card pool (left) and the live deck panel
 * (right). Reuses BrowseToolbar + FilterDialog with a LOCAL (non-URL) filter
 * store; the deck side reads/writes the shared DeckProvider draft. The advisor
 * (#472) and full mobile building are later increments.
 */
export function DeckBuilderPage() {
  const {isMobile} = useResponsive();
  const {deck, addCard, setQuantity, removeCard, renameDeck} = useDeck();
  const {cards, isLoading, getCardById, uniqueKeywords, uniqueClassifications, sets} = useCardDataContext();
  const {openCardModal} = useCardModal();
  const pool = useDeckPoolFilters();
  const [showFilters, setShowFilters] = useState(false);
  const deckAnalysis = useDeckAnalysis(deck, getCardById, !isLoading);

  if (isMobile) {
    return (
      <CenteredNotice>The deck builder is desktop-only for now. Full mobile building is the next step.</CenteredNotice>
    );
  }
  if (isLoading) {
    return <CenteredNotice>Loading cards…</CenteredNotice>;
  }

  const filtered = applyPoolFilters(cards, pool);
  const quantities = new Map(deck.cards.map((c) => [c.cardId, c.quantity] as const));
  const rows: DeckRow[] = deck.cards
    .map((dc) => ({card: getCardById(dc.cardId), quantity: dc.quantity}))
    .filter((r): r is DeckRow => r.card !== undefined)
    .sort(
      (a, b) =>
        a.card.cost - b.card.cost ||
        (a.card.fullName || a.card.name).localeCompare(b.card.fullName || b.card.name),
    );
  const stats = calculateDeckStats(deck, getCardById);

  const viewDetails = (card: LorcanaCard) =>
    openCardModal(
      card.id,
      filtered.map((c) => c.id),
    );

  // Opened from the DECK panel: the panel supplies its own rows (in rendered,
  // type-grouped order) so the modal's arrow-nav walks the deck, not the pool.
  const viewDeckDetails = (card: LorcanaCard, siblingIds: string[]) => openCardModal(card.id, siblingIds);

  const toolbarProps = {
    onFiltersClick: () => setShowFilters(true),
    activeFilterCount: pool.activeFilterCount,
    inkFilters: pool.inkFilters,
    typeFilters: pool.typeFilters,
    costFilters: pool.costFilters,
    filters: pool.filters,
    onToggleInk: pool.toggleInk,
    onToggleType: pool.toggleType,
    onToggleCost: pool.toggleCost,
    onClearCosts: pool.clearCosts,
    onFiltersChange: pool.setFilters,
    sortOrder: pool.sortOrder,
    onSortChange: pool.setSortOrder,
    isMobile: false,
    searchQuery: pool.searchQuery,
    onSearchChange: pool.setSearchQuery,
  } as const;

  return (
    <main
      style={{
        height: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
      <CompactHeader isMobile={isMobile} />
      <h1 style={SR_ONLY}>Deck Builder</h1>
      {/* The grid takes the remaining height under the sticky header; minHeight:0
          lets its panes own their own scroll instead of overflowing the 100vh shell. */}
      <div style={{flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: DECK_PANE_COLUMNS}}>
        <section aria-label="Card pool" style={{display: 'flex', flexDirection: 'column', minHeight: 0}}>
          <BrowseToolbar {...toolbarProps} />
          <div style={{flex: 1, minHeight: 0, position: 'relative'}}>
            <DeckPoolGrid
              cards={filtered}
              quantities={quantities}
              onIncrement={(card) => addCard(card.id)}
              onDecrement={(card) => setQuantity(card.id, (quantities.get(card.id) ?? 0) - 1)}
              onViewDetails={viewDetails}
            />
          </div>
        </section>

        <DeckPanel
          name={deck.name}
          onRename={renameDeck}
          rows={rows}
          stats={stats}
          onIncrement={(id) => addCard(id)}
          onDecrement={(id) => setQuantity(id, (quantities.get(id) ?? 0) - 1)}
          onRemove={removeCard}
          onOpenDetails={viewDeckDetails}
          analysis={deckAnalysis.analysis}
          analysisLoading={deckAnalysis.isLoading}
          analysisError={deckAnalysis.error}
        />
      </div>

      <FilterDialog
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={pool.replaceFilters}
        inkFilters={pool.inkFilters}
        typeFilters={pool.typeFilters}
        costFilters={pool.costFilters}
        filters={pool.filters}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
        variant="modal"
      />
    </main>
  );
}
