import {useCallback, useRef} from 'react';
import {COLORS, FONT_SIZES, RADIUS, SPACING, Z_INDEX, CTA_BUTTON_STYLE} from '../constants';
import {useDraftFilters} from '../hooks/useDraftFilters';
import {useDialogFocus} from '../hooks/useDialogFocus';
import {useScrollLock, useTransitionPresence} from '../hooks';
import {FilterContent} from './FilterContent';
import type {FilterPanelProps} from './FilterContent';

export function FilterDrawer({
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const applyButtonRef = useRef<HTMLButtonElement>(null);

  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);

  const draft = useDraftFilters({isOpen, inkFilters, typeFilters, costFilters, filters});

  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: drawerRef,
    initialFocusRef: applyButtonRef,
    onClose,
  });

  const handleApply = useCallback(() => {
    onApply(draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters);
    onClose();
  }, [draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters, onApply, onClose]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop overlay - click to dismiss (keyboard users use Escape) */}
      <div
        className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
        aria-hidden="true"
        onClick={onClose}
        data-testid="filter-drawer-backdrop"
        onTransitionEnd={onTransitionEnd}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: Z_INDEX.modalBackdrop,
          cursor: 'pointer',
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`overlay-transition overlay-slide-up overlay-enter ${visible ? 'overlay-visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-drawer-title"
        onKeyDown={handleKeyDown}
        onTransitionEnd={onTransitionEnd}
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
            Filters {draft.activeFilterCount > 0 && `(${draft.activeFilterCount})`}
          </h2>
          <div style={{display: 'flex', gap: `${SPACING.md}px`}}>
            {draft.activeFilterCount > 0 && (
              <button
                onClick={draft.clearAll}
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
            <button ref={applyButtonRef} onClick={handleApply} style={CTA_BUTTON_STYLE}>
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
            variant="mobile"
          />
        </div>
      </div>
    </>
  );
}
