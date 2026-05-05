import {useState} from 'react';
import {useParams, useNavigate, type NavigateFunction} from 'react-router-dom';
import {
  SynergyResults,
  CardDetailPanel,
  MobileCardDetail,
  SynergyDetailModal,
} from '../features/synergies';
import {usePrecomputedSynergies} from '../features/synergies/hooks';
import type {DetailedPairSynergy, LorcanaCard, SynergyGroup} from 'inkweave-synergy-engine';
import {CardDetailSkeleton, CardGridSkeleton} from '../features/cards';
import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';
import {COLORS, FONTS, LAYOUT, SPACING} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';

const centeredPage = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONTS.body,
} as const;

function SynergyErrorBanner({error}: {error: Error}) {
  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        margin: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        color: '#f59090',
        fontSize: '13px',
      }}>
      Failed to load synergies: {error.message}
    </div>
  );
}

function scrollIntoViewBy(selector: string) {
  document.querySelector(selector)?.scrollIntoView({behavior: 'smooth', block: 'start'});
}

function getSelectedCard(
  cardId: string | undefined,
  getCardById: (id: string) => LorcanaCard | undefined,
): LorcanaCard | null {
  if (!cardId) return null;
  return getCardById(cardId) ?? null;
}

type CardPageController = {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeGroupFilter: string | null;
  setActiveGroupFilter: (v: string | null) => void;
  expandedGroup: string | null;
  detailPair: DetailedPairSynergy | null;
  lastPair: DetailedPairSynergy | null;
  goHome: () => void;
  handleSearchSubmit: () => void;
  selectCard: (card: {id: string}) => void;
  handleGroupClick: (groupKey: string) => void;
  handleShowAll: (groupKey: string) => void;
  handleBackToAll: () => void;
  handleSynergyCardClick: (card: LorcanaCard, groupKey?: string) => void;
  handleCloseDetail: () => void;
};

function useCardPageController({
  cardId,
  navigate,
  getPrecomputedPair,
}: {
  cardId: string | undefined;
  navigate: NavigateFunction;
  getPrecomputedPair: (card: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null;
}): CardPageController {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [detailPair, setDetailPair] = useState<DetailedPairSynergy | null>(null);
  // Keeps last non-null pair so exit animation can render stale data while fading out
  const [lastPair, setLastPair] = useState<DetailedPairSynergy | null>(null);
  const [prevCardId, setPrevCardId] = useState(cardId);

  // Reset synergy view state when navigating between cards
  if (cardId !== prevCardId) {
    setPrevCardId(cardId);
    setActiveGroupFilter(null);
    setExpandedGroup(null);
    setDetailPair(null);
  }

  const goHome = () => navigate('/');

  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  };

  const selectCard = (card: {id: string}) => navigate(`/card/${card.id}`);

  const handleGroupClick = (groupKey: string) => {
    if (expandedGroup) {
      // In show-all mode: clicking a breakdown row switches to that group
      setExpandedGroup(groupKey);
      setActiveGroupFilter(groupKey);
      return;
    }
    // Normal mode: toggle filter (same as chips)
    const newFilter = activeGroupFilter === groupKey ? null : groupKey;
    setActiveGroupFilter(newFilter);
    if (newFilter) {
      requestAnimationFrame(() => scrollIntoViewBy(`[data-group-key="${newFilter}"]`));
    }
  };

  const handleShowAll = (groupKey: string) => {
    setExpandedGroup(groupKey);
    setActiveGroupFilter(groupKey);
    requestAnimationFrame(() => scrollIntoViewBy(`[data-expanded-group="${groupKey}"]`));
  };

  const handleBackToAll = () => {
    setExpandedGroup(null);
    setActiveGroupFilter(null);
  };

  const handleSynergyCardClick = (clickedCard: LorcanaCard, groupKey?: string) => {
    const pair = getPrecomputedPair(clickedCard, groupKey);
    if (!pair || pair.connections.length === 0) return;
    setDetailPair(pair);
    setLastPair(pair);
  };

  const handleCloseDetail = () => setDetailPair(null);

  return {
    searchQuery,
    setSearchQuery,
    activeGroupFilter,
    setActiveGroupFilter,
    expandedGroup,
    detailPair,
    lastPair,
    goHome,
    handleSearchSubmit,
    selectCard,
    handleGroupClick,
    handleShowAll,
    handleBackToAll,
    handleSynergyCardClick,
    handleCloseDetail,
  };
}

function CardNotFoundView({onHome}: {onHome: () => void}) {
  return (
    <div style={{...centeredPage, flexDirection: 'column', gap: '16px'}}>
      <h1 style={{color: COLORS.text, margin: 0}}>Card not found</h1>
      <p style={{color: COLORS.textMuted, margin: 0}}>
        The card you&apos;re looking for doesn&apos;t exist.
      </p>
      <button
        onClick={onHome}
        style={{
          padding: '10px 20px',
          background: COLORS.primary500,
          color: COLORS.white,
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 500,
        }}>
        Go Home
      </button>
    </div>
  );
}

type MobileCardViewProps = {
  isLoading: boolean;
  card: LorcanaCard | null;
  synergies: SynergyGroup[];
  synergiesError: Error | null;
  detailPair: DetailedPairSynergy | null;
  lastPair: DetailedPairSynergy | null;
  onSynergyCardClick: (card: LorcanaCard) => void;
  onCloseDetail: () => void;
};

function MobileCardView({
  isLoading,
  card,
  synergies,
  synergiesError,
  detailPair,
  lastPair,
  onSynergyCardClick,
  onCloseDetail,
}: MobileCardViewProps) {
  return (
    <ErrorBoundary>
      {synergiesError && !isLoading && <SynergyErrorBanner error={synergiesError} />}
      <MobileCardDetail
        isLoading={isLoading}
        card={card}
        synergies={synergies}
        onSynergyCardClick={onSynergyCardClick}
      />
      {lastPair && (
        <SynergyDetailModal
          isOpen={!!detailPair}
          onClose={onCloseDetail}
          pair={lastPair}
        />
      )}
    </ErrorBoundary>
  );
}

function DesktopLoadingPanes() {
  return (
    <>
      <aside
        style={{
          width: `${LAYOUT.cardDetailWidth}px`,
          minWidth: `${LAYOUT.cardDetailWidth}px`,
          borderRight: `1px solid ${COLORS.surfaceBorder}`,
          background: COLORS.surface,
          boxSizing: 'border-box',
        }}
        aria-label="Loading card detail panel">
        <CardDetailSkeleton />
      </aside>
      <div style={{flex: 1, padding: `${SPACING.lg}px`}}>
        <CardGridSkeleton
          columns={2}
          rows={3}
          padding="0"
          ariaLabel="Loading synergies"
        />
      </div>
    </>
  );
}

type DesktopMainAreaProps = {
  isLoading: boolean;
  selectedCard: LorcanaCard | null;
  synergies: SynergyGroup[];
  totalSynergyCount: number;
  synergiesError: Error | null;
  activeGroupFilter: string | null;
  expandedGroup: string | null;
  onGroupClick: (groupKey: string) => void;
  onGroupFilterChange: (v: string | null) => void;
  onShowAll: (groupKey: string) => void;
  onBackToAll: () => void;
  onSynergyCardClick: (card: LorcanaCard) => void;
  onClearSelection: () => void;
};

function DesktopMainArea({
  isLoading,
  selectedCard,
  synergies,
  totalSynergyCount,
  synergiesError,
  activeGroupFilter,
  expandedGroup,
  onGroupClick,
  onGroupFilterChange,
  onShowAll,
  onBackToAll,
  onSynergyCardClick,
  onClearSelection,
}: DesktopMainAreaProps) {
  if (isLoading || !selectedCard) return <DesktopLoadingPanes />;
  return (
    <>
      <CardDetailPanel
        card={selectedCard}
        synergies={synergies}
        onGroupClick={onGroupClick}
        activeGroupKey={activeGroupFilter}
      />
      <ErrorBoundary>
        {synergiesError ? (
          <SynergyErrorBanner error={synergiesError} />
        ) : (
          <SynergyResults
            selectedCard={selectedCard}
            synergies={synergies}
            totalSynergyCount={totalSynergyCount}
            onClearSelection={onClearSelection}
            activeGroupFilter={activeGroupFilter}
            onGroupFilterChange={onGroupFilterChange}
            expandedGroup={expandedGroup}
            onShowAll={onShowAll}
            onBackToAll={onBackToAll}
            onSynergyCardClick={onSynergyCardClick}
          />
        )}
      </ErrorBoundary>
    </>
  );
}

type DesktopCardViewProps = DesktopMainAreaProps & {
  cards: LorcanaCard[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onLogoClick: () => void;
  onCardSelect: (card: {id: string}) => void;
  detailPair: DetailedPairSynergy | null;
  lastPair: DetailedPairSynergy | null;
  onCloseDetail: () => void;
};

function DesktopCardView({
  cards,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onLogoClick,
  onCardSelect,
  detailPair,
  lastPair,
  onCloseDetail,
  ...mainAreaProps
}: DesktopCardViewProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
      <EtherealBackground />
      <CompactHeader
        onLogoClick={onLogoClick}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        cards={cards}
        onCardSelect={onCardSelect}
      />
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          position: 'relative',
          zIndex: 1,
        }}>
        <DesktopMainArea {...mainAreaProps} />
      </div>
      {lastPair && (
        <ErrorBoundary>
          <SynergyDetailModal
            isOpen={!!detailPair}
            onClose={onCloseDetail}
            pair={lastPair}
          />
        </ErrorBoundary>
      )}
    </main>
  );
}

export function CardPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, getCardById} = useCardDataContext();

  const selectedCard = getSelectedCard(cardId, getCardById);

  const {
    synergies,
    error: synergiesError,
    getPairSynergies,
  } = usePrecomputedSynergies(selectedCard);

  const ctrl = useCardPageController({
    cardId,
    navigate,
    getPrecomputedPair: getPairSynergies,
  });

  const totalSynergyCount = synergies.reduce((sum, group) => sum + group.synergies.length, 0);

  // Card-not-found only fires after loading completes
  if (!isLoading && !selectedCard) return <CardNotFoundView onHome={ctrl.goHome} />;

  if (isMobile) {
    return (
      <MobileCardView
        isLoading={isLoading}
        card={selectedCard}
        synergies={synergies}
        synergiesError={synergiesError}
        detailPair={ctrl.detailPair}
        lastPair={ctrl.lastPair}
        onSynergyCardClick={ctrl.handleSynergyCardClick}
        onCloseDetail={ctrl.handleCloseDetail}
      />
    );
  }

  return (
    <DesktopCardView
      cards={cards}
      searchQuery={ctrl.searchQuery}
      onSearchChange={ctrl.setSearchQuery}
      onSearchSubmit={ctrl.handleSearchSubmit}
      onLogoClick={ctrl.goHome}
      onCardSelect={ctrl.selectCard}
      detailPair={ctrl.detailPair}
      lastPair={ctrl.lastPair}
      onCloseDetail={ctrl.handleCloseDetail}
      isLoading={isLoading}
      selectedCard={selectedCard}
      synergies={synergies}
      totalSynergyCount={totalSynergyCount}
      synergiesError={synergiesError}
      activeGroupFilter={ctrl.activeGroupFilter}
      expandedGroup={ctrl.expandedGroup}
      onGroupClick={ctrl.handleGroupClick}
      onGroupFilterChange={ctrl.setActiveGroupFilter}
      onShowAll={ctrl.handleShowAll}
      onBackToAll={ctrl.handleBackToAll}
      onSynergyCardClick={ctrl.handleSynergyCardClick}
      onClearSelection={ctrl.goHome}
    />
  );
}
