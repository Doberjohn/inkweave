import {useState, type ReactNode} from 'react';
import {useParams} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useDeck} from '../features/deck/state';
import type {Deck} from '../features/deck/types';
import {DeckPanel, DeckPoolGrid, type DeckRow} from '../features/deck/components';
import {DeckActionsBar} from '../features/deck/components/DeckActionsBar';
import {ImportDeckDialog} from '../features/deck/components/ImportDeckDialog';
import {duelsInkUrl, formatDecklist} from '../features/deck/deckTransfer';
import {useDeckPoolFilters, applyPoolFilters} from '../features/deck/hooks/useDeckPoolFilters';
import {useRoutedDeck} from '../features/deck/hooks/useRoutedDeck';
import {calculateDeckStats} from '../features/deck/analysis/deckStats';
import {BrowseToolbar} from '../features/cards';
import {CompactHeader, FilterDialog, PageTitle} from '../shared/components';
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
// Deck rows resolved and sorted (cost, then name) for the panel's grouped list.
// Cards that no longer resolve (rotated out of Core) are dropped silently here;
// calculateDeckStats surfaces them as warnings instead.
function buildDeckRows(deck: Deck, getCardById: (id: string) => LorcanaCard | undefined): DeckRow[] {
  return deck.cards
    .flatMap((dc) => {
      const card = getCardById(dc.cardId);
      return card ? [{card, quantity: dc.quantity}] : [];
    })
    .sort(
      (a, b) =>
        a.card.cost - b.card.cost ||
        (a.card.fullName || a.card.name).localeCompare(b.card.fullName || b.card.name),
    );
}

/**
 * Adapt the LOCAL pool-filter store to BrowseToolbar's props. Lifted out of the
 * component because it is a pure rename layer, not builder logic: BrowseToolbar
 * was built for Browse's URL-backed store and names its handlers differently.
 */
function buildToolbarProps(pool: ReturnType<typeof useDeckPoolFilters>, onFiltersClick: () => void) {
  return {
    onFiltersClick,
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
}

export function DeckBuilderPage() {
  const {isMobile} = useResponsive();
  const {deck, addCard, setQuantity, renameDeck, clearDeck, replaceCards, loadDeck} = useDeck();
  const {cards, isLoading, getCardById, uniqueKeywords, uniqueClassifications, sets} = useCardDataContext();
  const {openCardModal} = useCardModal();
  const pool = useDeckPoolFilters();
  const {id} = useParams();
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // /decks/:id/edit opens a SAVED deck; /decks/new has no id and loads nothing.
  const loadError = useRoutedDeck(id, deck.id, loadDeck);
  // The advisor UI is pulled while its design is rethought (no numeric surface, no
  // Analysis tab), so nothing consumes the analysis today. The pipeline is left
  // UNWIRED rather than running unread: it fetches per-card pair data on every deck
  // edit, which is real work for an unrendered result. Re-wire when the advisor
  // surface returns — `useDeckAnalysis(deck, getCardById, !isLoading, cards)`.

  if (isMobile) {
    return (
      <CenteredNotice>The deck builder is desktop-only for now. Full mobile building is the next step.</CenteredNotice>
    );
  }
  if (isLoading) {
    return <CenteredNotice>Loading cards…</CenteredNotice>;
  }
  // RLS returns no row for both "does not exist" and "private, not yours". One
  // state for both: distinguishing them would leak whether an id exists.
  if (loadError) {
    return <CenteredNotice>Deck not found. It may not exist, or it may be private.</CenteredNotice>;
  }

  const filtered = applyPoolFilters(cards, pool);
  const quantities = new Map(deck.cards.map((c) => [c.cardId, c.quantity] as const));
  const rows = buildDeckRows(deck, getCardById);
  const stats = calculateDeckStats(deck, getCardById);

  const viewDetails = (card: LorcanaCard) =>
    openCardModal(
      card.id,
      filtered.map((c) => c.id),
    );

  // Opened from the DECK panel: the panel supplies its own rows (in rendered,
  // type-grouped order) so the modal's arrow-nav walks the deck, not the pool.
  const viewDeckDetails = (card: LorcanaCard, siblingIds: string[]) => openCardModal(card.id, siblingIds);

  // Export hands the deck to Duels.ink, which parses the base64 decklist out of the
  // URL and opens it ready to play. noopener/noreferrer: never give an external tab
  // a handle back to this window.
  const exportToDuelsInk = () => {
    const text = formatDecklist(deck.cards, getCardById);
    if (text === '') return;
    window.open(duelsInkUrl(text), '_blank', 'noopener,noreferrer');
  };

  const toolbarProps = buildToolbarProps(pool, () => setShowFilters(true));

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
      {/* The grid takes the remaining height under the sticky header; minHeight:0
          lets its panes own their own scroll instead of overflowing the 100vh shell. */}
      <div style={{flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: DECK_PANE_COLUMNS}}>
        <section aria-label="Card pool" style={{display: 'flex', flexDirection: 'column', minHeight: 0}}>
          {/* No margin reset — Browse's title keeps the UA default 0.67em block
              margin, so we match it (not reset it) for identical spacing. */}
          <PageTitle style={{padding: `${SPACING.xxl}px 32px 0`, flexShrink: 0}}>Deck Builder</PageTitle>
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
          onOpenDetails={viewDeckDetails}
          actions={
            <DeckActionsBar
              cardCount={stats.totalCards}
              isLegal={stats.isLegal}
              onClear={clearDeck}
              onImport={() => setShowImport(true)}
              onExport={exportToDuelsInk}
            />
          }
        />
      </div>

      <ImportDeckDialog
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        pool={cards}
        onImport={replaceCards}
        currentCardCount={stats.totalCards}
      />

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
