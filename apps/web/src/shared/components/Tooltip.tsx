import {useRef, useState, useLayoutEffect, type ReactNode, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {COLORS, Z_INDEX} from '../constants';

const TIP_GAP = 8;
const TIP_MARGIN = 8;
const TIP_MAX_WIDTH = 240;

interface TooltipProps {
  /** Trigger element (e.g. a `?` button). The tooltip is shown on hover/focus of this element. */
  children: ReactNode;
  /** Tooltip body. Newlines (`\n`) are preserved via `white-space: pre-line`. */
  content: string;
  /** Optional aria-label for the trigger when its visible text is just an icon ("?"). */
  triggerAriaLabel?: string;
  /** Style overrides for the trigger wrapper (the `<span>` wrapping `children`). */
  triggerStyle?: CSSProperties;
}

/**
 * Floating tooltip — viewport-aware placement (above/below based on headroom), portal-rendered
 * so it escapes parent overflow/clip contexts.
 *
 * Mirrors the phase-2 mockup pattern (`apps/web/public/mockups/card-modal-phase2.html`):
 * - Light theme bg + muted border, multi-line content via `pre-line`
 * - Tail/arrow points back to the trigger
 * - Position recalculated on each show; clamped to viewport edges
 */
export function Tooltip({children, content, triggerAriaLabel, triggerStyle}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const [coords, setCoords] = useState<{top: number; left: number}>({top: -9999, left: -9999});

  // Position on every show (and on resize while visible).
  useLayoutEffect(() => {
    if (!visible) return;
    const tipEl = tooltipRef.current;
    const triggerEl = triggerRef.current;
    if (!tipEl || !triggerEl) return;

    const reposition = () => {
      const triggerRect = triggerEl.getBoundingClientRect();
      const tipRect = tipEl.getBoundingClientRect();
      const aboveTop = triggerRect.top - tipRect.height - TIP_GAP;
      const place = aboveTop < TIP_MARGIN ? 'below' : 'above';
      const top = place === 'above' ? aboveTop : triggerRect.bottom + TIP_GAP;
      const rawLeft = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2;
      const left = Math.min(
        Math.max(rawLeft, TIP_MARGIN),
        window.innerWidth - tipRect.width - TIP_MARGIN,
      );
      setPlacement(place);
      setCoords({top, left});
    };

    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
        aria-label={triggerAriaLabel}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        style={{display: 'inline-flex', alignItems: 'center', ...triggerStyle}}>
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            data-placement={placement}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 'max-content',
              maxWidth: TIP_MAX_WIDTH,
              padding: '10px 14px',
              background: COLORS.background,
              border: `1px solid ${COLORS.surfaceBorder}`,
              borderRadius: 6,
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5)',
              fontSize: 11,
              lineHeight: 1.6,
              color: COLORS.descriptionText,
              textAlign: 'left',
              whiteSpace: 'pre-line',
              pointerEvents: 'none',
              // Must clear Z_INDEX.modal (1000) — tooltip is portal'd to document.body but the
              // modal still stacks above unless we explicitly out-rank it.
              zIndex: Z_INDEX.modal + 100,
            }}>
            {content}
            <TooltipArrow placement={placement} />
          </div>,
          document.body,
        )}
    </>
  );
}

function TooltipArrow({placement}: {placement: 'above' | 'below'}) {
  // Arrow style mirrors mockup `.floating-tooltip::after`: 6px solid border with one face colored.
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        border: '6px solid transparent',
        ...(placement === 'above'
          ? {top: '100%', borderTopColor: COLORS.surfaceBorder}
          : {bottom: '100%', borderBottomColor: COLORS.surfaceBorder}),
      }}
    />
  );
}
