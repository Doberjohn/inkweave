import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  getAllPlaystyles,
  type LorcanaCard,
  type Playstyle,
} from 'inkweave-synergy-engine';
import {useAllPlaystyleCards} from '../features/synergies/hooks';
import {CardGridSkeleton} from '../features/cards';
import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';
import {PlaystyleFanTile, PlaystyleSection} from '../features/playstyles';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  PLAYSTYLE_UI,
  COMING_SOON_PLAYSTYLES,
  type PlaystyleUiMeta,
} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {trackCardSelected} from '../features/cards/lib/cardAnalytics';
import {trackEvent} from '../shared/lib/analytics';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useResponsive, usePreloadImages} from '../shared/hooks';

// ── Layout config (computed once, passed as concrete values) ──

interface LayoutConfig {
  pagePadding: string;
  gridPadding: string;
  maxSubtitleWidth: number | undefined;
}

const DESKTOP_LAYOUT: LayoutConfig = {
  pagePadding: `${SPACING.xxl + 8}px 32px 0`,
  gridPadding: `${SPACING.xxl}px 32px 48px`,
  maxSubtitleWidth: 640,
};

const MOBILE_LAYOUT: LayoutConfig = {
  pagePadding: `${SPACING.xl}px ${SPACING.lg}px 0`,
  gridPadding: `${SPACING.xl}px ${SPACING.lg}px 48px`,
  maxSubtitleWidth: undefined,
};

// ── Page data ──

type ActivePlaystyleEntry = {
  playstyle: Playstyle;
  ui: PlaystyleUiMeta;
  cardCount: number;
  allCards: LorcanaCard[];
};

type PlaystyleCardData = ReturnType<typeof useAllPlaystyleCards>['data'];

function buildActivePlaystyles(playstyleCardData: PlaystyleCardData): ActivePlaystyleEntry[] {
  return getAllPlaystyles()
    .filter((ps) => {
      if (PLAYSTYLE_UI[ps.id]) return true;
      console.error(`Missing PLAYSTYLE_UI entry for playstyle "${ps.id}"`);
      return false;
    })
    .map((ps) => {
      const ui = PLAYSTYLE_UI[ps.id];
      const psData = playstyleCardData.get(ps.id);
      return {playstyle: ps, ui, cardCount: psData?.count ?? 0, allCards: psData?.allCards ?? []};
    });
}

/** Resolve the curated hero card + up to four supporting cards for one fan tile. */
function fanCardsFor(
  ui: PlaystyleUiMeta,
  allCards: LorcanaCard[],
  getCardById: (id: string) => LorcanaCard | undefined,
) {
  const heroCard = getCardById(ui.heroCardId);
  const supportCards = allCards.filter((c) => c.id !== ui.heroCardId).slice(0, 4);
  return {heroCard, supportCards};
}

// ── Page sub-components ──

function PageErrorView({onRetry}: {onRetry: () => void}) {
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

function PageIntro({layout}: {layout: LayoutConfig}) {
  return (
    <div style={{padding: layout.pagePadding, textAlign: 'center'}}>
      <h1
        style={{
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.xxxl}px`,
          fontWeight: 700,
          color: COLORS.text,
          margin: '0 0 4px',
        }}>
        Playstyles
      </h1>
      <p
        style={{
          fontSize: `${FONT_SIZES.lg}px`,
          color: COLORS.descriptionText,
          lineHeight: 1.5,
          maxWidth: layout.maxSubtitleWidth,
          margin: '0 auto',
        }}>
        Some cards were made to be played together. Find yours.
      </p>
    </div>
  );
}

function PlaystyleGalleryLoadingGrid({isMobile}: {isMobile: boolean}) {
  return (
    <CardGridSkeleton
      rows={2}
      columns={isMobile ? 1 : 3}
      gap={16}
      padding={isMobile ? MOBILE_LAYOUT.gridPadding : DESKTOP_LAYOUT.gridPadding}
      aspectRatio={isMobile ? 1.8 : 2.4}
      ariaLabel="Loading playstyles"
    />
  );
}

function ComingSoonBand() {
  if (COMING_SOON_PLAYSTYLES.length === 0) return null;
  return (
    <section style={{marginTop: 28}}>
      <h2
        style={{
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          color: COLORS.textMuted,
          margin: '0 0 14px',
        }}>
        Coming soon
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
        {COMING_SOON_PLAYSTYLES.map((ps) => (
          <div
            key={ps.name}
            style={{
              border: `1px dashed ${COLORS.surfaceBorder}`,
              borderRadius: 12,
              minHeight: 84,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.textMuted,
              fontSize: `${FONT_SIZES.base}px`,
            }}>
            {ps.name}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlaystyleGalleryGrid({
  isLoading,
  isMobile,
  activePlaystyles,
  onPlaystyleClick,
  getCardById,
}: {
  isLoading: boolean;
  isMobile: boolean;
  activePlaystyles: ActivePlaystyleEntry[];
  onPlaystyleClick: (id: string) => void;
  getCardById: (id: string) => LorcanaCard | undefined;
}) {
  if (isLoading) return <PlaystyleGalleryLoadingGrid isMobile={isMobile} />;
  const mechanics = activePlaystyles.filter((e) => e.ui.kind === 'mechanic');
  const tribes = activePlaystyles.filter((e) => e.ui.kind === 'tribe');
  const renderTile = ({playstyle, ui, cardCount, allCards}: ActivePlaystyleEntry) => {
    const {heroCard, supportCards} = fanCardsFor(ui, allCards, getCardById);
    return (
      <PlaystyleFanTile
        key={playstyle.id}
        playstyleId={playstyle.id}
        name={playstyle.name}
        accentColor={ui.accentColor}
        accentRgb={ui.accentRgb}
        cardCount={cardCount}
        heroCard={heroCard}
        supportCards={supportCards}
        onNavigate={onPlaystyleClick}
      />
    );
  };
  return (
    <>
      <PlaystyleSection title="Mechanics" subtitle="Cards that share a clever trick, whoever's on your team.">
        {mechanics.map(renderTile)}
      </PlaystyleSection>
      <PlaystyleSection title="Tribes" subtitle="A party of characters who quest better together.">
        {tribes.map(renderTile)}
      </PlaystyleSection>
      <ComingSoonBand />
    </>
  );
}

// ── Page ──

const ALL_COVER_ART_URLS = [
  ...Object.values(PLAYSTYLE_UI).map((ui) => ui.coverArt),
  ...COMING_SOON_PLAYSTYLES.map((ps) => ps.coverArt),
];

export function PlaystyleGalleryPage() {
  const navigate = useNavigate();
  const {openCardModal} = useCardModal();
  const {cards, isLoading, error, retryLoad, getCardById} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const {isMobile} = useResponsive();

  const layout = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  // Preload cover art images so CSS backgroundImage doesn't wait for render
  usePreloadImages(ALL_COVER_ART_URLS);

  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    if (q) trackEvent('search_submitted', {query: q, source: 'gallery'});
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  };
  const handleCardSelect = (card: {id: string}) => {
    trackCardSelected(getCardById(card.id), 'playstyle_gallery');
    openCardModal(card.id);
  };

  const {data: playstyleCardData} = useAllPlaystyleCards();
  const activePlaystyles = buildActivePlaystyles(playstyleCardData);
  const onPlaystyleClick = (id: string) => {
    const name = activePlaystyles.find((e) => e.playstyle.id === id)?.playstyle.name ?? id;
    trackEvent('playstyle_opened', {playstyleId: id, playstyleName: name});
    navigate(`/playstyles/${id}`);
  };

  if (error) return <PageErrorView onRetry={retryLoad} />;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
      }}>
      <EtherealBackground />
      <CompactHeader
        {...(!isMobile && {
          searchQuery,
          onSearchChange: setSearchQuery,
          onSearchSubmit: handleSearchSubmit,
          cards,
          onCardSelect: handleCardSelect,
        })}
        isMobile={isMobile}
      />

      <div style={{position: 'relative', zIndex: 1}}>
        <PageIntro layout={layout} />
        <div style={{padding: layout.gridPadding}}>
          <ErrorBoundary>
            <PlaystyleGalleryGrid
              isLoading={isLoading}
              isMobile={isMobile}
              activePlaystyles={activePlaystyles}
              onPlaystyleClick={onPlaystyleClick}
              getCardById={getCardById}
            />
          </ErrorBoundary>
        </div>
      </div>
    </main>
  );
}
