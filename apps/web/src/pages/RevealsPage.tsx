import {useEffect, useState} from 'react';
import type {CardPrinting, Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CompactHeader, ErrorBoundary, EtherealBackground, Seo} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, REVEAL_SET_CODE, REVEAL_SET_NUMBER, SET_NAMES, SPACING, VISUALLY_HIDDEN} from '../shared/constants';
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
  mosaicOrder,
  specialsOrder,
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
// Spacing past the scale's top step (SPACING.xxxl, 32): the gap above What's new, and the room
// under the page.
const WHATS_NEW_GAP = 64;
const PAGE_PADDING_BOTTOM = 110;

function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString('en-US', {month: 'long', day: 'numeric'});
}

/** The revealed cards for a franchise (empty when none is selected). */
function cardsForFranchise(tiers: RevealTier[], franchise: FranchiseConfig | null): LorcanaCard[] {
  if (!franchise) return [];
  return tiers.find((t) => t.id === franchise.id)?.cards ?? [];
}

/**
 * What the card modal's arrows step through (owner, 2026-10-08): the cards of the group the
 * card was clicked in, in the order it shows them, and the printing each opens on.
 */
interface ModalSiblings {
  ids: string[];
  printingFor?: (cardId: string) => string | undefined;
}

const siblingsOf = (cards: LorcanaCard[]): ModalSiblings => ({ids: cards.map((card) => card.id)});

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
  onOpenPrinting: (card: LorcanaCard, printing: CardPrinting) => void;
  onSelectFranchise: (franchise: FranchiseConfig) => void;
  compact: boolean;
}

/**
 * The page body below the hero: an error/loading message, or the tracker (ink
 * strip + featured board + new-franchises). Early returns keep its branches off
 * RevealsPage.
 */
function RevealsBody({loading, error, progress, selectedInk, onSelectInk, onOpen, onOpenPrinting, onSelectFranchise, compact}: RevealsBodyProps) {
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
        <InkBoard
          key={selectedInk}
          progress={progress.byInk[selectedInk]}
          onOpen={onOpen}
          onOpenPrinting={onOpenPrinting}
          compact={compact}
        />
      </div>
      <div style={{marginTop: WHATS_NEW_GAP}}>
        <WhatsNewSection onSelectFranchise={onSelectFranchise} compact={compact} />
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

  const countdown = useCountdown(dates);
  const releaseDate = dates ? formatReleaseDate(dates.releaseDate) : '';
  // A special printing opens the modal on that printing, and reports its rarity.
  const openAndTrack = (
    card: LorcanaCard,
    source: 'mosaic' | 'franchise_modal' | 'special_printings',
    siblings: ModalSiblings,
    printing?: CardPrinting,
  ) => {
    trackEvent('reveal_card_click', {
      cardName: card.fullName,
      cardId: card.id,
      source,
      ink: card.ink,
      type: card.type,
      rarity: printing?.rarity ?? card.rarity ?? null,
      franchise: card.franchise ?? null,
    });
    openCardModal(card.id, siblings.ids, {printingId: printing?.id, printingFor: siblings.printingFor});
  };
  // The board on show: its mosaic and its special printings are the arrows' two groups.
  const board = progress.byInk[selectedInk];
  const sidePad = isMobile ? SPACING.lg : 36;

  return (
    <ErrorBoundary>
      <Seo
        title={`${SET_NAMES[REVEAL_SET_CODE]} (Set ${REVEAL_SET_NUMBER}) Card Reveals | Inkweave`}
        description={`Every Disney Lorcana ${SET_NAMES[REVEAL_SET_CODE]} card revealed so far, tracked by ink with synergies for each new card.`}
        canonicalPath="/reveals"
        // Deliberately unindexed: the page is live for a few weeks a year and redirects
        // to '/' the rest, and reveal card ids are renumbered when the set graduates, so
        // anything indexed now becomes a dead URL at rotation. The tags exist for link
        // unfurls and for the page to stop claiming to be the homepage, not for search.
        noindex
      />
      <EtherealBackground />
      <CompactHeader isMobile={isMobile} />
      <main
        style={{
          minHeight: '100vh',
          paddingTop: SPACING.lg,
          paddingBottom: PAGE_PADDING_BOTTOM,
          position: 'relative',
          zIndex: 1,
        }}>
        <h1 style={VISUALLY_HIDDEN}>
          {SET_NAMES[REVEAL_SET_CODE]}: Set {REVEAL_SET_NUMBER} reveals
        </h1>
        <div style={{maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto', padding: `0 ${sidePad}px`}}>
          <RevealHero
            countdown={countdown}
            releaseDate={releaseDate}
            totalRevealed={loading ? null : progress.totalRevealed}
            franchiseCount={FRANCHISES.length}
            compact={isMobile}
          />
          <RevealsBody
            loading={loading}
            error={error}
            progress={progress}
            selectedInk={selectedInk}
            onSelectInk={selectInk}
            onOpen={(card) => openAndTrack(card, 'mosaic', siblingsOf(mosaicOrder(selectedInk, board.cards)))}
            onOpenPrinting={(card, printing) =>
              openAndTrack(card, 'special_printings', specialsOrder(board.specials), printing)
            }
            onSelectFranchise={(f) => setShowcase({label: f.label, ink: f.ink, cards: cardsForFranchise(tiers, f)})}
            compact={isMobile}
          />
        </div>
      </main>

      {showcase && (
        <FranchiseCardsModal
          source={{label: showcase.label, ink: showcase.ink}}
          cards={showcase.cards}
          onClose={() => setShowcase(null)}
          onCardClick={(card) => openAndTrack(card, 'franchise_modal', siblingsOf(showcase.cards))}
        />
      )}
    </ErrorBoundary>
  );
}
