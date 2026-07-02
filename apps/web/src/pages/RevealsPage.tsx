import {useEffect, useState} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {trackEvent} from '../shared/lib/analytics';
import {
  FRANCHISES,
  FranchiseCardsModal,
  InkBoard,
  InkTrackerStrip,
  WhatsNewSection,
  RevealHero,
  fetchRevealDates,
  useCountdown,
  useInkParam,
  useRevealCards,
  useRevealProgress,
  type FranchiseConfig,
  type RevealDates,
  type RevealProgress,
  type RevealTier,
} from '../features/reveals';

const CONTENT_MAX_WIDTH = 1180;

function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString('en-US', {month: 'long', day: 'numeric'});
}

/** The revealed cards for a franchise (empty when none is selected). */
function cardsForFranchise(tiers: RevealTier[], franchise: FranchiseConfig | null): LorcanaCard[] {
  if (!franchise) return [];
  return tiers.find((t) => t.id === franchise.id)?.cards ?? [];
}

const srOnly: React.CSSProperties = {
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

const messageStyle: React.CSSProperties = {
  padding: SPACING.lg,
  textAlign: 'center',
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.base,
};

interface RevealsBodyProps {
  loading: boolean;
  error: Error | null;
  progress: RevealProgress;
  selectedInk: Ink;
  onSelectInk: (ink: Ink) => void;
  onOpen: (card: LorcanaCard) => void;
  onSelectFranchise: (franchise: FranchiseConfig) => void;
  onSelectTeam: () => void;
  compact: boolean;
}

/**
 * The page body below the hero: an error/loading message, or the tracker (ink
 * strip + featured board + new-franchises). Early returns keep its branches off
 * RevealsPage.
 */
function RevealsBody({loading, error, progress, selectedInk, onSelectInk, onOpen, onSelectFranchise, onSelectTeam, compact}: RevealsBodyProps) {
  if (error) {
    return (
      <p role="alert" style={{...messageStyle, color: COLORS.error}}>
        Could not load reveal cards. Please try again later.
      </p>
    );
  }
  if (loading) {
    return <p style={{...messageStyle, color: COLORS.textMuted}}>Loading reveal cards…</p>;
  }
  return (
    <>
      <div style={{marginTop: SPACING.xl}}>
        <InkTrackerStrip inks={progress.inks} selected={selectedInk} onSelect={onSelectInk} compact={compact} />
      </div>
      <div style={{marginTop: SPACING.xxl}}>
        <InkBoard key={selectedInk} progress={progress.byInk[selectedInk]} onOpen={onOpen} compact={compact} />
      </div>
      <div style={{marginTop: 64}}>
        <WhatsNewSection onSelectFranchise={onSelectFranchise} onSelectTeam={onSelectTeam} compact={compact} />
      </div>
    </>
  );
}

export function RevealsPage() {
  const {isMobile} = useResponsive();
  const {tiers, loading, error} = useRevealCards();
  const progress = useRevealProgress();
  const {openCardModal} = useCardModal();
  const [dates, setDates] = useState<RevealDates | null>(null);
  const [selectedInk, selectInk] = useInkParam();
  const [showcase, setShowcase] = useState<{label: string; ink: Ink; cards: LorcanaCard[]} | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRevealDates().then((d) => {
      if (!cancelled) setDates(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const {days} = useCountdown(dates?.prereleaseDate ?? null);
  const releaseDate = dates ? formatReleaseDate(dates.releaseDate) : '';
  const openAndTrack = (card: LorcanaCard, source: 'mosaic' | 'franchise_modal') => {
    trackEvent('reveal_card_click', {
      cardName: card.fullName,
      cardId: card.id,
      source,
      ink: card.ink,
      type: card.type,
      rarity: card.rarity ?? null,
      franchise: card.franchise ?? null,
    });
    openCardModal(card.id);
  };
  const sidePad = isMobile ? SPACING.lg : 36;
  const teamCards = tiers.flatMap((t) => t.cards).filter((c) => c.classifications?.includes('Team'));

  return (
    <ErrorBoundary>
      <EtherealBackground />
      <CompactHeader isMobile={isMobile} />
      <main style={{minHeight: '100vh', paddingTop: SPACING.lg, paddingBottom: 110, position: 'relative', zIndex: 1}}>
        <h1 style={srOnly}>Attack of the Vine — Set 13 reveals</h1>
        <div style={{maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto', padding: `0 ${sidePad}px`}}>
          <RevealHero
            countdownDays={days}
            releaseDate={releaseDate}
            totalRevealed={progress.totalRevealed}
            franchiseCount={FRANCHISES.length}
            compact={isMobile}
          />
          <RevealsBody
            loading={loading}
            error={error}
            progress={progress}
            selectedInk={selectedInk}
            onSelectInk={selectInk}
            onOpen={(card) => openAndTrack(card, 'mosaic')}
            onSelectFranchise={(f) => setShowcase({label: f.label, ink: f.ink, cards: cardsForFranchise(tiers, f)})}
            onSelectTeam={() => setShowcase({label: 'Team Characters', ink: 'Ruby', cards: teamCards})}
            compact={isMobile}
          />
        </div>
      </main>

      {showcase && (
        <FranchiseCardsModal
          source={{label: showcase.label, ink: showcase.ink}}
          cards={showcase.cards}
          onClose={() => setShowcase(null)}
          onCardClick={(card) => openAndTrack(card, 'franchise_modal')}
        />
      )}
    </ErrorBoundary>
  );
}
