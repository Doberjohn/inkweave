import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {COLORS, RADIUS, SHADOWS, Z_INDEX} from '../constants';
import {useDialogFocus, useScrollLock, useTransitionPresence} from '../hooks';

/** Size presets → panel maxWidth (#510 ruling: one gutter, one maxHeight). */
const SIZE_MAX_WIDTH = {sm: 360, md: 440, lg: 960} as const;

/**
 * Stacking tiers. `modal` is the default dialog pair; `underModal` sits one
 * layer beneath it so the shared CardOverviewModal can stack on top (the
 * FranchiseCardsModal precedent); `lightbox` clears an open modal entirely.
 */
const LAYERS = {
  modal: {scrim: Z_INDEX.modalBackdrop, panel: Z_INDEX.modal},
  underModal: {scrim: Z_INDEX.modalBackdrop - 2, panel: Z_INDEX.modalBackdrop - 1},
  lightbox: {scrim: Z_INDEX.popoverBackdrop, panel: Z_INDEX.popover},
} as const;

/** How long past the 0.2s overlay transition the unmount fallback waits. */
const EXIT_FALLBACK_MS = 400;

interface DialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required accessible name for the dialog (axe: aria-dialog-name). */
  ariaLabel: string;
  /** Panel width preset; ignored when `panelStyle` overrides maxWidth. */
  size?: keyof typeof SIZE_MAX_WIDTH;
  /** `heavy` = COLORS.scrimHeavy, for lightbox-grade separation. */
  scrim?: 'default' | 'heavy';
  /** Faint gold ring composed onto the overlay shadow. */
  goldRing?: boolean;
  layer?: keyof typeof LAYERS;
  /**
   * `scale` = the house overlay-scale enter/exit. `none` = the shell renders
   * while `isOpen` with no presence transition — for dialogs whose CONTENT
   * owns the choreography (e.g. MobileLightbox's FLIP, which delays flipping
   * `isOpen` until its exit animation completes).
   */
  transition?: 'scale' | 'none';
  /**
   * Focused 100ms after open (via useDialogFocus). Falls back to the panel
   * itself (`tabIndex={-1}`) so initial focus always lands inside the trap.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * ESCAPE HATCH — the #510 ruling is backdrop ALWAYS closes. Setting this
   * requires a written justification comment at the call site (overlays.md).
   */
  disableBackdropClose?: boolean;
  /** E2E contract hooks: existing specs target backdrops/panels by testid. */
  scrimTestId?: string;
  panelTestId?: string;
  /** Merged onto the panel (e.g. an ink-tinted border); wins over presets. */
  panelStyle?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * The overlay contract as a component (#510): portal to body, token scrim
 * that ALWAYS closes on click, role="dialog" + aria-modal + required name,
 * and the house hook trio — document-level Escape + Tab trap + focus restore
 * (useDialogFocus), body scroll lock (useScrollLock), and enter/exit via the
 * overlay-* classes (useTransitionPresence). Closed dialogs UNMOUNT — E2E
 * asserts `toHaveCount(0)`, and a fallback timer guarantees it even under
 * `prefers-reduced-motion`, where `transitionend` never fires.
 */
export function DialogShell({
  isOpen,
  onClose,
  ariaLabel,
  size = 'md',
  scrim = 'default',
  goldRing = false,
  layer = 'modal',
  transition = 'scale',
  initialFocusRef,
  disableBackdropClose = false,
  scrimTestId,
  panelTestId,
  panelStyle,
  children,
}: DialogShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const animated = transition !== 'none';
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen && animated);
  const rendered = animated ? mounted : isOpen;

  const {handleKeyDown} = useDialogFocus({
    isOpen: rendered && isOpen,
    containerRef: panelRef,
    initialFocusRef: initialFocusRef ?? panelRef,
    onClose,
  });
  useScrollLock(rendered);

  // Reduced-motion sets `transition: none !important` on .overlay-transition,
  // so transitionend never fires and `mounted` would leak forever (#467-class
  // bug: work deferred to a transition must flush at every exit). Race it.
  useEffect(() => {
    if (!animated || isOpen || !mounted) return;
    const timer = setTimeout(onTransitionEnd, EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [animated, isOpen, mounted, onTransitionEnd]);

  if (!rendered) return null;

  const tiers = LAYERS[layer];
  const visibleClass = visible ? ' overlay-visible' : '';
  // The scrim only fades; the panel fades + scales (the CardOverviewModal precedent).
  const scrimClass = animated ? `overlay-transition overlay-enter${visibleClass}` : undefined;
  const panelClass = animated ? `overlay-transition overlay-scale overlay-enter${visibleClass}` : undefined;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid={scrimTestId}
        onClick={disableBackdropClose ? undefined : onClose}
        className={scrimClass}
        onTransitionEnd={animated ? onTransitionEnd : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          background: scrim === 'heavy' ? COLORS.scrimHeavy : COLORS.scrim,
          zIndex: tiers.scrim,
          cursor: disableBackdropClose ? undefined : 'pointer',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: tiers.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          // Clicks in the gutter fall through to the scrim below.
          pointerEvents: 'none',
        }}>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog keyboard handling (Tab trap via useDialogFocus) */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          data-testid={panelTestId}
          onKeyDown={handleKeyDown}
          className={panelClass}
          onTransitionEnd={animated ? onTransitionEnd : undefined}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: SIZE_MAX_WIDTH[size],
            maxHeight: '85vh',
            overflow: 'auto',
            outline: 'none',
            background: COLORS.surface,
            border: `1px solid ${COLORS.surfaceBorder}`,
            borderRadius: RADIUS.xl,
            boxShadow: goldRing ? `${SHADOWS.overlay}, ${SHADOWS.goldRing}` : SHADOWS.overlay,
            ...panelStyle,
          }}>
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
