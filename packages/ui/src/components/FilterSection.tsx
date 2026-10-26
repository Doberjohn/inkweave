import {useId, useState} from 'react';
import {COLORS, DURATION, EASING, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING, TOUCH_TARGET, TRUNCATE} from '../tokens/theme';
import {useHover} from '../hooks/useHover';
import {LinkButton} from './LinkButton';

interface FilterSectionProps {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
  /**
   * Make the header a toggle that folds the section (Browse's docked panel, owner
   * 2026-10-08, and a phone's filter sheet, owner 2026-10-26). `defaultOpen` is whether
   * it STARTS open; after that the reader owns it. `touch` gives the toggle a
   * `TOUCH_TARGET`-tall tap area, for a phone. Left undefined, the section is always
   * open, as in the desktop dialog.
   */
  collapsible?: {defaultOpen: boolean; touch?: boolean};
  /**
   * What is selected inside, shown beside the label WHILE FOLDED ("Type · Character"),
   * so a filter is never active and invisible at once.
   */
  summary?: string;
  /**
   * At the far end of the header line: the docked panel's "Clear all", on its first
   * section. The label's toggle, hover wash included, stops short of it (owner, 2026-10-12).
   */
  action?: React.ReactNode;
}

const labelStyle = (compact: boolean): React.CSSProperties => ({
  fontSize: `${FONT_SIZES.base}px`,
  color: COLORS.gray700,
  marginBottom: compact ? SPACING.xs : SPACING.sm,
  fontWeight: 500,
  letterSpacing: '0.02em',
});

/**
 * How far the header's hover wash reaches past its text on each side. Negative margins
 * give the room back, so the text stays exactly where it was, level with the section's
 * contents below it.
 */
const WASH_BLEED = 6;

/** The folding header's height at rest: its 13 px label's 16 px line, and 4 px above and below. */
const HEADER_LINE = 24;

/**
 * On a phone, how far the toggle's tap area reaches above and below the header line, so
 * it is `TOUCH_TARGET` tall. Negative margins give the room back, so the line keeps its
 * height, and the section's contents, later in the page, keep their taps where they meet.
 * The toggle's `minHeight` holds the target if the line comes out shorter than 16 px.
 */
const TOUCH_REACH = (TOUCH_TARGET - HEADER_LINE) / 2;

/**
 * The header line: the label or its toggle, and the action at the far end when there is
 * one. The gap covers the wash's bleed past the toggle and a clear `SPACING.sm` after it,
 * so the wash ends short of the action rather than running under it.
 */
function HeaderLine({action, children}: {action?: React.ReactNode; children: React.ReactNode}) {
  if (!action) return <>{children}</>;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: WASH_BLEED + SPACING.sm}}>
      <div style={{flex: 1, minWidth: 0}}>{children}</div>
      <span style={{display: 'flex', flexShrink: 0}}>{action}</span>
    </div>
  );
}

/**
 * The folding header: a chevron, the label, and the summary while folded. The WHOLE
 * LINE is the toggle (owner, 2026-10-12), and hovering it lays a faint gold wash across
 * the line as well as lifting the text, so the line, not just the word, reads as the control.
 */
function ToggleLabel({label, open, summary, controls, touch, onToggle}: {
  label: string;
  open: boolean;
  summary?: string;
  controls: string;
  touch?: boolean;
  onToggle: () => void;
}) {
  // LinkButton keeps its own hover (it lifts the text) and passes no mouse handlers
  // through, so the wash reads the same pointer from this wrapper, which the button fills.
  const {hovered, hoverProps} = useHover();
  const reach = touch ? TOUCH_REACH : 0;
  return (
    <div {...hoverProps}>
      <LinkButton
        tone="muted"
        underlineOnHover={false}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controls}
        // The base size matches the plain label. The muted tone reads dimmer at rest
        // (textMuted, where the label is gray700) and lifts to full text on hover.
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.xs,
          width: `calc(100% + ${2 * WASH_BLEED}px)`,
          // LinkButton's own 2px of vertical padding, plus 2px of wash that the margin
          // gives back, so the header line keeps its height. On a phone, the tap area's
          // reach too.
          margin: `-${SPACING.xxs + reach}px -${WASH_BLEED}px`,
          padding: `${SPACING.xs + reach}px ${WASH_BLEED}px`,
          minHeight: touch ? TOUCH_TARGET : undefined,
          borderRadius: RADIUS.sm,
          background: hovered ? GOLD_GLOW.hoverBg : 'transparent',
          transition: `color ${DURATION.fast}ms ${EASING.snappy}, background ${DURATION.fast}ms ${EASING.snappy}`,
          letterSpacing: 'inherit',
        }}>
        <span aria-hidden style={{display: 'inline-block', width: 10, transform: open ? 'rotate(90deg)' : undefined}}>
          ›
        </span>
        {label}
        {!open && summary && <span style={{...TRUNCATE, color: COLORS.primary}}>· {summary}</span>}
      </LinkButton>
    </div>
  );
}

export function FilterSection({label, children, compact = false, collapsible, summary, action}: FilterSectionProps) {
  const [open, setOpen] = useState(collapsible?.defaultOpen ?? true);
  const bodyId = useId();
  const header = collapsible ? (
    <ToggleLabel
      label={label}
      open={open}
      summary={summary}
      controls={bodyId}
      touch={collapsible.touch}
      onToggle={() => setOpen(!open)}
    />
  ) : (
    label
  );
  return (
    <div style={{marginBottom: compact ? `${SPACING.md}px` : `${SPACING.xl}px`}}>
      <div style={labelStyle(compact)}>
        <HeaderLine action={action}>{header}</HeaderLine>
      </div>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
