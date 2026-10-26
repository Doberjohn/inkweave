import {useRef, type ReactNode} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {COLORS, FONT_SIZES, SHADOWS, SPACING, RADIUS, Z_INDEX} from '../constants';
import {CtaButton} from 'inkweave-ui/components/CtaButton';
import {IconButton} from 'inkweave-ui/components/IconButton';
import {LinkButton} from 'inkweave-ui/components/LinkButton';
import {useDraftFilters} from '../hooks/useDraftFilters';
import {useInlineCostFilters} from '../hooks';
import {FilterContent} from './FilterContent';
import type {FilterPanelProps} from './FilterContent';

interface FilterDialogProps extends FilterPanelProps {
  /** Responsive variant. Controls layout and animation. */
  variant: 'modal' | 'drawer';
  /**
   * Whether the page's toolbar carries the cost and inkwell buttons inline, so the
   * desktop modal can leave them out. Defaults to Browse's toolbar: inkwell always,
   * cost on wide screens. A toolbar without them (the synergy toolbar) passes
   * `false` for each, or those filters are unreachable on desktop.
   */
  toolbarCarries?: {cost: boolean; inkwell: boolean};
  /** The title, in place of "Filters (n)": a phone binder's sheet is "Binder" (#969). */
  title?: string;
  /** Drawn above the filters: the Binder sheet's Show and sort (#969). */
  prelude?: ReactNode;
  /** Drawn after the filters: the Binder sheet's numbers (#969). */
  postlude?: ReactNode;
  /**
   * What the caller drafts beside the filters, which Clear all puts back too (the Binder sheet's
   * Show, #969): while `count` is above 0, Clear all shows, and pressing it also calls `onClear`.
   * One prop, so a count never comes without the clear that takes it away.
   */
  extra?: {count: number; onClear: () => void};
}

/**
 * Hands focus back to the control that opened the dialog when it closes (WCAG 2.4.3). Radix
 * returns focus to a `Dialog.Trigger`, and this dialog is controlled with none, so its own
 * target is null and focus would fall to the top of the page. Radix calls `onOpenAutoFocus`
 * before it moves focus in, so the opener still holds it then.
 */
function useReturnFocus() {
  const openerRef = useRef<HTMLElement | null>(null);
  return {
    keepOpener: () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    restore: (event: Event) => {
      event.preventDefault();
      if (openerRef.current?.isConnected) openerRef.current.focus();
      openerRef.current = null;
    },
  };
}

interface DialogHeaderProps {
  variant: FilterDialogProps['variant'];
  title: string;
  /** Whether anything is on that Clear all would clear. */
  canClear: boolean;
  onClear: () => void;
  onApply: () => void;
}

/** The title, Clear all while anything is on, and the drawer's Apply or the modal's ×. */
function DialogHeader({variant, title, canClear, onClear, onApply}: DialogHeaderProps) {
  return (
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
        {title}
      </Dialog.Title>

      <div style={{display: 'flex', gap: `${SPACING.md}px`, alignItems: 'center'}}>
        {canClear && (
          <LinkButton onClick={onClear} style={{padding: `${SPACING.sm}px`}}>
            Clear all
          </LinkButton>
        )}
        {variant === 'modal' ? (
          <Dialog.Close asChild>
            <IconButton
              aria-label="Close filters"
              style={{fontSize: `${FONT_SIZES.xxl}px`, lineHeight: 1}}>
              ×
            </IconButton>
          </Dialog.Close>
        ) : (
          <CtaButton onClick={onApply}>Apply</CtaButton>
        )}
      </div>
    </div>
  );
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
  uniqueRarities,
  sets,
  buttonOptions,
  showSetFilter,
  showArtPresets,
  toolbarCarries = {cost: true, inkwell: true},
  title,
  prelude,
  postlude,
  extra,
}: FilterDialogProps) {
  const draft = useDraftFilters({isOpen, inkFilters, typeFilters, costFilters, filters});
  const returnFocus = useReturnFocus();
  // Cost rides inline only on wide screens, and only in a toolbar that has it.
  const showInlineCost = useInlineCostFilters() && toolbarCarries.cost;

  const handleApply = () => {
    onApply(draft.draftInks, draft.draftTypes, draft.draftCosts, draft.draftFilters);
    onClose();
  };
  const clearAll = () => {
    draft.clearAll();
    extra?.onClear();
  };
  const count = draft.activeFilterCount;

  const getVariantStyles = (): {
    overlay: React.CSSProperties;
    content: React.CSSProperties;
  } => {
    if (variant === 'modal') {
      return {
        overlay: {
          position: 'fixed',
          inset: 0,
          // Solid scrim only — no backdrop-filter (WebKit continuous-repaint trap; see #444).
          background: COLORS.scrim,
          zIndex: Z_INDEX.modalBackdrop,
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
          boxShadow: `${SHADOWS.overlay}, ${SHADOWS.goldRing}`,
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
        background: COLORS.scrim,
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
          onOpenAutoFocus={returnFocus.keepOpener}
          onCloseAutoFocus={returnFocus.restore}
          style={styles.content}>
          {/* Drag handle (drawer only) */}
          {variant === 'drawer' && (
            <div style={{display: 'flex', justifyContent: 'center', paddingTop: `${SPACING.md}px`}}>
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: RADIUS.xs,
                  background: COLORS.gray300,
                }}
              />
            </div>
          )}

          <DialogHeader
            variant={variant}
            title={title ?? `Filters${count > 0 ? ` (${count})` : ''}`}
            canClear={count + (extra?.count ?? 0) > 0}
            onClear={clearAll}
            onApply={handleApply}
          />

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: variant === 'modal' ? `${SPACING.xl}px` : `${SPACING.lg}px`,
            }}>
            {prelude}
            <FilterContent
              inkFilters={draft.draftInks}
              typeFilters={draft.draftTypes}
              costFilters={draft.draftCosts}
              filters={draft.draftFilters}
              uniqueKeywords={uniqueKeywords}
              uniqueClassifications={uniqueClassifications}
              uniqueRarities={uniqueRarities}
              sets={sets}
              buttonOptions={buttonOptions}
              onToggleInk={draft.toggleInk}
              onToggleType={draft.toggleType}
              onToggleCost={draft.toggleCost}
              onFiltersChange={draft.updateFilters}
              variant={variant === 'modal' ? 'desktop' : 'mobile'}
              showInlineCost={showInlineCost}
              showInlineInkwell={toolbarCarries.inkwell}
              showSetFilter={showSetFilter}
              showArtPresets={showArtPresets}
            />
            {postlude}
          </div>

          {/* Footer (modal only; drawer has Apply in header) */}
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
