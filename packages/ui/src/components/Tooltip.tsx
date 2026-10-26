import {useRef, useState, useLayoutEffect, type ReactNode, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {COLORS, FONT_SIZES, GOLD_GLOW, RADIUS, SHADOWS, Z_INDEX} from '../tokens/theme';
import {useTooltip} from '../hooks/useTooltip';

const TIP_GAP = 8;
const TIP_MARGIN = 8;
const TIP_MAX_WIDTH = 240;

interface TooltipProps {
  /**
   * The trigger (e.g. a `?` button), given the id its focusable control names in
   * `aria-describedby`: the tooltip's while it shows, else undefined. The tooltip shows on hover
   * or focus within it.
   */
  children: (describedBy: string | undefined) => ReactNode;
  /** Tooltip body. Newlines (`\n`) are preserved via `white-space: pre-line`. */
  content: string;
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
 *
 * It takes the pointer and hides on Escape (`useTooltip`, WCAG 1.4.13), and renders only while it
 * shows.
 */
export function Tooltip({children, content, triggerStyle}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const {open, describedBy, triggerProps, tooltipProps} = useTooltip();
  const [placement, setPlacement] = useState<'above' | 'below'>('above');
  const [coords, setCoords] = useState<{top: number; left: number}>({top: -9999, left: -9999});

  // Position on every show (and on resize while visible).
  useLayoutEffect(() => {
    if (!open) return;
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
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        {...triggerProps}
        style={{display: 'inline-flex', alignItems: 'center', ...triggerStyle}}>
        {children(describedBy)}
      </span>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            {...tooltipProps}
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
              borderRadius: RADIUS.md,
              boxShadow: SHADOWS.float,
              fontSize: FONT_SIZES.sm,
              lineHeight: 1.6,
              color: COLORS.descriptionText,
              textAlign: 'left',
              whiteSpace: 'pre-line',
              // Must clear Z_INDEX.modal (1000) — tooltip is portal'd to document.body but the
              // modal still stacks above unless we explicitly out-rank it (#510: the named
              // popover tier, not modal + 100 arithmetic that happened to equal it).
              zIndex: Z_INDEX.popover,
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

/** The "?" circle: small, gold and round, as the comparison's score has always shown it. */
const HELP_BUTTON_STYLE: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: GOLD_GLOW.hoverBg,
  border: `1px solid ${GOLD_GLOW.hoverBorder}`,
  color: COLORS.primary,
  fontSize: FONT_SIZES.sm,
  fontWeight: 700,
  cursor: 'help',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  padding: 0,
};

interface HelpTooltipProps {
  /** The help text. Newlines are kept. */
  content: string;
  /** The button's name, e.g. "What does this score mean?". */
  label: string;
  /** Style for the wrapper around the button: where it sits in its row. */
  style?: CSSProperties;
}

/** A "?" help circle that shows `content` on hover or focus, described by it while it shows. */
export function HelpTooltip({content, label, style}: HelpTooltipProps) {
  return (
    <Tooltip content={content} triggerStyle={style}>
      {(describedBy) => (
        <button
          type="button"
          aria-label={label}
          aria-describedby={describedBy}
          style={HELP_BUTTON_STYLE}>
          ?
        </button>
      )}
    </Tooltip>
  );
}
