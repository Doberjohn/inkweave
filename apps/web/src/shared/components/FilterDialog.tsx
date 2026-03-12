import {useCallback} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {COLORS, FONT_SIZES, SPACING, RADIUS, Z_INDEX} from '../constants';
import {CtaButton} from './CtaButton';
import {useDraftFilters} from '../hooks/useDraftFilters';
import {FilterContent} from './FilterContent';
import type {FilterPanelProps} from './FilterContent';

interface FilterDialogProps extends FilterPanelProps {
  /** Responsive variant — controls layout and animation */
  variant: 'modal' | 'drawer';
}

export function FilterDialog({
  isOpen,
  onClose,
  onApply,
  variant,
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  sets,
}: FilterDialogProps) {
  const draft = useDraftFilters({isOpen, inkFilters, typeFilters, costFilters, filters});

  const handleApply = useCallback(() => {
    onApply(draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters);
    onClose();
  }, [draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters, onApply, onClose]);

  const getVariantStyles = (): {
    overlay: React.CSSProperties;
    content: React.CSSProperties;
  } => {
    if (variant === 'modal') {
      return {
        overlay: {
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: Z_INDEX.modalBackdrop,
          backdropFilter: 'blur(4px)',
        },
        content: {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'fit-content',
          minWidth: 320,
          maxHeight: '80vh',
          background: COLORS.surface,
          borderRadius: `${RADIUS.xl}px`,
          border: `1px solid ${COLORS.surfaceBorder}`,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 1px rgba(212, 175, 55, 0.2)',
          display: 'flex',
          flexDirection: 'column' as const,
          overflow: 'hidden',
          zIndex: Z_INDEX.modal,
        },
      };
    }
    return {
      overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: Z_INDEX.modalBackdrop,
      },
      content: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '85vh',
        background: COLORS.surface,
        borderTopLeftRadius: `${RADIUS.xl}px`,
        borderTopRightRadius: `${RADIUS.xl}px`,
        display: 'flex',
        flexDirection: 'column' as const,
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: Z_INDEX.modal,
      },
    };
  };

  const styles = getVariantStyles();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid={variant === 'modal' ? 'filter-modal-backdrop' : 'filter-drawer-backdrop'}
          style={styles.overlay}
        />
        <Dialog.Content
          data-testid={variant === 'modal' ? 'filter-modal' : 'filter-drawer'}
          aria-describedby={undefined}
          style={styles.content}>
          {/* Drag handle (drawer only) */}
          {variant === 'drawer' && (
            <div style={{display: 'flex', justifyContent: 'center', paddingTop: `${SPACING.md}px`}}>
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: COLORS.gray300,
                }}
              />
            </div>
          )}

          {/* Header */}
          <div
            style={{
              padding: variant === 'modal' ? `${SPACING.lg}px ${SPACING.xl}px` : `${SPACING.lg}px`,
              borderBottom: `1px solid ${variant === 'modal' ? COLORS.surfaceBorder : COLORS.gray200}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}>
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: `${FONT_SIZES.xl}px`,
                fontWeight: 600,
                color: COLORS.text,
              }}>
              Filters{draft.activeFilterCount > 0 ? ` (${draft.activeFilterCount})` : ''}
            </Dialog.Title>

            <div style={{display: 'flex', gap: `${SPACING.md}px`, alignItems: 'center'}}>
              {draft.activeFilterCount > 0 && (
                <button
                  onClick={draft.clearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: variant === 'modal' ? COLORS.primary : COLORS.primary600,
                    fontSize: `${FONT_SIZES.base}px`,
                    cursor: 'pointer',
                    padding: `${SPACING.sm}px`,
                  }}>
                  Clear all
                </button>
              )}
              {variant === 'modal' ? (
                <Dialog.Close asChild>
                  <button
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
                </Dialog.Close>
              ) : (
                <CtaButton onClick={handleApply}>Apply</CtaButton>
              )}
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: variant === 'modal' ? `${SPACING.xl}px` : `${SPACING.lg}px`,
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
              variant={variant === 'modal' ? 'desktop' : 'mobile'}
            />
          </div>

          {/* Footer (modal only — drawer has Apply in header) */}
          {variant === 'modal' && (
            <div
              style={{
                padding: `${SPACING.lg}px ${SPACING.xl}px`,
                borderTop: `1px solid ${COLORS.surfaceBorder}`,
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}>
              <CtaButton onClick={handleApply}>Apply Filters</CtaButton>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
