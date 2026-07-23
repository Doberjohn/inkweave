import {COLORS, RADIUS, SHADOWS, SPACING, Z_INDEX} from '../constants';

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
  children: React.ReactNode;
}

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
  children,
}: BottomSheetProps) {
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
          zIndex: Z_INDEX.modalBackdrop,
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
          borderRadius: `${RADIUS.sheet}px ${RADIUS.sheet}px 0 0`,
          boxShadow: SHADOWS.sheet,
          zIndex: Z_INDEX.modal,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom)',
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
