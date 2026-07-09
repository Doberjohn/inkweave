import {useState, type ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useDeck} from '../features/deck/state';
import {DeckPanel, DeckPoolGrid, type DeckRow} from '../features/deck/components';
import {useDeckPoolFilters, applyPoolFilters} from '../features/deck/hooks/useDeckPoolFilters';
import {calculateDeckStats} from '../features/deck/analysis/deckStats';
import {BrowseToolbar} from '../features/cards';
import {FilterDialog} from '../shared/components';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';

// Desktop split: the deck panel takes ~40% (min 500px) so it has room for the
// synergy / suggestion / analysis content to come; the pool gets the rest, with
// larger, more readable card scans (see DeckPoolGrid's min column width).
const DECK_PANE_COLUMNS = 'minmax(0, 1fr) minmax(500px, 37%)';

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
  const {deck, setQuantity, removeCard, renameDeck} = useDeck();
  const {cards, isLoading, getCardById, uniqueKeywords, uniqueClassifications, sets} = useCardDataContext();
  const {openCardModal} = useCardModal();
  const pool = useDeckPoolFilters();
  const [showFilters, setShowFilters] = useState(false);

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
    <main style={{height: '100vh', background: COLORS.background, fontFamily: FONTS.body, overflow: 'hidden'}}>
      <div style={{height: '100%', display: 'grid', gridTemplateColumns: DECK_PANE_COLUMNS}}>
        <section aria-label="Card pool" style={{display: 'flex', flexDirection: 'column', minHeight: 0}}>
          <h1
            style={{
              padding: `${SPACING.lg}px ${SPACING.md}px 0`,
              margin: 0,
              fontFamily: FONTS.hero,
              fontSize: `${FONT_SIZES.xxl}px`,
              color: COLORS.text,
              flexShrink: 0,
            }}>
            Deck Builder
          </h1>
          <BrowseToolbar {...toolbarProps} />
          <div style={{flex: 1, minHeight: 0, position: 'relative'}}>
            <DeckPoolGrid
              cards={filtered}
              deckInks={deck.inks}
              quantities={quantities}
              onIncrement={(card) => setQuantity(card.id, (quantities.get(card.id) ?? 0) + 1)}
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
          onIncrement={(id) => setQuantity(id, (quantities.get(id) ?? 0) + 1)}
          onDecrement={(id) => setQuantity(id, (quantities.get(id) ?? 0) - 1)}
          onRemove={removeCard}
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
