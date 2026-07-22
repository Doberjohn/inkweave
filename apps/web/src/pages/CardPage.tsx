import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {cardPath, type LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {usePrecomputedSynergies} from '../features/synergies/hooks';
import {cardSynergySummary} from '../features/synergies/cardSynergySummary';
import {CardDetailPanel} from '../features/synergies/components/CardDetailPanel';
import {CardDetailSkeleton} from '../features/cards';
import {SynergyResults} from '../features/synergies/components/SynergyResults';
import {CompactHeader, Footer, Seo} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, SPACING} from '../shared/constants';

/**
 * `/card/:cardId` — a real, crawlable card detail page (issue #486).
 *
 * Reuses the synergy modal's desktop composition — CardDetailPanel (left) + SynergyResults
 * (right, showCardDetail=false) — as a full page instead of a modal overlay. Clicking a
 * synergy partner navigates to that partner's own card page (rather than opening the modal
 * comparison view), turning the synergy graph into a page-to-page link graph.
 */

function buildDescription(card: LorcanaCard): string {
  const inks = card.ink2 ? `${card.ink}/${card.ink2}` : card.ink;
  const cls = card.classifications?.length ? ` ${card.classifications.join(', ')}` : '';
  return `${card.fullName}: a ${card.cost}-cost ${inks} ${card.type}${cls}. See its strongest Disney Lorcana synergies and combos in Core format.`;
}

function PageShell({children}: {children: React.ReactNode}) {
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
      <Footer />
    </div>
  );
}

function CenteredMessage({title, body}: {title: string; body: string}) {
  return (
    <div
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
      <h1 style={{fontFamily: FONTS.hero, fontSize: `${FONT_SIZES.xxl}px`, color: COLORS.text, margin: 0}}>
        {title}
      </h1>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`, margin: 0}}>{body}</p>
    </div>
  );
}

export function CardPage() {
  const {cardId} = useParams<{cardId: string}>();
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {getCardById, isLoading: cardsLoading} = useCardDataContext();
  const card = cardId ? getCardById(cardId) : undefined;
  const {synergies} = usePrecomputedSynergies(card ?? null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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
    if (cardsLoading) {
      // #511 loading rule: skeleton for layout-known surfaces (no text flash).
      return (
        <PageShell>
          <div style={{display: 'flex', justifyContent: 'center'}}>
            <CardDetailSkeleton ariaLabel="Loading card" />
          </div>
        </PageShell>
      );
    }
    return (
      <PageShell>
        <Seo title="Card not found | Inkweave" canonicalPath={`/card/${cardId ?? ''}`} noindex />
        <CenteredMessage title="Card not found" body="This card is not in the Core format database." />
      </PageShell>
    );
  }

  const totalCount = synergies.reduce((n, g) => n + g.synergies.length, 0);
  const summary = cardSynergySummary(card, synergies);
  const handleGroupClick = (groupKey: string) => {
    setActiveGroup((current) => (current === groupKey ? null : groupKey));
    setExpandedGroup(null);
  };

  return (
    <PageShell>
      <Seo
        title={`${card.fullName} | Lorcana Synergies | Inkweave`}
        description={summary || buildDescription(card)}
        canonicalPath={cardPath(card)}
      />
      <main style={{flex: 1, display: 'flex', alignItems: 'flex-start'}}>
        {!isMobile && (
          <div style={{position: 'sticky', top: LAYOUT.compactHeaderHeight, alignSelf: 'flex-start'}}>
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
          totalSynergyCount={totalCount}
          onClearSelection={() => navigate('/browse')}
          isMobile={isMobile}
          showCardDetail={isMobile}
          activeGroupFilter={activeGroup}
          onGroupFilterChange={setActiveGroup}
          expandedGroup={expandedGroup}
          onShowAll={setExpandedGroup}
          onBackToAll={() => setExpandedGroup(null)}
          onSynergyCardClick={(partner) => navigate(cardPath(partner))}
          flowInPage
          linkPlaystyleHeaders
        />
      </main>
    </PageShell>
  );
}

export default CardPage;
