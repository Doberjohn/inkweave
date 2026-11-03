import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {LorcanaCard, Playstyle} from 'inkweave-synergy-engine';
import {getAllPlaystyles} from '../features/synergies/engineCatalog';
import {useAllPlaystyleCards, usePreloadPlaystyleFiles} from '../features/synergies/hooks';
import {CardGridSkeleton} from '../features/cards';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  PageAbout,
  Seo,
} from '../shared/components';
import {PlaystyleFanTile, PlaystyleSection} from '../features/playstyles';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  PLAYSTYLE_UI,
  type PlaystyleUiMeta,
  FONT_WEIGHT,
  LINE_HEIGHT,
} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {trackCardSelected} from '../features/cards/lib/cardAnalytics';
import {trackEvent} from '../shared/lib/analytics';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useResponsive} from '../shared/hooks';

// ── Layout config (computed once, passed as concrete values) ──

interface LayoutConfig {
  pagePadding: string;
  gridPadding: string;
  aboutPadding: string;
  maxSubtitleWidth: number | undefined;
}

const DESKTOP_LAYOUT: LayoutConfig = {
  pagePadding: `${SPACING.xxl + 8}px 32px 0`,
  gridPadding: `${SPACING.xxl}px 32px 48px`,
  aboutPadding: '0 32px 48px',
  maxSubtitleWidth: 640,
};

const MOBILE_LAYOUT: LayoutConfig = {
  pagePadding: `${SPACING.xl}px ${SPACING.lg}px 0`,
  gridPadding: `${SPACING.xl}px ${SPACING.lg}px 48px`,
  aboutPadding: `0 ${SPACING.lg}px 48px`,
  maxSubtitleWidth: undefined,
};

// ── Page data ──

type ActivePlaystyleEntry = {
  playstyle: Playstyle;
  ui: PlaystyleUiMeta;
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
      return {playstyle: ps, ui, allCards: psData?.allCards ?? []};
    });
}

/** Resolve the curated hero card + up to four supporting cards for one fan tile. */
function fanCardsFor(
  ui: PlaystyleUiMeta,
  allCards: LorcanaCard[],
  getCardById: (id: string) => LorcanaCard | undefined,
) {
  // Fall back to the first member if the curated hero id was rotated out of the pool,
  // so the tile degrades to a member card instead of a blank. The card-id-integrity
  // test fails the build first; this is the runtime safety net (defense in depth).
  const heroCard = getCardById(ui.heroCardId) ?? allCards[0];
  const supportCards = allCards.filter((c) => c.id !== heroCard?.id).slice(0, 4);
  return {heroCard, supportCards};
}

// ── Page sub-components ──

function PageIntro({layout}: {layout: LayoutConfig}) {
  return (
    <div style={{padding: layout.pagePadding, textAlign: 'center'}}>
      <h1
        style={{
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.xxxl}px`,
          fontWeight: FONT_WEIGHT.bold,
          color: COLORS.text,
          margin: '0 0 4px',
        }}>
        Playstyles
      </h1>
      <p
        style={{
          fontSize: `${FONT_SIZES.lg}px`,
          color: COLORS.descriptionText,
          lineHeight: LINE_HEIGHT.base,
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
  const byName = (a: ActivePlaystyleEntry, b: ActivePlaystyleEntry) =>
    a.playstyle.name.localeCompare(b.playstyle.name);
  const mechanics = activePlaystyles.filter((e) => e.ui.kind === 'mechanic').sort(byName);
  const tribes = activePlaystyles.filter((e) => e.ui.kind === 'tribe').sort(byName);
  const renderTile = ({playstyle, ui, allCards}: ActivePlaystyleEntry) => {
    const {heroCard, supportCards} = fanCardsFor(ui, allCards, getCardById);
    return (
      <PlaystyleFanTile
        key={playstyle.id}
        playstyleId={playstyle.id}
        name={playstyle.name}
        accentColor={ui.accentColor}
        accentRgb={ui.accentRgb}
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
    </>
  );
}

/** What a playstyle is, under the grid: the page's words of its own for search, which its tiles, being card art, don't give it. */
function PlaystylesAbout({padding}: {padding: string}) {
  return (
    <PageAbout heading="About playstyles" padding={padding}>
      <p>
        A playstyle is a strategy that a group of cards push forward together: emptying the
        opponent's hand, ramping ink, filling the board with items, or questing with one tribe of
        characters. Mechanics gather the cards that share a trick, whatever their classification.
        Tribes gather the characters who grow stronger beside others of their kind.
      </p>
      <p>
        Inkweave reads every card's rules text and classifications to find each playstyle's cards
        across all six inks of the Core format. Open a playstyle to see its cards, a guide to how
        the deck wins and how to build it, and its key cards. Each card links to its own page, where
        its pairings are scored from 1 to 10 and players vote on how well they really play.
      </p>
    </PageAbout>
  );
}

// ── Page ──

export function PlaystyleGalleryPage() {
  const navigate = useNavigate();
  const {openCardModal} = useCardModal();
  const {cards, isLoading, getCardById} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const {isMobile} = useResponsive();

  const layout = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

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
  usePreloadPlaystyleFiles(!isLoading && playstyleCardData.size > 0);
  const activePlaystyles = buildActivePlaystyles(playstyleCardData);
  const onPlaystyleClick = (id: string) => {
    const name = activePlaystyles.find((e) => e.playstyle.id === id)?.playstyle.name ?? id;
    trackEvent('playstyle_opened', {playstyleId: id, playstyleName: name});
    navigate(`/playstyles/${id}`);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
      }}>
      <Seo
        title="Lorcana Playstyles & Deck Archetypes | Inkweave"
        description="Explore Disney Lorcana deck archetypes for Core format: ramp, discard, tribal packages, and more, each with the cards that power it and community-voted synergies."
        canonicalPath="/playstyles"
      />
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
        <PlaystylesAbout padding={layout.aboutPadding} />
      </div>
    </main>
  );
}
