import {useState} from 'react';
import type {SetStateAction} from 'react';
import type {Ink} from 'inkweave-synergy-engine';
import type {SetInfo} from '../../cards';
import {countFilterOptions, offersDualOnly, type CardFilterOptions} from '../../cards/loader';
import type {CardTypeFilter, SynergySortOrder} from '../../../shared/constants';
import type {SynergyFilterState, StrengthTierFilter} from '../utils/filterSynergyCards';
import {EMPTY_SYNERGY_FILTERS, withoutStaleDualOnly} from '../utils/filterSynergyCards';
import {SYNERGY_SORT_OPTIONS, SPACING} from '../../../shared/constants';
import {CardFilterDialog} from '../../../shared/components/CardFilterDialog';
import {LinkButton} from 'inkweave-ui/components/LinkButton';
import {Chip} from 'inkweave-ui/components/Chip';
import {FiltersButton} from 'inkweave-ui/components/FiltersButton';
import {InkFilterGroup} from 'inkweave-ui/lorcana/InkFilterGroup';
import {SortSelect} from 'inkweave-ui/components/SortSelect';
import type {ChipData} from '../../../shared/types';

interface SynergyToolbarProps {
  /** Current filter state */
  filterState: SynergyFilterState;
  /** Callbacks for filter changes. Supports functional updater to avoid stale closures. */
  onFilterChange: (update: SetStateAction<SynergyFilterState>) => void;
  /** Sort state */
  sortOrder: SynergySortOrder;
  onSortChange: (order: SynergySortOrder) => void;
  /** Responsive flag */
  isMobile: boolean;
  /** Card data for filter modal options */
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueRarities: string[];
  sets: SetInfo[];
}

const STRENGTH_TIERS: StrengthTierFilter[] = ['Strong', 'Moderate', 'Weak'];

/**
 * This toolbar carries only the ink buttons inline, so the desktop modal must
 * offer cost and inkwell. Left to the dialog's default (Browse's toolbar), it hid
 * both: cost at 1580px and wider, inkwell at every desktop width.
 */
const TOOLBAR_CARRIES = {cost: false, inkwell: false};

type FilterUpdate = (update: SetStateAction<SynergyFilterState>) => void;

const toggled = <T,>(values: T[], value: T) =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

/** Modal filters only: strength is controlled by its own inline toggles. */
function countActiveFilters({inkFilters, typeFilters, costFilters, filters}: SynergyFilterState): number {
  return inkFilters.length + typeFilters.length + costFilters.length + countFilterOptions(filters);
}

/** A chip that clears one `filters` option. */
function optionChip(id: string, label: string, key: keyof CardFilterOptions, update: FilterUpdate): ChipData {
  return {id, label, onDismiss: () => update((prev) => ({...prev, filters: {...prev.filters, [key]: undefined}}))};
}

/** One chip per value of a list dimension; dismissing it removes that value. */
function listChips<T extends string | number>(
  values: T[],
  key: 'inkFilters' | 'typeFilters' | 'costFilters',
  label: (value: T) => string,
  update: FilterUpdate,
): ChipData[] {
  return values.map((value) => ({
    id: `${key}:${value}`,
    label: label(value),
    onDismiss: () => update((prev) => ({...prev, [key]: (prev[key] as T[]).filter((v) => v !== value)})),
  }));
}

/**
 * The ink modifiers. Desktop has no inline control for either, and phones only
 * reach them in the drawer, so a chip is the one place they always show.
 */
function inkModeChips({inkFilters, filters}: SynergyFilterState, update: FilterUpdate): ChipData[] {
  const chips: ChipData[] = [];
  if (filters.inkMatch === 'dual' && offersDualOnly(inkFilters.length)) {
    chips.push(optionChip('inkmatch:dual', 'Dual-ink cards', 'inkMatch', update));
  }
  if (filters.inkwell) {
    chips.push(optionChip(`inkwell:${filters.inkwell}`, filters.inkwell === 'inkable' ? 'Inkable' : 'Uninkable', 'inkwell', update));
  }
  return chips;
}

/** The modal's chip and logo options: every rarity, keyword, classification and set picked. */
function selectChips({filters}: SynergyFilterState, update: FilterUpdate): ChipData[] {
  return [
    ...traitChips(filters.rarities, 'rarities', update),
    ...traitChips(filters.keywords, 'keywords', update),
    ...traitChips(filters.classifications, 'classifications', update),
    ...traitChips(filters.setCodes, 'setCodes', update, (code) => `Set ${code}`),
  ];
}

/**
 * One chip per picked keyword, classification or set (several since the chip
 * and logo pickers). Dismissing drops just that value from the CURRENT state,
 * and the last one clears the option.
 */
function traitChips(
  values: string[] | undefined,
  key: 'keywords' | 'classifications' | 'setCodes' | 'rarities',
  update: FilterUpdate,
  label: (value: string) => string = (value) => value,
): ChipData[] {
  return (values ?? []).map((value) => ({
    id: `${key}:${value}`,
    label: label(value),
    onDismiss: () =>
      update((prev) => {
        const rest = (prev.filters[key] ?? []).filter((v) => v !== value);
        return {...prev, filters: {...prev.filters, [key]: rest.length > 0 ? rest : undefined}};
      }),
  }));
}

/**
 * Chips for the active filters (strength excluded; it has its own toggle row).
 * Desktop shows the ink icons inline, so ink chips are phone-only. Dismissals use
 * functional updates, to avoid stale closures under rapid interaction.
 */
function buildChips(state: SynergyFilterState, isMobile: boolean, update: FilterUpdate): ChipData[] {
  return [
    ...(isMobile ? listChips(state.inkFilters, 'inkFilters', String, update) : []),
    ...inkModeChips(state, update),
    ...listChips(state.typeFilters, 'typeFilters', String, update),
    ...listChips(state.costFilters, 'costFilters', (cost) => `Cost ${cost}`, update),
    ...selectChips(state, update),
  ];
}

export function SynergyToolbar({
  filterState,
  onFilterChange,
  sortOrder,
  onSortChange,
  isMobile,
  uniqueKeywords,
  uniqueClassifications,
  uniqueRarities,
  sets,
}: SynergyToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const {inkFilters, strengthFilters} = filterState;

  // EVERY write goes through here, so the Dual-ink cards switch can never outlive the ink
  // selection that offered it (see `withoutStaleDualOnly`), whichever control
  // changed the inks.
  const update: FilterUpdate = (next) =>
    onFilterChange((prev) => withoutStaleDualOnly(typeof next === 'function' ? next(prev) : next));

  const chips = buildChips(filterState, isMobile, update);
  const hasChips = chips.length > 0;

  const handleApplyFilters = (
    inks: Ink[],
    types: CardTypeFilter[],
    costs: number[],
    opts: CardFilterOptions,
  ) => {
    update((prev) => ({
      ...prev,
      inkFilters: inks,
      typeFilters: types,
      costFilters: costs,
      filters: opts,
    }));
  };

  const handleClearAll = () => {
    update(EMPTY_SYNERGY_FILTERS);
  };

  const toggleInk = (ink: Ink) => {
    update((prev) => ({...prev, inkFilters: toggled(prev.inkFilters, ink)}));
  };

  const toggleStrength = (tier: StrengthTierFilter) => {
    // Single-select: clicking the active tier deselects, clicking another switches
    update((prev) => ({
      ...prev,
      strengthFilters: prev.strengthFilters.includes(tier) ? [] : [tier],
    }));
  };

  return (
    <>
      <div
        data-testid="synergy-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? SPACING.sm : SPACING.md,
          flexWrap: 'wrap',
          marginBottom: `${SPACING.lg}px`,
        }}>
        <FiltersButton
          onClick={() => setFilterOpen(true)}
          activeCount={countActiveFilters(filterState)}
          isMobile={isMobile}
        />

        {/* Strength tier toggle chips — the shared Chip recipe (#509 folded an inline clone) */}
        <div style={{display: 'flex', gap: 6, ...(isMobile ? {flexShrink: 0} : {})}}>
          {STRENGTH_TIERS.map((tier) => (
            <Chip
              key={tier}
              label={tier}
              active={strengthFilters.includes(tier)}
              onClick={() => toggleStrength(tier)}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* Active filter chips */}
        {hasChips && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              ...(isMobile ? {flexBasis: '100%'} : {flex: 1}),
            }}>
            {chips.map((chip) => (
              <Chip
                key={chip.id}
                variant="dismiss"
                label={chip.label}
                onDismiss={chip.onDismiss}
                isMobile={isMobile}
              />
            ))}
            <LinkButton tone="muted" underlineOnHover onClick={handleClearAll}>
              Clear all
            </LinkButton>
          </div>
        )}

        {/* Right side: ink filters (desktop) + sort */}
        {!isMobile && (
          <div
            style={{
              marginLeft: hasChips ? undefined : 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
            <InkFilterGroup inkFilters={inkFilters} onToggleInk={toggleInk} />
            <SortSelect
              options={SYNERGY_SORT_OPTIONS}
              value={sortOrder}
              onChange={onSortChange}
              ariaLabel="Sort synergies"
            />
          </div>
        )}
      </div>

      {/* Filter dialog (modal on desktop, drawer on mobile) */}
      <CardFilterDialog
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
        variant={isMobile ? 'drawer' : 'modal'}
        toolbarCarries={TOOLBAR_CARRIES}
        inkFilters={inkFilters}
        typeFilters={filterState.typeFilters}
        costFilters={filterState.costFilters}
        filters={filterState.filters}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        uniqueRarities={uniqueRarities}
        sets={sets}
      />
    </>
  );
}
