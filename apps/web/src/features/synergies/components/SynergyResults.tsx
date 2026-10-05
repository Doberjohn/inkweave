import {useState, type CSSProperties} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {CardDetail, SynergyGroup} from '.';
import {ExpandedGroupView} from './ExpandedGroupView';
import {Chip, RenderProfiler} from '../../../shared/components';
import {SortSelect} from '../../../shared/components/SortSelect';
import type {SynergySortOrder} from '../../../shared/constants';
import {
  COLORS,
  FONT_SIZES,
  LETTER_SPACING,
  SPACING,
  RADIUS,
  SYNERGY_SORT_OPTIONS,
} from '../../../shared/constants';

interface SynergyResultsProps {
  selectedCard: LorcanaCard;
  synergies: SynergyGroupData[];
  totalSynergyCount: number;
  onClearSelection: () => void;
  isMobile: boolean;
  /** When false, CardDetail is rendered externally (CardPage's desktop CardDetailPanel). */
  showCardDetail: boolean;
  /** Group filter (null = All). CardPage owns it so its desktop CardDetailPanel can set it too. */
  activeGroupFilter: string | null;
  onGroupFilterChange: (groupKey: string | null) => void;
  /** When set, render single-group expanded view instead of multi-group list */
  expandedGroup: string | null;
  /** Called when user clicks "+N more" tile on a group */
  onShowAll: (groupKey: string) => void;
  /** Called when user clicks "← Back to all synergies" in expanded view */
  onBackToAll: () => void;
  /** Called when a synergy card tile is clicked (CardPage navigates to that card's page) */
  onSynergyCardClick: (card: LorcanaCard, groupKey?: string) => void;
}

/**
 * Section chrome. The section flows in the card page's document scroll, with no max-height or
 * overflow of its own, so the page and its footer scroll together.
 */
function buildSectionStyle(isMobile: boolean): CSSProperties {
  return {
    flex: 1,
    // Flex item of CardPage's <main>: min-width:auto would let the nowrap mobile chip row widen the
    // whole section (and page) instead of scrolling inside its own overflow box (#631).
    minWidth: 0,
    padding: isMobile ? `${SPACING.md}px` : `${SPACING.xl}px`,
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
      data-testid="synergy-group-toolbar"
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
  onShowAll: (groupKey: string) => void;
  onSynergyCardClick: (card: LorcanaCard, groupKey?: string) => void;
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
}: ResultsBodyProps) {
  const visibleGroups = activeGroupFilter
    ? synergies.filter((g) => g.groupKey === activeGroupFilter)
    : synergies;

  return (
    <>
      {renderCardDetail && (
        // The card page owns the document's single h1 (#524).
        <CardDetail card={selectedCard} onClear={onClearSelection} headingLevel="h1" />
      )}
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
                group.category === 'playstyle' ? `/playstyles/${group.groupKey}` : undefined
              }
            />
          ))}
        </>
      )}
    </>
  );
}

/** Chooses between the single-group expanded view and the default results body. */
function SynergyResultsContent(
  props: SynergyResultsProps & {
    sortOrder: SynergySortOrder;
    setSortOrder: (order: SynergySortOrder) => void;
  },
) {
  const {selectedCard, synergies, expandedGroup, onBackToAll, isMobile, onSynergyCardClick} = props;

  const expandedGroupData = expandedGroup
    ? synergies.find((g) => g.groupKey === expandedGroup)
    : null;
  if (expandedGroupData) {
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
      renderCardDetail={props.showCardDetail}
      activeGroupFilter={props.activeGroupFilter}
      setActiveGroupFilter={props.onGroupFilterChange}
      sortOrder={props.sortOrder}
      setSortOrder={props.setSortOrder}
      onShowAll={props.onShowAll}
      onSynergyCardClick={onSynergyCardClick}
    />
  );
}

export function SynergyResults(props: SynergyResultsProps) {
  const [sortOrder, setSortOrder] = useState<SynergySortOrder>('ink-cost');

  return (
    <RenderProfiler id="SynergyResults">
      <section aria-label="Synergy results" style={buildSectionStyle(props.isMobile)}>
        <SynergyResultsContent {...props} sortOrder={sortOrder} setSortOrder={setSortOrder} />
      </section>
    </RenderProfiler>
  );
}
