import {useEffect, useCallback} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import type {Ink, CardType, SetInfo} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards';
import {
  COLORS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  Z_INDEX,
  INK_COLORS,
  ALL_INKS,
  CARD_TYPES,
  SELECT_STYLE_MD,
  CTA_BUTTON_STYLE,
} from '../constants';
import {CostIcon} from './CostIcon';
import {FilterButton} from './FilterButton';
import {FilterSection} from './FilterSection';
import {InkIcon} from './InkIcon';

const COST_BUTTONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Convert a hex color (#rrggbb) to rgba with the given alpha */
const hexRgba = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inkFilters: Ink[];
  typeFilters: CardType[];
  costFilters: number[];
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: SetInfo[];
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardType) => void;
  onToggleCost: (cost: number) => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  onClearAll?: () => void;
}

export function FilterDrawer({
  isOpen,
  onClose,
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
  onClearAll,
}: FilterDrawerProps) {
  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const updateFilter = <K extends keyof CardFilterOptions>(key: K, value: CardFilterOptions[K]) => {
    const newFilters = {...filters};
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const activeFilterCount =
    inkFilters.length +
    typeFilters.length +
    costFilters.length +
    [filters.keywords?.length, filters.classifications?.length, filters.setCode].filter(Boolean)
      .length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - accessible button for keyboard users */}
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            role="button"
            tabIndex={0}
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose();
              }
            }}
            aria-label="Close filters"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: Z_INDEX.modalBackdrop,
              cursor: 'pointer',
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{y: '100%'}}
            animate={{y: 0}}
            exit={{y: '100%'}}
            transition={{type: 'spring', stiffness: 400, damping: 35}}
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-drawer-title"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: COLORS.surface,
              borderTopLeftRadius: `${RADIUS.xl}px`,
              borderTopRightRadius: `${RADIUS.xl}px`,
              zIndex: Z_INDEX.modal,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}>
            {/* Drag handle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                paddingTop: `${SPACING.md}px`,
              }}>
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: COLORS.gray300,
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                padding: `${SPACING.lg}px`,
                borderBottom: `1px solid ${COLORS.gray200}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <h2
                id="filter-drawer-title"
                style={{margin: 0, fontSize: `${FONT_SIZES.xl}px`, fontWeight: 600}}>
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </h2>
              <div style={{display: 'flex', gap: `${SPACING.md}px`}}>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      onClearAll();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLORS.primary600,
                      fontSize: `${FONT_SIZES.base}px`,
                      cursor: 'pointer',
                      padding: `${SPACING.sm}px`,
                    }}>
                    Clear all
                  </button>
                )}
                <button
                  onClick={onClose}
                  style={CTA_BUTTON_STYLE}>
                  Apply
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: `${SPACING.lg}px`,
              }}>
              {/* Ink Filter */}
              <FilterSection label="Ink">
                <div style={{display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-evenly'}}>
                  {ALL_INKS.map((ink) => (
                    <FilterButton
                      key={ink}
                      size="sm"
                      active={inkFilters.includes(ink)}
                      onClick={() => onToggleInk(ink)}
                      activeColor={hexRgba(INK_COLORS[ink].border, 0.3)}
                      inactiveColor="transparent"
                      inactiveTextColor="transparent">
                      <InkIcon ink={ink} size={30} decorative={false} />
                    </FilterButton>
                  ))}
                </div>
              </FilterSection>

              {/* Ink Cost */}
              <FilterSection label="Ink Cost">
                <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center'}}>
                  {COST_BUTTONS.map((cost) => (
                    <FilterButton
                      key={cost}
                      size="sm"
                      active={costFilters.includes(cost)}
                      onClick={() => onToggleCost(cost)}
                      activeColor="rgba(212, 175, 55, 0.3)"
                      inactiveColor="transparent"
                      inactiveTextColor="transparent">
                      <CostIcon cost={cost} size={34} />
                    </FilterButton>
                  ))}
                </div>
              </FilterSection>

              {/* Card Type Filter */}
              <FilterSection label="Type">
                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly'}}>
                  {CARD_TYPES.map((type) => (
                    <FilterButton
                      key={type}
                      size="md"
                      active={typeFilters.includes(type)}
                      onClick={() => onToggleType(type)}>
                      {type}
                    </FilterButton>
                  ))}
                </div>
              </FilterSection>

              {/* Keyword */}
              <FilterSection label="Keyword">
                <select
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
