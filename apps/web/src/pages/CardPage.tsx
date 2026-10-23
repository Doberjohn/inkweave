import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {cardPath} from 'inkweave-synergy-engine/card';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {usePrecomputedSynergies} from '../features/synergies/hooks';
import {cardSynergySummary} from '../features/synergies/cardSynergySummary';
import {CardDetailPanel, CardDetailPanelSkeleton} from '../features/synergies/components/CardDetailPanel';
import {
  trackSynergyCardClicked,
  trackSynergyGroupViewed,
} from '../features/synergies/lib/synergyAnalytics';
import {SynergyResults, SynergyResultsLoading} from '../features/synergies/components/SynergyResults';
import {CompactHeader, Footer, Seo} from '../shared/components';
import {useBackOrNavigate, useResponsive} from '../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, SPACING} from '../shared/constants';

/**
 * `/card/:cardId` — a real, crawlable card detail page (issue #486).
 *
 * Desktop: a sticky CardDetailPanel (left) beside SynergyResults (right, showCardDetail=false);
 * on mobile, SynergyResults renders the CardDetail itself. Clicking a synergy partner navigates
 * to that partner's own card page (rather than opening the modal comparison view), turning the
 * synergy graph into a page-to-page link graph.
 */

function buildDescription(card: LorcanaCard): string {
  const inks = card.ink2 ? `${card.ink}/${card.ink2}` : card.ink;
  const cls = card.classifications?.length ? ` ${card.classifications.join(', ')}` : '';
  return `${card.fullName}: a ${card.cost}-cost ${inks} ${card.type}${cls}. See its strongest Disney Lorcana synergies and combos in Core format.`;
}

/**
 * `showFooter` is false until the page's content has loaded (#532). Rendered under a loading
 * page, the footer sits inside the viewport, and the arriving card and synergies push it past
 * the fold: that push was the card page's whole layout shift. A footer that first appears
 * below the loaded content is a new node, and new nodes aren't layout shifts.
 */
function PageShell({children, showFooter = true}: {children: React.ReactNode; showFooter?: boolean}) {
  const {isMobile} = useResponsive();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        display: 'flex',
        flexDirection: 'column',
      }}>
      <CompactHeader isMobile={isMobile} />
      {children}
      {showFooter && <Footer />}
    </div>
  );
}

/** The page's two columns: on desktop the card panel, held below the header, then the results. */
const MAIN_STYLE: React.CSSProperties = {flex: 1, display: 'flex', alignItems: 'flex-start'};
const PANEL_SLOT_STYLE: React.CSSProperties = {
  position: 'sticky',
  top: LAYOUT.compactHeaderHeight,
  alignSelf: 'flex-start',
};

/**
 * The page while the card list loads, in the loaded page's frame (#914): the card panel's
 * placeholder beside the results' on desktop, the card's block above them on a phone. A
 * skeleton, per the #511 loading rule, with no text flash.
 */
function CardPageLoading({isMobile}: {isMobile: boolean}) {
  return (
    <PageShell showFooter={false}>
      <main aria-busy="true" aria-label="Loading card" style={MAIN_STYLE}>
        {!isMobile && (
          <div style={PANEL_SLOT_STYLE}>
            <CardDetailPanelSkeleton />
          </div>
        )}
        <SynergyResultsLoading isMobile={isMobile} />
      </main>
    </PageShell>
  );
}

function CenteredMessage({title, body}: {title: string; body: string}) {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${SPACING.sm}px`,
        padding: `${SPACING.xl}px`,
        textAlign: 'center',
      }}>
      <h1 style={{fontFamily: FONTS.hero, fontWeight: 400, fontSize: `${FONT_SIZES.xxl}px`, color: COLORS.text, margin: 0}}>
        {title}
      </h1>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`, margin: 0}}>{body}</p>
    </main>
  );
}

export function CardPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {getCardById, isLoading: cardsLoading} = useCardDataContext();
  const card = cardId ? getCardById(cardId) : undefined;
  const {synergies, isLoading: synergiesLoading} = usePrecomputedSynergies(card ?? null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  // The mobile card's ×, like the card modal's: back to where the user came from inside
  // Inkweave (e.g. the card whose synergy they tapped), or Browse when they entered here.
  const closeCard = useBackOrNavigate('/browse');

  // React Router reuses this component across /card/:cardId navigations (clicking a synergy
  // partner routes here again), so the group filter/expansion would otherwise carry over from
  // the previous card and hide the new card's groups. Reset when the route card changes.
  // (Adjust-state-during-render pattern — no stale frame, unlike a useEffect.)
  const [prevCardId, setPrevCardId] = useState(cardId);
  if (cardId !== prevCardId) {
    setPrevCardId(cardId);
    setActiveGroup(null);
    setExpandedGroup(null);
  }

  if (!card) {
    if (cardsLoading) return <CardPageLoading isMobile={isMobile} />;
    return (
      <PageShell>
        <Seo title="Card not found | Inkweave" canonicalPath={`/card/${cardId ?? ''}`} noindex />
        <CenteredMessage title="Card not found" body="This card is not in the Core format database." />
      </PageShell>
    );
  }

  const totalCount = synergies.reduce((n, g) => n + g.synergies.length, 0);
  const summary = cardSynergySummary(card, synergies);
  // As in the card modal: isolating a group by its chip and expanding it by its More tile count
  // as viewing it; clearing a chip does not.
  const isolateGroup = (groupKey: string | null) => {
    if (groupKey !== null && groupKey !== activeGroup) {
      trackSynergyGroupViewed({
        sourceCardId: card.id,
        groupKey,
        action: 'isolate',
        surface: 'card_page',
      });
    }
    setActiveGroup(groupKey);
  };
  const handleGroupClick = (groupKey: string) => {
    isolateGroup(activeGroup === groupKey ? null : groupKey);
    setExpandedGroup(null);
  };
  const showAll = (groupKey: string) => {
    trackSynergyGroupViewed({
      sourceCardId: card.id,
      groupKey,
      action: 'show_all',
      surface: 'card_page',
    });
    setExpandedGroup(groupKey);
  };
  const followSynergy = (partner: LorcanaCard, groupKey?: string) => {
    trackSynergyCardClicked({
      sourceCardId: card.id,
      clicked: partner,
      groupKey,
      surface: 'card_page',
    });
    navigate(cardPath(partner));
  };

  return (
    <PageShell showFooter={!synergiesLoading}>
      <Seo
        title={`${card.fullName} | Lorcana Synergies | Inkweave`}
        description={summary || buildDescription(card)}
        canonicalPath={cardPath(card)}
      />
      <main style={MAIN_STYLE}>
        {!isMobile && (
          <div style={PANEL_SLOT_STYLE}>
            <CardDetailPanel
              card={card}
              synergies={synergies}
              activeGroupKey={activeGroup}
              onGroupClick={handleGroupClick}
            />
          </div>
        )}
        <SynergyResults
          selectedCard={card}
          synergies={synergies}
          isLoading={synergiesLoading}
          totalSynergyCount={totalCount}
          onClearSelection={closeCard}
          isMobile={isMobile}
          showCardDetail={isMobile}
          activeGroupFilter={activeGroup}
          onGroupFilterChange={isolateGroup}
          expandedGroup={expandedGroup}
          onShowAll={showAll}
          onBackToAll={() => setExpandedGroup(null)}
          onSynergyCardClick={followSynergy}
        />
      </main>
    </PageShell>
  );
}

export default CardPage;
