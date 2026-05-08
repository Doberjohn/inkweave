import {useState} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {SynergyGroup} from './SynergyGroup';
import {SynergyToolbar} from './SynergyToolbar';
import type {SynergySortOrder} from '../../../shared/constants';
import {filterSynergyCards, EMPTY_SYNERGY_FILTERS, applySynergySortOrder} from '../utils';
import type {SynergyFilterState} from '../utils/filterSynergyCards';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {AbilityCallout, AbilityTag, BackLink} from '../../../shared/components';

interface ExpandedGroupViewProps {
  group: SynergyGroupData;
  isMobile?: boolean;
  onBackToAll: () => void;
  onCardClick?: (card: LorcanaCard, groupKey?: string) => void;
}

/** Shared expanded view for a single synergy group: back link, title, description, toolbar, full card grid. */
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
  const filteredSynergies = (() => {
    const filtered = filterSynergyCards(group.synergies, filterState);
    return applySynergySortOrder(filtered, sortOrder);
  })();

  // Build a virtual group with filtered synergies for the SynergyGroup component
  const filteredGroup = {...group, synergies: filteredSynergies};

  // Reset filters and sort order before navigating back
  const handleBackToAll = () => {
    setFilterState(EMPTY_SYNERGY_FILTERS);
    setSortOrder('ink-cost');
    onBackToAll();
  };

  return (
    <div data-expanded-group={group.groupKey}>
      {/* Back navigation */}
      <BackLink onClick={handleBackToAll} label="Back to all synergies" />

      {/* Lorcana ability box: page-size tag at top-left + cream callout below */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginBottom: `${SPACING.lg}px`,
        }}>
        <h2 style={{margin: 0, lineHeight: 1}}>
          <AbilityTag variant="page">{group.label}</AbilityTag>
        </h2>
        <div style={{alignSelf: 'stretch'}}>
          <AbilityCallout variant="stacked-after-tag">{group.description}</AbilityCallout>
        </div>
      </div>

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

      {/* Full card grid (no truncation) */}
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
