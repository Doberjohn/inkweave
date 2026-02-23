import {useEffect, useCallback, useRef} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import type {Ink, SetInfo} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards';
import type {CardTypeFilter} from '../constants/theme';
import {
  COLORS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  Z_INDEX,
  CTA_BUTTON_STYLE,
} from '../constants';
import {FilterContent} from './FilterContent';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  activeFilterCount: number;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: SetInfo[];
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardTypeFilter) => void;
  onToggleCost: (cost: number) => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  onClearAll: () => void;
}

export function FilterDrawer({
  isOpen,
  onClose,
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  activeFilterCount,
  uniqueKeywords,
  uniqueClassifications,
  sets,
  onToggleInk,
  onToggleType,
  onToggleCost,
  onFiltersChange,
  onClearAll,
}: FilterDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const applyButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  // Focus management: save previous focus, set initial focus, restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Small delay ensures drawer animation has started and element is focusable
      const timerId = setTimeout(() => {
        applyButtonRef.current?.focus();
      }, 100);
      return () => {
        clearTimeout(timerId);
        const prev = previousActiveElement.current;
        if (prev && prev.isConnected) {
          prev.focus();
        }
      };
    }
  }, [isOpen]);

  // Escape key listener (separate effect to avoid spurious focus restore)
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Focus trap: keep focus within drawer
  const handleDrawerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;

    const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay - click to dismiss (keyboard users use Escape) */}
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            aria-hidden="true"
            onClick={onClose}
            data-testid="filter-drawer-backdrop"
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
            ref={drawerRef}
            initial={{y: '100%'}}
            animate={{y: 0}}
            exit={{y: '100%'}}
            transition={{type: 'spring', stiffness: 400, damping: 35}}
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-drawer-title"
            onKeyDown={handleDrawerKeyDown}
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
                  ref={applyButtonRef}
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
              <FilterContent
                inkFilters={inkFilters}
                typeFilters={typeFilters}
                costFilters={costFilters}
                filters={filters}
                uniqueKeywords={uniqueKeywords}
                uniqueClassifications={uniqueClassifications}
                sets={sets}
                onToggleInk={onToggleInk}
                onToggleType={onToggleType}
                onToggleCost={onToggleCost}
                onFiltersChange={onFiltersChange}
                variant="mobile"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
