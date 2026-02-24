import type {Ink, SetInfo} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards';
import type {CardTypeFilter} from '../constants/theme';
import {
  INK_COLORS,
  ALL_INKS,
  CARD_TYPE_FILTERS,
  COST_BUTTONS,
  COLORS,
  SELECT_STYLE_MD,
} from '../constants';
import {CostIcon} from './CostIcon';
import {FilterButton} from './FilterButton';
import {FilterSection} from './FilterSection';
import {InkIcon} from './InkIcon';

interface FilterContentProps {
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: SetInfo[];
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardTypeFilter) => void;
  onToggleCost: (cost: number) => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  /** Layout variant controls icon sizing and flex layout per section */
  variant: 'desktop' | 'mobile';
}

/**
 * Shared filter sections rendered identically in FilterModal (desktop) and
 * FilterDrawer (mobile). Only layout tuning differs between variants.
 */
export function FilterContent({
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  sets,
  onToggleInk,
  onToggleType,
  onToggleCost,
  onFiltersChange,
  variant,
}: FilterContentProps) {
  const updateFilter = <K extends keyof CardFilterOptions>(key: K, value: CardFilterOptions[K]) => {
    const newFilters = {...filters};
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const isDesktop = variant === 'desktop';
  const inkSize = isDesktop ? 'md' : 'sm';
  const inkIconSize = isDesktop ? 36 : 30;

  return (
    <>
      {/* Ink Filter */}
      <FilterSection label={isDesktop ? 'Ink Color' : 'Ink'}>
        <div role="group" aria-label="Ink color filters" style={{display: 'flex', flexWrap: isDesktop ? 'wrap' : 'nowrap', justifyContent: 'space-evenly'}}>
          {ALL_INKS.map((ink) => (
            <FilterButton
              key={ink}
              size={inkSize}
              active={inkFilters.includes(ink)}
              onClick={() => onToggleInk(ink)}
              activeColor={INK_COLORS[ink].border}
              activeBgColor={INK_COLORS[ink].bg}
              inactiveColor="transparent"
              inactiveTextColor="transparent"
              aria-label={`Filter by ${ink}`}>
              <InkIcon ink={ink} size={inkIconSize} decorative={false} />
            </FilterButton>
          ))}
        </div>
      </FilterSection>

      {/* Ink Cost */}
      <FilterSection label="Ink Cost">
        <div role="group" aria-label="Ink cost filters" style={{display: 'flex', gap: '6px', flexWrap: 'wrap', ...(isDesktop ? {} : {justifyContent: 'center'})}}>
          {COST_BUTTONS.map((cost) => (
            <FilterButton
              key={cost}
              size="sm"
              active={costFilters.includes(cost)}
              onClick={() => onToggleCost(cost)}
              activeColor={COLORS.primary}
              activeBgColor={COLORS.primary200}
              inactiveColor="transparent"
              inactiveTextColor="transparent"
              aria-label={`Cost ${cost}${cost === 10 ? '+' : ''}`}>
              <CostIcon cost={cost} size={34} />
            </FilterButton>
          ))}
        </div>
      </FilterSection>

      {/* Card Type Filter */}
      <FilterSection label={isDesktop ? 'Card Type' : 'Type'}>
        <div role="group" aria-label="Card type filters" style={{display: 'flex', gap: isDesktop ? '8px' : undefined, flexWrap: 'wrap', justifyContent: isDesktop ? undefined : 'space-evenly'}}>
          {CARD_TYPE_FILTERS.map((type) => (
            <FilterButton
              key={type}
              size="md"
              active={typeFilters.includes(type)}
              onClick={() => onToggleType(type)}
              activeColor={COLORS.primary500}
              activeBgColor={COLORS.primary200}>
              {type}
            </FilterButton>
          ))}
        </div>
      </FilterSection>

      {/* Keywords */}
      <FilterSection label={isDesktop ? 'Keywords' : 'Keyword'}>
        <select
          aria-label="Filter by keyword"
          value={filters.keywords?.[0] ?? ''}
          onChange={(e) =>
            updateFilter('keywords', e.target.value ? [e.target.value] : undefined)
          }
          style={{...SELECT_STYLE_MD, width: '100%'}}>
          <option value="">Any keyword</option>
          {uniqueKeywords.map((kw) => (
            <option key={kw} value={kw}>
              {kw}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* Classification */}
      <FilterSection label="Classification">
        <select
          aria-label="Filter by classification"
          value={filters.classifications?.[0] ?? ''}
          onChange={(e) =>
            updateFilter('classifications', e.target.value ? [e.target.value] : undefined)
          }
          style={{...SELECT_STYLE_MD, width: '100%'}}>
          <option value="">Any classification</option>
          {uniqueClassifications.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* Set */}
      <FilterSection label="Set">
        <select
          aria-label="Filter by set"
          value={filters.setCode ?? ''}
          onChange={(e) => updateFilter('setCode', e.target.value || undefined)}
          style={{...SELECT_STYLE_MD, width: '100%'}}>
          <option value="">Any set</option>
          {sets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </FilterSection>
    </>
  );
}
