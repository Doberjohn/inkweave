import {useState} from 'react';
import {Link} from 'react-router-dom';
import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import type {LorcanaCard} from '../../cards';
import {CardDetailSkeleton, CardGridSkeleton} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {SynergyGroup} from './SynergyGroup';
import {ExpandedGroupView} from './ExpandedGroupView';
import {CardImage, CardLightbox, Chip} from '../../../shared/components';
import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';

interface MobileCardDetailProps {
  card?: LorcanaCard | null;
  synergies?: SynergyGroupData[];
  onBack: () => void;
  onSynergyCardClick?: (card: LorcanaCard) => void;
  /** When true, renders the mobile shell with skeleton placeholders instead of real card data. */
  isLoading?: boolean;
}

// ── Module helpers ──

function filterGroups(
  synergies: SynergyGroupData[],
  activeGroupFilter: string | null,
): SynergyGroupData[] {
  if (!activeGroupFilter) return synergies;
  return synergies.filter((g) => g.groupKey === activeGroupFilter);
}

function shouldShowLightbox(
  isLoading: boolean,
  imageUrl: string | undefined,
  lightboxOpen: boolean,
): boolean {
  return !isLoading && !!imageUrl && lightboxOpen;
}

// ── Sub-components ──

function EtherealOrb() {
  return (
    <div
      style={{
        position: 'absolute',
        top: -50,
        left: -80,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}
    />
  );
}

function MobileTopBar({onBack}: {onBack: () => void}) {
  return (
    <div
      style={{
        height: 48,
        background: 'linear-gradient(180deg, #0d0d14 0%, #1a1a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: SPACING.lg,
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
        position: 'sticky',
        top: 0,
        zIndex: 902,
      }}>
      <button
        onClick={onBack}
        aria-label="Back to home"
        style={{
          background: 'none',
          border: 'none',
          color: COLORS.primary500,
          fontSize: FONT_SIZES.md,
          fontWeight: 700,
          letterSpacing: '0.96px',
          cursor: 'pointer',
          padding: `${SPACING.sm}px 0`,
          fontFamily: FONTS.body,
        }}>
        INKWEAVE
      </button>
    </div>
  );
}

function MobileLoadingView() {
  return (
    <>
      <CardDetailSkeleton imageWidth={220} textLines={2} padding={0} ariaLabel="Loading card detail" />
      <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: `${SPACING.lg}px 0 ${SPACING.sm}px`,
          }}>
          <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
          <Skeleton width={90} height={20} borderRadius={RADIUS.sm} />
          <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
        </div>
        {[0, 1].map((i) => (
          <div key={i} style={{marginBottom: SPACING.lg}}>
            <Skeleton width="45%" height={16} borderRadius={RADIUS.sm} />
            <div style={{marginTop: SPACING.sm}}>
              <CardGridSkeleton columns={3} rows={1} padding="0" gap={SPACING.sm} />
            </div>
          </div>
        ))}
      </SkeletonTheme>
    </>
  );
}

function CardImageButton({card, onOpen}: {card: LorcanaCard; onOpen: () => void}) {
  return (
    <div style={{display: 'flex', justifyContent: 'center', marginBottom: SPACING.lg}}>
      <button
        aria-label="Enlarge card image"
        onClick={onOpen}
        style={{
          border: 'none',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          padding: 0,
          background: 'none',
        }}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={220}
          height={308}
          inkColor={card.ink}
          cost={card.cost}
          lazy={false}
          borderRadius={10}
        />
      </button>
    </div>
  );
}

function CardTitle({card}: {card: LorcanaCard}) {
  return (
    <>
      <h1
        style={{
          textAlign: 'center',
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          color: COLORS.text,
          margin: 0,
          lineHeight: 1.2,
        }}>
        <Link
          to={`/browse?q=${encodeURIComponent(card.name)}`}
          style={{
            color: 'inherit',
            textDecoration: 'underline',
            textDecorationColor: COLORS.surfaceBorder,
            textUnderlineOffset: '3px',
          }}>
          {card.name}
        </Link>
      </h1>
      {card.version && (
        <div
          style={{
            textAlign: 'center',
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.textMuted,
            marginTop: 3,
          }}>
          {card.version}
        </div>
      )}
    </>
  );
}

function SynergiesSectionHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: `${SPACING.lg}px 0 ${SPACING.sm}px`,
      }}>
      <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
      <h2
        style={{
          margin: 0,
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: COLORS.text,
        }}>
        Synergies
      </h2>
      <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
    </div>
  );
}

function SynergyGroupChips({
  synergies,
  activeGroupFilter,
  onChange,
}: {
  synergies: SynergyGroupData[];
  activeGroupFilter: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        marginBottom: SPACING.lg,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
      <Chip label="All" active={activeGroupFilter === null} onClick={() => onChange(null)} isMobile />
      {synergies.map((g) => (
        <Chip
          key={g.groupKey}
          label={g.label}
          active={activeGroupFilter === g.groupKey}
          onClick={() => onChange(g.groupKey)}
          isMobile
        />
      ))}
    </div>
  );
}

function SynergyGroupsList({
  synergies,
  filteredGroups,
  activeGroupFilter,
  onActiveGroupFilterChange,
  onShowAll,
  onSynergyCardClick,
}: {
  synergies: SynergyGroupData[];
  filteredGroups: SynergyGroupData[];
  activeGroupFilter: string | null;
  onActiveGroupFilterChange: (key: string | null) => void;
  onShowAll: (key: string) => void;
  onSynergyCardClick?: (card: LorcanaCard) => void;
}) {
  return (
    <>
      <SynergiesSectionHeader />
      {synergies.length > 1 && (
        <SynergyGroupChips
          synergies={synergies}
          activeGroupFilter={activeGroupFilter}
          onChange={onActiveGroupFilterChange}
        />
      )}
      {filteredGroups.map((group) => (
        <SynergyGroup
          key={group.groupKey}
          group={group}
          isMobile
          maxVisibleCards={5}
          onShowAll={onShowAll}
          onCardClick={onSynergyCardClick}
        />
      ))}
    </>
  );
}

function EmptySynergies() {
  return (
    <p
      style={{
        textAlign: 'center',
        fontSize: FONT_SIZES.base,
        color: COLORS.textMuted,
        margin: `${SPACING.xxl}px 0`,
      }}>
      No synergies found for this card.
    </p>
  );
}

function MobileSynergiesArea({
  synergies,
  filteredGroups,
  expandedGroupData,
  activeGroupFilter,
  onActiveGroupFilterChange,
  onShowAll,
  onBackToAll,
  onSynergyCardClick,
}: {
  synergies: SynergyGroupData[];
  filteredGroups: SynergyGroupData[];
  expandedGroupData: SynergyGroupData | null | undefined;
  activeGroupFilter: string | null;
  onActiveGroupFilterChange: (key: string | null) => void;
  onShowAll: (key: string) => void;
  onBackToAll: () => void;
  onSynergyCardClick?: (card: LorcanaCard) => void;
}) {
  if (synergies.length === 0) return <EmptySynergies />;
  if (expandedGroupData) {
    return (
      <div style={{marginTop: SPACING.lg}}>
        <ExpandedGroupView
          group={expandedGroupData}
          isMobile
          onBackToAll={onBackToAll}
          onCardClick={onSynergyCardClick}
        />
      </div>
    );
  }
  return (
    <SynergyGroupsList
      synergies={synergies}
      filteredGroups={filteredGroups}
      activeGroupFilter={activeGroupFilter}
      onActiveGroupFilterChange={onActiveGroupFilterChange}
      onShowAll={onShowAll}
      onSynergyCardClick={onSynergyCardClick}
    />
  );
}

function MobileCardContent({
  card,
  synergies,
  filteredGroups,
  expandedGroupData,
  activeGroupFilter,
  onActiveGroupFilterChange,
  onShowAll,
  onBackToAll,
  onSynergyCardClick,
  onLightboxOpen,
}: {
  card: LorcanaCard;
  synergies: SynergyGroupData[];
  filteredGroups: SynergyGroupData[];
  expandedGroupData: SynergyGroupData | null | undefined;
  activeGroupFilter: string | null;
  onActiveGroupFilterChange: (key: string | null) => void;
  onShowAll: (key: string) => void;
  onBackToAll: () => void;
  onSynergyCardClick?: (card: LorcanaCard) => void;
  onLightboxOpen: () => void;
}) {
  const handleImageOpen = () => {
    if (card.imageUrl) onLightboxOpen();
  };
  return (
    <>
      <CardImageButton card={card} onOpen={handleImageOpen} />
      <CardTitle card={card} />
      <MobileSynergiesArea
        synergies={synergies}
        filteredGroups={filteredGroups}
        expandedGroupData={expandedGroupData}
        activeGroupFilter={activeGroupFilter}
        onActiveGroupFilterChange={onActiveGroupFilterChange}
        onShowAll={onShowAll}
        onBackToAll={onBackToAll}
        onSynergyCardClick={onSynergyCardClick}
      />
    </>
  );
}

/** Mobile-only card detail view with inline synergy groups. */
export function MobileCardDetail({
  card,
  synergies = [],
  onBack,
  onSynergyCardClick,
  isLoading = false,
}: MobileCardDetailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const filteredGroups = filterGroups(synergies, activeGroupFilter);
  const expandedGroupData = expandedGroup
    ? synergies.find((g) => g.groupKey === expandedGroup)
    : null;
  const showLoading = isLoading || !card;

  const handleShowAll = (groupKey: string) => {
    setExpandedGroup(groupKey);
    setActiveGroupFilter(groupKey);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-expanded-group="${groupKey}"]`)
        ?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  };

  const handleBackToAll = () => {
    setExpandedGroup(null);
    setActiveGroupFilter(null);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
        overflowX: 'hidden',
      }}>
      <EtherealOrb />
      <MobileTopBar onBack={onBack} />
      <div style={{position: 'relative', zIndex: 1, padding: `${SPACING.lg}px`}}>
        {showLoading ? (
          <MobileLoadingView />
        ) : (
          <MobileCardContent
            card={card}
            synergies={synergies}
            filteredGroups={filteredGroups}
            expandedGroupData={expandedGroupData}
            activeGroupFilter={activeGroupFilter}
            onActiveGroupFilterChange={setActiveGroupFilter}
            onShowAll={handleShowAll}
            onBackToAll={handleBackToAll}
            onSynergyCardClick={onSynergyCardClick}
            onLightboxOpen={() => setLightboxOpen(true)}
          />
        )}
      </div>

      {shouldShowLightbox(isLoading, card?.imageUrl, lightboxOpen) && card?.imageUrl && (
        <CardLightbox
          src={card.imageUrl}
          alt={card.fullName}
          isLocation={card.type === 'Location'}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  );
}
