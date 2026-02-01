import {useEffect, useCallback} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import type {Ink, SetInfo} from '../../features/cards';
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
  COST_OPTIONS,
  SELECT_STYLE_MD,
} from '../constants';
// FONT_SIZES and RADIUS are still used for header/drawer styling
import {isCardType} from '../../features/cards';
import {FilterButton} from './FilterButton';
import {FilterSection} from './FilterSection';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inkFilter: Ink | 'all';
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: SetInfo[];
  onInkFilterChange: (ink: Ink | 'all') => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  onClearAll: () => void;
}

export function FilterDrawer({
  isOpen,
  onClose,
  inkFilter,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  sets,
  onInkFilterChange,
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

  const selectedType = isCardType(filters.type) ? filters.type : undefined;

  const updateFilter = <K extends keyof CardFilterOptions>(key: K, value: CardFilterOptions[K]) => {
    const newFilters = {...filters};
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const activeFilterCount = [
    inkFilter !== 'all',
    filters.type,
    filters.minCost !== undefined,
    filters.maxCost !== undefined,
    filters.keywords?.length,
    filters.classifications?.length,
    filters.setCode,
  ].filter(Boolean).length;

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
              background: COLORS.white,
              borderTopLeftRadius: `${RADIUS.xl}px`,
              borderTopRightRadius: `${RADIUS.xl}px`,
              zIndex: Z_INDEX.modal,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}>
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
                  style={{
                    background: COLORS.primary600,
                    color: COLORS.white,
                    border: 'none',
                    borderRadius: `${RADIUS.md}px`,
                    padding: `${SPACING.sm}px ${SPACING.lg}px`,
                    fontSize: `${FONT_SIZES.base}px`,
                    fontWeight: 600,
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}>
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
                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                  <FilterButton
                    size="md"
                    active={inkFilter === 'all'}
                    onClick={() => onInkFilterChange('all')}>
                    All
                  </FilterButton>
                  {ALL_INKS.map((ink) => (
                    <FilterButton
                      key={ink}
                      size="md"
                      active={inkFilter === ink}
                      onClick={() => onInkFilterChange(ink)}
                      activeColor={INK_COLORS[ink].border}
                      inactiveColor={INK_COLORS[ink].bg}
                      inactiveTextColor={INK_COLORS[ink].text}>
                      {ink}
                    </FilterButton>
                  ))}
                </div>
              </FilterSection>

              {/* Card Type Filter */}
              <FilterSection label="Type">
                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                  <FilterButton
                    size="md"
                    active={!selectedType}
                    onClick={() => updateFilter('type', undefined)}>
                    All
                  </FilterButton>
                  {CARD_TYPES.map((type) => (
                    <FilterButton
                      key={type}
                      size="md"
                      active={selectedType === type}
                      onClick={() => updateFilter('type', type)}>
                      {type}
                    </FilterButton>
                  ))}
                </div>
              </FilterSection>

              {/* Cost Range */}
              <FilterSection label="Cost Range">
                <div style={{display: 'flex', gap: `${SPACING.md}px`, alignItems: 'center'}}>
                  <select
                    value={filters.minCost ?? ''}
                    onChange={(e) =>
                      updateFilter('minCost', e.target.value ? Number(e.target.value) : undefined)
                    }
                    style={SELECT_STYLE_MD}>
                    <option value="">Min</option>
                    {COST_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span style={{color: COLORS.gray400}}>to</span>
                  <select
                    value={filters.maxCost ?? ''}
                    onChange={(e) =>
                      updateFilter('maxCost', e.target.value ? Number(e.target.value) : undefined)
                    }
                    style={SELECT_STYLE_MD}>
                    <option value="">Max</option>
                    {COST_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
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
