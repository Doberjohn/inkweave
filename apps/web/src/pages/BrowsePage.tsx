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
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  FilterDialog,
  MOBILE_NAV_HEIGHT,
} from '../shared/components';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  type BrowseSortOrder,
  type CardTypeFilter,
} from '../shared/constants';
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
      <button
        onClick={onRetry}
        style={{
          padding: '8px 20px',
          background: COLORS.primary,
          color: COLORS.background,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: FONTS.body,
          fontWeight: 600,
        }}>
        Retry
      </button>
    </main>
  );
}

interface BrowseContentSectionProps {
  isMobile: boolean;
  toolbarProps: React.ComponentProps<typeof BrowseToolbar>;
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: {id: string}) => void;
}

function BrowseContentSection({
  isMobile,
  toolbarProps,
  cards,
  isLoading,
  onCardSelect,
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
      <h1
        style={{
          padding: titlePadding,
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
        Browse Cards
      </h1>
      <BrowseToolbar {...toolbarProps} />
      {/* Card grid — flex-fills remaining space; VirtuosoGrid scrolls inside */}
      <div style={{flex: 1, minHeight: 0, position: 'relative'}}>
        <ErrorBoundary>
          <BrowseCardGrid cards={cards} isLoading={isLoading} onCardSelect={onCardSelect} />
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
  const sortedCards = applyFiltersAndSort(cards, searchQuery, combinedFilters, sortOrder);
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

  const contentProps = {
    isMobile,
    toolbarProps,
    cards: sortedCards,
    isLoading,
    onCardSelect: selectCard,
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
      <EtherealBackground />
      <CompactHeader onLogoClick={goHome} />
      <BrowseContentSection {...contentProps} />
      <FilterDialog {...filterDialogProps} variant="modal" />
    </main>
  );
}
