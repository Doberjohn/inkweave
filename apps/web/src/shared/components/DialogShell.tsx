import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {COLORS, RADIUS, SHADOWS, Z_INDEX} from '../constants';
import {useDialogFocus, useScrollLock, useTransitionPresence} from '../hooks';
import {IconButton} from './IconButton';

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
  /**
   * The close × in the panel's top-right. ON by default: Escape needs a keyboard
   * and backdrop-tap is undiscoverable, so without it a touch user has no visible
   * way out. Opt out only when the content supplies its own dismissal (a lightbox
   * whose whole surface closes), and say why at the call site.
   */
  showClose?: boolean;
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
/**
 * Reduced-motion sets `transition: none !important` on .overlay-transition,
 * so transitionend never fires and `mounted` would leak forever (#467-class
 * bug: work deferred to a transition must flush at every exit). Race it.
 */
function useExitFallback(animated: boolean, isOpen: boolean, mounted: boolean, onTransitionEnd: () => void) {
  useEffect(() => {
    if (!animated) return;
    if (isOpen || !mounted) return;
    const timer = setTimeout(onTransitionEnd, EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [animated, isOpen, mounted, onTransitionEnd]);
}

/**
 * useDialogFocus's one-shot 100ms focus can be silently REFUSED: during the
 * enter transition the panel's `visibility` interpolates hidden→visible and
 * Chrome treats the first half as hidden (discrete-at-50%), so a focus that
 * lands mid-transition does nothing. Retry (bounded) until focus takes or
 * the user has already focused something inside the panel.
 */
function useFocusRetry(
  animated: boolean,
  visible: boolean,
  panelRef: React.RefObject<HTMLDivElement | null>,
  initialFocusRef: React.RefObject<HTMLElement | null> | undefined,
) {
  useEffect(() => {
    if (!animated || !visible) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      const panel = panelRef.current;
      const target = (initialFocusRef ?? panelRef).current;
      if (!panel || !target) return;
      if (panel.contains(document.activeElement)) return;
      target.focus();
      if (panel.contains(document.activeElement)) return;
      if (++tries < 6) timer = setTimeout(attempt, 60);
    };
    timer = setTimeout(attempt, 0);
    return () => clearTimeout(timer);
  }, [animated, visible, panelRef, initialFocusRef]);
}

/** The scrim only fades; the panel fades + scales (the CardOverviewModal precedent). */
function overlayClasses(animated: boolean, visible: boolean) {
  if (!animated) return {scrimClass: undefined, panelClass: undefined};
  const visibleClass = visible ? ' overlay-visible' : '';
  return {
    scrimClass: `overlay-transition overlay-enter${visibleClass}`,
    panelClass: `overlay-transition overlay-scale overlay-enter${visibleClass}`,
  };
}

function scrimPresentation(
  scrim: 'default' | 'heavy',
  closable: boolean,
  zIndex: number,
): React.CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: scrim === 'heavy' ? COLORS.scrimHeavy : COLORS.scrim,
    zIndex,
    cursor: closable ? 'pointer' : undefined,
  };
}

function panelChrome(size: keyof typeof SIZE_MAX_WIDTH, goldRing: boolean): React.CSSProperties {
  return {
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
  };
}

/**
 * Sticky rather than absolute, in a ZERO-height row: the panel is the scroll
 * container, so an absolutely positioned × scrolls away in a long dialog, and a
 * normal-flow row would push every existing dialog's content down. Height 0 keeps
 * the layout untouched while sticky keeps the × reachable at any scroll position.
 */
function CloseButton({onClose}: {onClose: () => void}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        height: 0,
        zIndex: 1,
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
      <IconButton aria-label="Close" size={36} onClick={onClose}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </IconButton>
    </div>
  );
}

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
  showClose = true,
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
  useExitFallback(animated, isOpen, mounted, onTransitionEnd);
  useFocusRetry(animated, visible, panelRef, initialFocusRef);

  if (!rendered) return null;

  const tiers = LAYERS[layer];
  const {scrimClass, panelClass} = overlayClasses(animated, visible);

  const closable = !disableBackdropClose;
  const handleTransitionEnd = animated ? onTransitionEnd : undefined;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid={scrimTestId}
        onClick={closable ? onClose : undefined}
        className={scrimClass}
        onTransitionEnd={handleTransitionEnd}
        style={scrimPresentation(scrim, closable, tiers.scrim)}
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
          onTransitionEnd={handleTransitionEnd}
          style={{...panelChrome(size, goldRing), ...panelStyle}}>
          {showClose && <CloseButton onClose={onClose} />}
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
