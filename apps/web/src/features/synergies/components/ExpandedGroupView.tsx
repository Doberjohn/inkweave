import {useState, useMemo, useCallback} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {SynergyGroup} from './SynergyGroup';
import {SynergyToolbar} from './SynergyToolbar';
import type {SynergySortOrder} from '../../../shared/constants';
import {filterSynergyCards, EMPTY_SYNERGY_FILTERS, applySynergySortOrder} from '../utils';
import type {SynergyFilterState} from '../utils/filterSynergyCards';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {BackLink, Callout} from '../../../shared/components';

interface ExpandedGroupViewProps {
  group: SynergyGroupData;
  isMobile?: boolean;
  onBackToAll: () => void;
  onCardClick?: (card: LorcanaCard) => void;
}

/** Shared expanded view for a single synergy group — back link, title, description, toolbar, full card grid. */
export function ExpandedGroupView({
  group,
  isMobile = false,
  onBackToAll,
  onCardClick,
}: ExpandedGroupViewProps) {
  const [filterState, setFilterState] = useState<SynergyFilterState>(EMPTY_SYNERGY_FILTERS);
  const [sortOrder, setSortOrder] = useState<SynergySortOrder>('ink-cost');
  const {uniqueKeywords, uniqueClassifications, sets} = useCardDataContext();

  // Filter then sort synergies
  const filteredSynergies = useMemo(() => {
    const filtered = filterSynergyCards(group.synergies, filterState);
    return applySynergySortOrder(filtered, sortOrder);
  }, [group.synergies, filterState, sortOrder]);

  // Build a virtual group with filtered synergies for the SynergyGroup component
  const filteredGroup = useMemo(
    () => ({...group, synergies: filteredSynergies}),
    [group, filteredSynergies],
  );

  // Reset filters and sort order before navigating back
  const handleBackToAll = useCallback(() => {
    setFilterState(EMPTY_SYNERGY_FILTERS);
    setSortOrder('ink-cost');
    onBackToAll();
  }, [onBackToAll]);

  return (
    <div data-expanded-group={group.groupKey}>
      {/* Back navigation */}
      <BackLink onClick={handleBackToAll} label="Back to all synergies" />

      {/* Group title */}
      <h2
        style={{
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: 0,
          marginBottom: `${SPACING.sm}px`,
          color: COLORS.text,
        }}>
        {group.label}
      </h2>

      {/* Description callout */}
      <Callout>{group.description}</Callout>

      {/* Toolbar with filters + sort */}
      <SynergyToolbar
        filterState={filterState}
        onFilterChange={setFilterState}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        isMobile={isMobile}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
      />

      {/* Full card grid — no truncation */}
      {filteredSynergies.length === 0 && filterState !== EMPTY_SYNERGY_FILTERS ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            textAlign: 'center',
            padding: `${SPACING.xxl * 2}px`,
            color: COLORS.gray400,
          }}>
          <p style={{fontSize: `${FONT_SIZES.lg}px`}}>No cards match your filters.</p>
          <p style={{fontSize: `${FONT_SIZES.base}px`, marginTop: `${SPACING.sm}px`}}>
            Try adjusting or clearing your filters.
          </p>
        </div>
      ) : (
        <SynergyGroup
          group={filteredGroup}
          isMobile={isMobile}
          maxVisibleCards={Infinity}
          showHeader={false}
          cardMinWidth={180}
          onCardClick={onCardClick}
        />
      )}
    </div>
  );
}
