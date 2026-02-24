import {useEffect, useCallback, useRef} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import type {Ink, SetInfo} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards';
import type {CardTypeFilter} from '../constants/theme';
import {COLORS, FONT_SIZES, SPACING, RADIUS, Z_INDEX, CTA_BUTTON_STYLE} from '../constants';
import {FilterContent} from './FilterContent';

interface FilterModalProps {
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

export function FilterModal({
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
}: FilterModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  // Focus management: save previous focus, set initial focus, restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Small delay ensures modal animation has started and element is focusable
      const timerId = setTimeout(() => {
        closeButtonRef.current?.focus();
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

  // Focus trap: keep focus within modal
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      // Shift+Tab on first element: go to last
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      // Tab on last element: go to first
      e.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            aria-hidden="true"
            onClick={onClose}
            data-testid="filter-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: Z_INDEX.modalBackdrop,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Centering wrapper */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: Z_INDEX.modal,
              pointerEvents: 'none',
            }}>
            <motion.div
              ref={modalRef}
              initial={{opacity: 0, scale: 0.95}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.95}}
              transition={{duration: 0.2, ease: 'easeOut'}}
              role="dialog"
              aria-modal="true"
              aria-labelledby="filter-modal-title"
              data-testid="filter-modal"
              onKeyDown={handleModalKeyDown}
              style={{
                width: 'fit-content',
                minWidth: 320,
                maxHeight: '80vh',
                background: COLORS.surface,
                borderRadius: `${RADIUS.xl}px`,
                border: `1px solid ${COLORS.surfaceBorder}`,
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 1px rgba(212, 175, 55, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                pointerEvents: 'auto',
              }}>
              {/* Header */}
              <div
                style={{
                  padding: `${SPACING.lg}px ${SPACING.xl}px`,
                  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}>
                <h2
                  id="filter-modal-title"
                  style={{
                    margin: 0,
                    fontSize: `${FONT_SIZES.xl}px`,
                    fontWeight: 600,
                    color: COLORS.text,
                  }}>
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </h2>
                <div style={{display: 'flex', gap: `${SPACING.md}px`, alignItems: 'center'}}>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={onClearAll}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: COLORS.primary,
                        fontSize: `${FONT_SIZES.base}px`,
                        cursor: 'pointer',
                        padding: `${SPACING.sm}px`,
                      }}>
                      Clear all
                    </button>
                  )}
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    aria-label="Close filters"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLORS.textMuted,
                      fontSize: `${FONT_SIZES.xxl}px`,
                      cursor: 'pointer',
                      padding: `${SPACING.xs}px`,
                      lineHeight: 1,
                    }}>
                    ×
                  </button>
                </div>
              </div>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: `${SPACING.xl}px`,
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
                  variant="desktop"
                />
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: `${SPACING.lg}px ${SPACING.xl}px`,
                  borderTop: `1px solid ${COLORS.surfaceBorder}`,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flexShrink: 0,
                }}>
                <button onClick={onClose} style={CTA_BUTTON_STYLE}>
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
