import {useCallback, useEffect, useMemo, useState} from 'react';
import {useParams, useNavigate, useSearchParams, Navigate} from 'react-router-dom';
import {getPlaystyleById, type PlaystyleId} from 'inkweave-synergy-engine';
import {usePrecomputedPlaystyleCards} from '../features/synergies/hooks';
import {BrowseToolbar, CardTile} from '../features/cards';
import {filterCards, applySortOrder, type CardFilterOptions} from '../features/cards/loader';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  FilterDrawer,
  FilterModal,
  LoadingSpinner,
} from '../shared/components';
import {
  BROWSE_SORT_OPTIONS,
  COLORS,
  FONTS,
  FONT_SIZES,
  LAYOUT,
  RADIUS,
  SPACING,
  PLAYSTYLE_UI,
} from '../shared/constants';
import {SortSelect} from '../shared/components/SortSelect';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive, useFilterParams, usePreloadImages} from '../shared/hooks';

// ── Placeholder tips (will be replaced with per-playstyle data later) ──

const PLACEHOLDER_TIPS = [
  'Stack multiple cards with this effect to create consistent pressure each turn.',
  'Pair with card draw to refill your hand after committing to the board.',
  'Look for cards that advance your own game plan while disrupting your opponent.',
];

// ── Hero layout configs ──

interface HeroLayout {
  padding: string;
  contentGap: number;
  headerGap: number;
  maxDescriptionWidth: number | undefined;
  breadcrumbLinkMinHeight: number | undefined;
  tipsMinHeight: number | undefined;
}

const HERO_DESKTOP: HeroLayout = {
  padding: '20px 32px',
  contentGap: 12,
  headerGap: 12,
  maxDescriptionWidth: 640,
  breadcrumbLinkMinHeight: undefined,
  tipsMinHeight: undefined,
};

const HERO_MOBILE: HeroLayout = {
  padding: '16px',
  contentGap: 10,
  headerGap: 10,
  maxDescriptionWidth: undefined,
  breadcrumbLinkMinHeight: 44,
  tipsMinHeight: 44,
};

// ── Hero scrim ──

const HERO_SCRIM =
  'linear-gradient(180deg, rgba(13,13,20,0.6) 0%, rgba(13,13,20,0.4) 50%, rgba(13,13,20,0.6) 100%)';

// ── Hero Section ──

function PlaystyleHero({
  name,
  description,
  accentColor,
  accentRgb,
  coverArt,
  layout,
  onPlaystylesBreadcrumb,
}: {
  name: string;
  description: string;
  accentColor: string;
  accentRgb: string;
  coverArt: string;
  layout: HeroLayout;
  onPlaystylesBreadcrumb: () => void;
}) {
  const [tipsOpen, setTipsOpen] = useState(false);

  return (
    <section
      style={{
        position: 'relative',
        padding: layout.padding,
        overflow: 'hidden',
        borderBottom: `1px solid rgba(${accentRgb}, 0.25)`,
        boxShadow: `0 4px 20px rgba(${accentRgb}, 0.08)`,
      }}>
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: accentColor,
          zIndex: 3,
        }}
      />
      {/* Background art with Ken Burns */}
      <div
        className="hero-ken-burns"
        style={{
          position: 'absolute',
          inset: -20,
          zIndex: 1,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundImage: `url(${coverArt})`,
          opacity: 0.4,
          filter: 'saturate(0.3) brightness(0.7)',
          animation: 'heroKenBurns 20s ease-in-out infinite alternate',
        }}
      />
      {/* Scrim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: HERO_SCRIM,
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: layout.contentGap,
        }}>
        {/* Breadcrumb */}
        <nav
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
          <a
            href="/playstyles"
            onClick={(e) => {
              e.preventDefault();
              onPlaystylesBreadcrumb();
            }}
            style={{
              color: COLORS.textMuted,
              textDecoration: 'none',
              cursor: 'pointer',
              minHeight: layout.breadcrumbLinkMinHeight,
              display: 'flex',
              alignItems: 'center',
            }}>
            Playstyles
          </a>
          <span style={{fontSize: `${FONT_SIZES.xs}px`, color: '#555570'}}>/</span>
          <span style={{color: COLORS.text, fontWeight: 500}}>{name}</span>
        </nav>

        {/* Header: accent dot + name */}
        <div style={{display: 'flex', alignItems: 'center', gap: layout.headerGap}}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: accentColor,
              flexShrink: 0,
            }}
          />
          <h1
            style={{
              fontSize: `${FONT_SIZES.xxl}px`,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: 0,
            }}>
            {name}
          </h1>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            lineHeight: 1.6,
            color: COLORS.descriptionText,
            maxWidth: layout.maxDescriptionWidth,
            margin: 0,
          }}>
          {description}
        </p>

        {/* Strategy Tips — collapsible section */}
        <button
          onClick={() => setTipsOpen(!tipsOpen)}
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 500,
            color: COLORS.primary,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: FONTS.body,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            minHeight: layout.tipsMinHeight,
            transition: 'opacity 0.15s',
          }}>
          <span
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              display: 'inline-block',
              transform: tipsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>
            &#9654;
          </span>
          Strategy Tips
        </button>
        {tipsOpen && (
          <ul
            style={{
              listStyle: 'none',
              padding: `${SPACING.md}px ${SPACING.lg}px`,
              background: `rgba(${accentRgb}, 0.08)`,
              borderRadius: `${RADIUS.lg}px`,
              border: `1px solid rgba(${accentRgb}, 0.15)`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxWidth: layout.maxDescriptionWidth,
            }}>
            {PLACEHOLDER_TIPS.map((tip, i) => (
              <li
                key={i}
                style={{
                  fontSize: `${FONT_SIZES.base}px`,
                  lineHeight: 1.6,
                  color: COLORS.descriptionText,
                  paddingLeft: 16,
                  position: 'relative',
                }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    color: accentColor,
                    fontWeight: 700,
                  }}>
                  ·
                </span>
                {tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Centered page style ──

const centeredPage = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONTS.body,
} as const;

// ── Page ──

export function PlaystyleDetailPage() {
  const {playstyleId} = useParams<{playstyleId: string}>();
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, error, retryLoad, uniqueKeywords, uniqueClassifications, sets} =
    useCardDataContext();
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const {
    inkFilters,
    toggleInk,
    typeFilters,
    toggleType,
    costFilters,
    toggleCost,
    filters,
    setFilters,
    replaceFilters,
    clearAllFilters,
    activeFilterCount,
    sortOrder,
    setSortOrder,
  } = useFilterParams();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [searchParams] = useSearchParams();

  // Default sort to cost-asc for playstyle detail (most useful for deckbuilding)
  useEffect(() => {
    if (!searchParams.has('sort')) setSortOrder('ink-cost');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve playstyle from engine
  const playstyle = playstyleId ? getPlaystyleById(playstyleId as PlaystyleId) : undefined;
  const ui = playstyleId ? PLAYSTYLE_UI[playstyleId as PlaystyleId] : undefined;

  // Preload hero cover art so CSS backgroundImage doesn't wait for render
  usePreloadImages(useMemo(() => (ui ? [ui.coverArt] : []), [ui]));

  // Get all cards matching this playstyle (pre-computed)
  const {cards: playstyleCards} = usePrecomputedPlaystyleCards(playstyle?.id);

  // Apply filters and sort
  const combinedFilters = useMemo<CardFilterOptions>(() => {
    const combined = {...filters};
    if (inkFilters.length > 0) combined.ink = inkFilters;
    if (typeFilters.length > 0) combined.type = typeFilters;
    if (costFilters.length > 0) combined.costs = costFilters;
    return combined;
  }, [filters, inkFilters, typeFilters, costFilters]);

  const sortedCards = useMemo(() => {
    let result = playstyleCards;
    if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
    return applySortOrder(result, sortOrder);
  }, [playstyleCards, combinedFilters, sortOrder]);

  const displayedCards = useMemo(
    () => sortedCards.slice(0, LAYOUT.maxDisplayedCards),
    [sortedCards],
  );

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const goPlaystyles = useCallback(() => navigate('/playstyles'), [navigate]);
  const handleCardSelect = useCallback(
    (card: {id: string}) => navigate(`/card/${card.id}`),
    [navigate],
  );
  const handleSearchSubmit = useCallback(() => {
    const q = headerSearchQuery.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  }, [navigate, headerSearchQuery]);

  // Invalid playstyle ID — redirect to gallery
  if (!isLoading && (!playstyle || !ui)) {
    return <Navigate to="/playstyles" replace />;
  }

  if (isLoading || !playstyle || !ui) {
    return (
      <div style={centeredPage}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div style={centeredPage}>
        <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
          Failed to load card data.
        </p>
        <button
          onClick={retryLoad}
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
      </div>
    );
  }

  // TypeScript now knows playstyle and ui are defined
  const heroLayout = isMobile ? HERO_MOBILE : HERO_DESKTOP;

  const toolbarProps = {
    resultCount: sortedCards.length,
    totalCount: playstyleCards.length,
    onFiltersClick: isMobile ? () => setShowFilterDrawer(true) : () => setShowFilterModal(true),
    activeFilterCount,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    onToggleInk: toggleInk,
    onToggleType: toggleType,
    onToggleCost: toggleCost,
    onFiltersChange: setFilters,
    onClearAll: clearAllFilters,
    sortOrder,
    onSortChange: setSortOrder,
  } as const;

  // Mobile layout
  if (isMobile) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: COLORS.background,
          fontFamily: FONTS.body,
          position: 'relative',
        }}>
        <EtherealBackground />
        <CompactHeader onLogoClick={goHome} isMobile />
        <div style={{position: 'relative', zIndex: 1}}>
          <PlaystyleHero
            name={playstyle.name}
            description={playstyle.description}
            accentColor={ui.accentColor}
            accentRgb={ui.accentRgb}
            coverArt={ui.coverArt}
            layout={heroLayout}
            onPlaystylesBreadcrumb={goPlaystyles}
          />
          <BrowseToolbar {...toolbarProps} isMobile />
          {/* Sort row — full-width on mobile */}
          <div
            style={{
              width: '100%',
              padding: `${SPACING.sm}px ${SPACING.lg}px 0`,
              position: 'relative',
              zIndex: 1,
            }}>
            <SortSelect
              options={BROWSE_SORT_OPTIONS}
              value={sortOrder}
              onChange={setSortOrder}
              ariaLabel="Sort cards"
              style={{width: '100%', padding: '8px 10px'}}
            />
          </div>
          {/* Card grid */}
          <ErrorBoundary>
            {sortedCards.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 64,
                  color: COLORS.textMuted,
                  fontSize: `${FONT_SIZES.xl}px`,
                }}>
                No cards match your filters.
              </div>
            ) : (
              <div style={{padding: `${SPACING.md}px ${SPACING.lg}px 48px`}}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                  }}>
                  {displayedCards.map((card) => (
                    <CardTile
                      key={card.id}
                      card={card}
                      isSelected={false}
                      onSelect={handleCardSelect}
                      variant="minimal"
                      borderRadius={10}
                      useSmallImage
                    />
                  ))}
                </div>
              </div>
            )}
          </ErrorBoundary>
        </div>
        <FilterDrawer
          isOpen={showFilterDrawer}
          onClose={() => setShowFilterDrawer(false)}
          onApply={replaceFilters}
          inkFilters={inkFilters}
          typeFilters={typeFilters}
          costFilters={costFilters}
          filters={filters}
          uniqueKeywords={uniqueKeywords}
          uniqueClassifications={uniqueClassifications}
          sets={sets}
        />
      </main>
    );
  }

  // Desktop layout
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
        onLogoClick={goHome}
        searchQuery={headerSearchQuery}
        onSearchChange={setHeaderSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        cards={cards}
        onCardSelect={handleCardSelect}
      />
      <div
        style={{
          flex: 1,
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          position: 'relative',
          zIndex: 1,
        }}>
        <PlaystyleHero
          name={playstyle.name}
          description={playstyle.description}
          accentColor={ui.accentColor}
          accentRgb={ui.accentRgb}
          coverArt={ui.coverArt}
          layout={heroLayout}
          onPlaystylesBreadcrumb={goPlaystyles}
        />
        <BrowseToolbar {...toolbarProps} isMobile={false} />
        <ErrorBoundary>
          {sortedCards.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 64,
                color: COLORS.textMuted,
                fontSize: `${FONT_SIZES.xl}px`,
              }}>
              No cards match your filters.
            </div>
          ) : (
            <div style={{padding: '16px 32px 48px'}}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 12,
                }}>
                {displayedCards.map((card) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    isSelected={false}
                    onSelect={handleCardSelect}
                    variant="minimal"
                    useSmallImage
                  />
                ))}
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={replaceFilters}
        inkFilters={inkFilters}
        typeFilters={typeFilters}
        costFilters={costFilters}
        filters={filters}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
      />
    </main>
  );
}
