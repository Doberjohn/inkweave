import {COLORS, RADIUS, SHADOWS, SPACING, Z_INDEX} from '../tokens/theme';

interface BottomSheetProps {
  /** useTransitionPresence's `visible` — drives the overlay-* enter/exit classes. */
  visible: boolean;
  onClose: () => void;
  /** useTransitionPresence's unmount callback; attached to backdrop AND sheet. */
  onTransitionEnd: React.TransitionEventHandler<HTMLDivElement>;
  /** Required accessible name for the sheet dialog. */
  ariaLabel: string;
  /** E2E contract: existing specs dismiss sheets via the backdrop testid. */
  backdropTestId?: string;
  /** The consumer's useDialogFocus container (also its initial-focus fallback). */
  sheetRef: React.RefObject<HTMLDivElement | null>;
  /** The consumer's useDialogFocus Tab-trap handler. */
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  /** Per-sheet container deltas (top/maxHeight/inline transition), merged last. */
  sheetStyle?: React.CSSProperties;
  /** `lightbox` stacks the sheet and its scrim above an open modal, as it does a DialogShell. */
  layer?: keyof typeof LAYERS;
  children: React.ReactNode;
}

/**
 * DialogShell's `modal` and `lightbox` tiers, under the same names, so a dialog and the sheet that
 * stands in for it on a phone stack alike. A copy, not an import: sharing the map put it in a
 * chunk of its own, one more request for every dialog.
 */
const LAYERS = {
  modal: {scrim: Z_INDEX.modalBackdrop, panel: Z_INDEX.modal},
  lightbox: {scrim: Z_INDEX.popoverBackdrop, panel: Z_INDEX.popover},
} as const;

/**
 * Shared bottom-sheet chrome (#510): the scrim backdrop, slide-up sheet
 * container, and drag-handle visual that SearchBottomSheet and
 * MechanicsBottomSheet used to copy-paste. Behavior (presence, focus trap,
 * scroll lock) stays with the consumer via the house hook trio — this
 * component owns only the chrome, including the iOS safe-area inset both
 * sheets previously lacked.
 */
export function BottomSheet({
  visible,
  onClose,
  onTransitionEnd,
  ariaLabel,
  backdropTestId,
  sheetRef,
  onKeyDown,
  sheetStyle,
  layer = 'modal',
  children,
}: BottomSheetProps) {
  const tiers = LAYERS[layer];
  return (
    <>
      <div
        data-testid={backdropTestId}
        className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
        onTransitionEnd={onTransitionEnd}
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          // Solid scrim only — no backdrop-filter (WebKit continuous-repaint trap; see #444).
          background: COLORS.scrim,
          zIndex: tiers.scrim,
        }}
      />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog keyboard handling (Tab trap via useDialogFocus) */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`overlay-transition overlay-slide-up overlay-enter ${visible ? 'overlay-visible' : ''}`}
        onTransitionEnd={onTransitionEnd}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: COLORS.surface,
          borderRadius: '24px 24px 0 0',
          boxShadow: SHADOWS.sheet,
          zIndex: tiers.panel,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom)',
          // #511: no replacement ring needed. The sheet is `tabIndex={-1}`, out of the Tab
          // order; it only takes focus programmatically so the trap has somewhere to land,
          // and a ring round the whole sheet would mark nothing. Its controls draw their own.
          outline: 'none',
          ...sheetStyle,
        }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: `${SPACING.md}px 0 ${SPACING.sm}px`,
            flexShrink: 0,
          }}>
          <div style={{width: 36, height: 4, borderRadius: RADIUS.xs, background: COLORS.gray300}} />
        </div>
        {children}
      </div>
    </>
  );
}
