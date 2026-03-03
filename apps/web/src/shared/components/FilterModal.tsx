import {useCallback, useRef} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {COLORS, FONT_SIZES, SPACING, RADIUS, Z_INDEX, CTA_BUTTON_STYLE} from '../constants';
import {useDraftFilters} from '../hooks/useDraftFilters';
import {useDialogFocus} from '../hooks/useDialogFocus';
import {FilterContent} from './FilterContent';
import type {FilterPanelProps} from './FilterContent';

export function FilterModal({
  isOpen,
  onClose,
  onApply,
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  sets,
}: FilterPanelProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const draft = useDraftFilters({isOpen, inkFilters, typeFilters, costFilters, filters});

  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: modalRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  const handleApply = useCallback(() => {
    onApply(draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters);
    onClose();
  }, [draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters, onApply, onClose]);

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
              onKeyDown={handleKeyDown}
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
                  Filters{draft.activeFilterCount > 0 ? ` (${draft.activeFilterCount})` : ''}
                </h2>
                <div style={{display: 'flex', gap: `${SPACING.md}px`, alignItems: 'center'}}>
                  {draft.activeFilterCount > 0 && (
                    <button
                      onClick={draft.clearAll}
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
                  inkFilters={draft.draftInks}
                  typeFilters={draft.draftTypes}
                  costFilters={draft.draftCosts}
                  filters={draft.draftFilters}
                  uniqueKeywords={uniqueKeywords}
                  uniqueClassifications={uniqueClassifications}
                  sets={sets}
                  onToggleInk={draft.toggleInk}
                  onToggleType={draft.toggleType}
                  onToggleCost={draft.toggleCost}
                  onFiltersChange={draft.updateFilters}
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
                <button onClick={handleApply} style={CTA_BUTTON_STYLE}>
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
