import {useState, type CSSProperties} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {CardDetail, SynergyGroup} from '.';
import {ExpandedGroupView} from './ExpandedGroupView';
import {Chip, EmptyState, RenderProfiler} from '../../../shared/components';
import {SortSelect} from '../../../shared/components/SortSelect';
import type {SynergySortOrder} from '../../../shared/constants';
import {
  COLORS,
  FONT_SIZES,
  LETTER_SPACING,
  SPACING,
  RADIUS,
  LAYOUT,
  SYNERGY_SORT_OPTIONS,
} from '../../../shared/constants';

interface SynergyResultsProps {
  selectedCard: LorcanaCard | null;
  synergies: SynergyGroupData[];
  totalSynergyCount: number;
  onClearSelection: () => void;
  isMobile?: boolean;
  /** When false, CardDetail is rendered externally (e.g. CardDetailPanel). Default: true for mobile. */
  showCardDetail?: boolean;
  /** Controlled group filter. When provided, overrides internal state. */
  activeGroupFilter?: string | null;
  /** Callback when group filter changes. Required when activeGroupFilter is controlled. */
  onGroupFilterChange?: (groupKey: string | null) => void;
  /** When set, render single-group expanded view instead of multi-group list */
  expandedGroup?: string | null;
  /** Called when user clicks "+N more" tile on a group */
  onShowAll?: (groupKey: string) => void;
  /** Called when user clicks "← Back to all synergies" in expanded view */
  onBackToAll?: () => void;
  /** Called when a synergy card tile is clicked (opens detail modal) */
  onSynergyCardClick?: (card: LorcanaCard, groupKey?: string) => void;
  /** When true, flows in the page scroll (no internal max-height/overflow). Used by the full
   *  card page so the app footer is reachable; default false = modal fixed-height scroll. */
  flowInPage?: boolean;
  /** When true, each playstyle group's header renders a crawlable link to its /playstyles/:id hub
   *  page (#498 Phase 3). Set only by the full card page — the modal stays link-free. Default false. */
  linkPlaystyleHeaders?: boolean;
}

/**
 * Section chrome. In a modal the section owns its own scroll (fixed max-height + overflow); on the
 * full card page (`flowInPage`) it flows in the document so the page — and its footer — scroll instead.
 */
function buildSectionStyle(isMobile: boolean, flowInPage: boolean): CSSProperties {
  return {
    flex: 1,
    padding: isMobile ? `${SPACING.md}px` : `${SPACING.xl}px`,
    overflowY: flowInPage ? undefined : 'auto',
    maxHeight: flowInPage
      ? undefined
      : isMobile
        ? '100vh'
        : `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
    background: isMobile ? COLORS.background : undefined,
  };
}

function SynergyResultsHeader({totalSynergyCount}: {totalSynergyCount: number}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-testid="synergy-header"
      style={{
        marginBottom: `${SPACING.lg}px`,
        display: 'flex',
        alignItems: 'center',
        gap: `${SPACING.sm}px`,
      }}>
      <h2
        style={{
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: LETTER_SPACING.eyebrow,
          textTransform: 'uppercase',
          margin: 0,
        }}>
        Synergies
      </h2>
      <span
        style={{
          background: COLORS.calloutBg,
          color: COLORS.primary,
          padding: '2px 8px',
          borderRadius: `${RADIUS.sm}px`,
          fontSize: `${FONT_SIZES.xs}px`,
          fontWeight: 700,
          minWidth: 20,
          textAlign: 'center',
        }}>
        {totalSynergyCount}
      </span>
    </div>
  );
}

interface GroupToolbarProps {
  synergies: SynergyGroupData[];
  activeGroupFilter: string | null;
  setActiveGroupFilter: (groupKey: string | null) => void;
  sortOrder: SynergySortOrder;
  setSortOrder: (order: SynergySortOrder) => void;
  isMobile: boolean;
}

/** Group filter chips (only when >1 group) plus the desktop sort select. */
function SynergyGroupToolbar({
  synergies,
  activeGroupFilter,
  setActiveGroupFilter,
  sortOrder,
  setSortOrder,
  isMobile,
}: GroupToolbarProps) {
  const scrollStyle: CSSProperties = isMobile
    ? {
        overflowX: 'auto',
        flexWrap: 'nowrap',
        paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }
    : {flexWrap: 'wrap'};
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: `${SPACING.lg}px`,
        ...scrollStyle,
      }}>
      {synergies.length > 1 && (
        <>
          <Chip
            label="All"
            active={activeGroupFilter === null}
            onClick={() => setActiveGroupFilter(null)}
            isMobile={isMobile}
          />
          {synergies.map((group) => (
            <Chip
              key={group.groupKey}
              label={group.label}
              active={activeGroupFilter === group.groupKey}
              onClick={() => setActiveGroupFilter(group.groupKey)}
              isMobile={isMobile}
            />
          ))}
        </>
      )}
      {!isMobile && (
        <SortSelect
          options={SYNERGY_SORT_OPTIONS}
          value={sortOrder}
          onChange={setSortOrder}
          ariaLabel="Sort synergies"
          style={{marginLeft: 'auto'}}
        />
      )}
    </div>
  );
}

function NoSynergiesNotice() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        textAlign: 'center',
        padding: `${SPACING.xxl * 2}px`,
        color: COLORS.gray400,
      }}>
      <p>No synergies found for this card.</p>
      <p style={{fontSize: `${FONT_SIZES.base}px`, marginTop: `${SPACING.sm}px`}}>
        Try a card with Singer, Shift, Evasive, or Bodyguard.
      </p>
    </div>
  );
}

interface ResultsBodyProps {
  selectedCard: LorcanaCard;
  synergies: SynergyGroupData[];
  totalSynergyCount: number;
  onClearSelection: () => void;
  isMobile: boolean;
  renderCardDetail: boolean;
  activeGroupFilter: string | null;
  setActiveGroupFilter: (groupKey: string | null) => void;
  sortOrder: SynergySortOrder;
  setSortOrder: (order: SynergySortOrder) => void;
  onShowAll?: (groupKey: string) => void;
  onSynergyCardClick?: (card: LorcanaCard, groupKey?: string) => void;
  linkPlaystyleHeaders?: boolean;
}

/** The default (non-expanded) view: optional card detail, then either the empty notice or the
 *  sorted, filterable group list with its header and toolbar. */
function SynergyResultsBody({
  selectedCard,
  synergies,
  totalSynergyCount,
  onClearSelection,
  isMobile,
  renderCardDetail,
  activeGroupFilter,
  setActiveGroupFilter,
  sortOrder,
  setSortOrder,
  onShowAll,
  onSynergyCardClick,
  linkPlaystyleHeaders,
}: ResultsBodyProps) {
  const visibleGroups = activeGroupFilter
    ? synergies.filter((g) => g.groupKey === activeGroupFilter)
    : synergies;

  return (
    <>
      {renderCardDetail && <CardDetail card={selectedCard} onClear={onClearSelection} />}
      {synergies.length === 0 ? (
        <NoSynergiesNotice />
      ) : (
        <>
          <SynergyResultsHeader totalSynergyCount={totalSynergyCount} />
          <SynergyGroupToolbar
            synergies={synergies}
            activeGroupFilter={activeGroupFilter}
            setActiveGroupFilter={setActiveGroupFilter}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            isMobile={isMobile}
          />
          {visibleGroups.map((group) => (
            <SynergyGroup
              key={group.groupKey}
              group={group}
              isMobile={isMobile}
              maxVisibleCards={isMobile ? 5 : 12}
              onShowAll={onShowAll}
              onCardClick={onSynergyCardClick}
              sortOrder={sortOrder}
              playstyleHref={
                linkPlaystyleHeaders && group.category === 'playstyle'
                  ? `/playstyles/${group.groupKey}`
                  : undefined
              }
            />
          ))}
        </>
      )}
    </>
  );
}

/** Chooses between the empty state, the single-group expanded view, and the default results body. */
function SynergyResultsContent(
  props: SynergyResultsProps & {
    activeGroupFilter: string | null;
    setActiveGroupFilter: (groupKey: string | null) => void;
    sortOrder: SynergySortOrder;
    setSortOrder: (order: SynergySortOrder) => void;
  },
) {
  const {selectedCard, synergies, expandedGroup, onBackToAll, isMobile = false, onSynergyCardClick} =
    props;

  if (!selectedCard) {
    return (
      <EmptyState
        title="Select a card to see synergies"
        subtitle='Try "Elsa" or filter by Amethyst'
      />
    );
  }

  const expandedGroupData = expandedGroup
    ? synergies.find((g) => g.groupKey === expandedGroup)
    : null;
  if (expandedGroupData && onBackToAll) {
    return (
      <ExpandedGroupView
        key={expandedGroupData.groupKey}
        group={expandedGroupData}
        isMobile={isMobile}
        onBackToAll={onBackToAll}
        onCardClick={onSynergyCardClick}
      />
    );
  }

  return (
    <SynergyResultsBody
      selectedCard={selectedCard}
      synergies={synergies}
      totalSynergyCount={props.totalSynergyCount}
      onClearSelection={props.onClearSelection}
      isMobile={isMobile}
      renderCardDetail={props.showCardDetail ?? isMobile}
      activeGroupFilter={props.activeGroupFilter}
      setActiveGroupFilter={props.setActiveGroupFilter}
      sortOrder={props.sortOrder}
      setSortOrder={props.setSortOrder}
      onShowAll={props.onShowAll}
      onSynergyCardClick={onSynergyCardClick}
      linkPlaystyleHeaders={props.linkPlaystyleHeaders}
    />
  );
}

export function SynergyResults(props: SynergyResultsProps) {
  const {
    isMobile = false,
    activeGroupFilter: controlledFilter,
    onGroupFilterChange,
    flowInPage = false,
  } = props;
  const [internalFilter, setInternalFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SynergySortOrder>('ink-cost');

  // Support both controlled (from CardPage) and uncontrolled (standalone) modes
  const activeGroupFilter = controlledFilter !== undefined ? controlledFilter : internalFilter;
  const setActiveGroupFilter = onGroupFilterChange ?? setInternalFilter;

  return (
    <RenderProfiler id="SynergyResults">
      <section aria-label="Synergy results" style={buildSectionStyle(isMobile, flowInPage)}>
        <SynergyResultsContent
          {...props}
          activeGroupFilter={activeGroupFilter}
          setActiveGroupFilter={setActiveGroupFilter}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
        />
      </section>
    </RenderProfiler>
  );
}
