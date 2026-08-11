import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {BrowseCardGrid, BrowseToolbar, type Ink} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  type CardFilterOptions,
} from '../features/cards/loader';
import {CompactHeader, CtaButton, ErrorBoundary, EtherealBackground, FilterDialog, MOBILE_NAV_HEIGHT, PageTitle, Seo} from '../shared/components';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  type BrowseSortOrder,
  type CardTypeFilter,
} from '../shared/constants';
import {useCollection, useCollectionPool, CollectionBinderSection, BrowseModeBar} from '../features/collection';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {trackCardSelected} from '../features/cards/lib/cardAnalytics';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useResponsive, useFilterParams} from '../shared/hooks';

// =====================================================================
// Module-level helpers — keep BrowsePage's CC low by hoisting branches.
// =====================================================================

function buildCombinedFilters(
  base: CardFilterOptions,
  inkFilters: Ink[],
  typeFilters: CardTypeFilter[],
  costFilters: number[],
): CardFilterOptions {
  const combined: CardFilterOptions = {...base};
  if (inkFilters.length > 0) combined.ink = inkFilters;
  if (typeFilters.length > 0) combined.type = typeFilters;
  if (costFilters.length > 0) combined.costs = costFilters;
  return combined;
}

function applyFiltersAndSort(
  cards: LorcanaCard[],
  searchQuery: string,
  combinedFilters: CardFilterOptions,
  sortOrder: BrowseSortOrder,
): LorcanaCard[] {
  let result = cards;
  if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
  if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
  return applySortOrder(result, sortOrder);
}

// =====================================================================
// Subcomponents — local to this file. Keep BrowsePage's render small
// and unduplicated across mobile/desktop branches.
// =====================================================================

function BrowseSeo() {
  return (
    <Seo
      title="Browse Disney Lorcana Cards | Inkweave"
      description="Browse and search every Disney Lorcana Core-format card by ink, cost, type, and keyword. Open any card for its strongest synergies and combos."
      canonicalPath="/browse"
    />
  );
}

function BrowsePageError({onRetry}: {onRetry: () => void}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: FONTS.body,
        background: COLORS.background,
      }}>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
        Failed to load card data.
      </p>
      <CtaButton onClick={onRetry}>Retry</CtaButton>
    </main>
  );
}

interface BrowseContentSectionProps {
  isMobile: boolean;
  toolbarProps: React.ComponentProps<typeof BrowseToolbar>;
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: {id: string}) => void;
  /**
   * The mode row: grid/binder switch plus the collection import. Always
   * rendered — `BrowseModeBar` decides internally what to show, hiding the
   * switch until a collection exists (a binder of 3,242 cards nobody has marked
   * as owned is a page of grey rectangles) while keeping the import reachable.
   */
  modeTabs?: React.ReactNode;
  /** Collection mode's content. When set, it replaces the grid entirely. */
  binder?: React.ReactNode;
}

function BrowseContentSection({
  isMobile,
  toolbarProps,
  cards,
  isLoading,
  onCardSelect,
  modeTabs,
  binder,
}: BrowseContentSectionProps) {
  const titlePadding = isMobile
    ? `${SPACING.lg}px ${SPACING.lg}px 0`
    : `${SPACING.xxl}px 32px 0`;
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
        zIndex: 1,
      }}>
      <PageTitle style={{padding: titlePadding, flexShrink: 0}}>Browse Cards</PageTitle>
      {modeTabs}
      {/* The toolbar serves BOTH modes: in binder mode its filters drive which
          slots stay lit rather than which cards are listed. Sort is the one
          control it keeps that the binder ignores — collector order IS the
          binder, so a sort would dismantle the thing being read. */}
      <BrowseToolbar {...toolbarProps} />
      {/* Card grid — flex-fills remaining space; VirtuosoGrid scrolls inside */}
      <div style={{flex: 1, minHeight: 0, position: 'relative'}}>
        <ErrorBoundary>
          {binder ?? <BrowseCardGrid cards={cards} isLoading={isLoading} onCardSelect={onCardSelect} />}
        </ErrorBoundary>
      </div>
    </div>
  );
}

// =====================================================================
// Page component — viewport-bounded shell + shared content section.
// Mobile subtracts the bottom-nav height so AppLayout's padding-bottom
// doesn't push us past the viewport (would re-introduce page scroll).
// =====================================================================

export function BrowsePage() {
  const {openCardModal} = useCardModal();
  const {isMobile} = useResponsive();
  const {cards, isLoading, error, retryLoad, uniqueKeywords, uniqueClassifications, sets, getCardById} =
    useCardDataContext();
  const {
    searchQuery,
    setSearchQuery,
    inkFilters,
    toggleInk,
    typeFilters,
    toggleType,
    costFilters,
    toggleCost,
    clearCosts,
    filters,
    setFilters,
    replaceFilters,
    clearAllFilters,
    activeFilterCount,
    sortOrder,
    setSortOrder,
  } = useFilterParams();
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [collectionMode, setCollectionMode] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const {entries} = useCollection();
  // MUST sit above the `if (error)` return below — it is a hook, and an early
  // return before it would change the hook order between renders.
  //
  // Widened for the IMPORT as well as for the binder: the CSV is joined against
  // this pool, and against the Core-only one every non-Core row is counted and
  // discarded — which is exactly two thirds of a real collection.
  const {pool, isLoading: poolLoading, error: poolError} = useCollectionPool(
    cards,
    collectionMode || showImport,
  );

  // Auto-focus search when navigating with ?focus=search (desktop only; mobile uses bottom sheet)
  useEffect(() => {
    if (!isMobile && searchParams.get('focus') === 'search') {
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>('[data-testid="browse-search"]');
        input?.focus();
      });
      searchParams.delete('focus');
      setSearchParams(searchParams, {replace: true});
    }
  }, [isMobile, searchParams, setSearchParams]);

  if (error) return <BrowsePageError onRetry={retryLoad} />;

  const combinedFilters = buildCombinedFilters(filters, inkFilters, typeFilters, costFilters);
  const sortedCards = applyFiltersAndSort(pool, searchQuery, combinedFilters, sortOrder);
  const goHome = clearAllFilters;
  const selectCard = (card: {id: string}) => {
    trackCardSelected(getCardById(card.id), 'browse');
    openCardModal(card.id, sortedCards.map((c) => c.id));
  };

  const toolbarProps = {
    onFiltersClick: () => setShowFilters(true),
    activeFilterCount,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    onToggleInk: toggleInk,
    onToggleType: toggleType,
    onToggleCost: toggleCost,
    onClearCosts: clearCosts,
    onFiltersChange: setFilters,
    sortOrder,
    onSortChange: setSortOrder,
    isMobile,
    searchQuery,
    onSearchChange: setSearchQuery,
  } as const;

  const filterDialogProps = {
    isOpen: showFilters,
    onClose: () => setShowFilters(false),
    onApply: replaceFilters,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    uniqueKeywords,
    uniqueClassifications,
    sets,
  };

  // The pool is complete only once the lazy non-Core chunks have landed. Parsing
  // a CSV before then silently drops every non-Core row, so the import is gated
  // on this rather than on the dialog merely being open.
  const isPoolReady = !poolLoading && poolError === null;
  const contentProps = {
    isMobile,
    toolbarProps,
    cards: sortedCards,
    isLoading,
    onCardSelect: selectCard,
    modeTabs: (
      <BrowseModeBar
        mode={collectionMode ? 'collection' : 'all'}
        onModeChange={(m) => setCollectionMode(m === 'collection')}
        pool={pool}
        isPoolReady={isPoolReady}
        isImportOpen={showImport}
        onImportOpen={() => setShowImport(true)}
        onImportClose={() => setShowImport(false)}
      />
    ),
    // `matchedIds` is built inside this branch, not above it: in grid mode it
    // would be a Set of up to 3,242 strings rebuilt every render for nobody.
    binder: collectionMode ? (
      <CollectionBinderSection
        cards={pool}
        matchedIds={new Set(sortedCards.map((card) => card.id))}
        entries={entries}
        isLoading={poolLoading}
        error={poolError}
        onCardSelect={selectCard}
      />
    ) : null,
  };

  if (isMobile) {
    return (
      <main
        style={{
          height: `calc(100dvh - ${MOBILE_NAV_HEIGHT}px)`,
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.background,
          fontFamily: FONTS.body,
          position: 'relative',
          overflow: 'hidden',
        }}>
        <BrowseSeo />
        <EtherealBackground />
        <CompactHeader onLogoClick={goHome} isMobile />
        <BrowseContentSection {...contentProps} />
        <FilterDialog {...filterDialogProps} variant="drawer" />
      </main>
    );
  }

  return (
    <main
      style={{
        height: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
      <BrowseSeo />
      <EtherealBackground />
      <CompactHeader onLogoClick={goHome} />
      <BrowseContentSection {...contentProps} />
      <FilterDialog {...filterDialogProps} variant="modal" />
    </main>
  );
}
