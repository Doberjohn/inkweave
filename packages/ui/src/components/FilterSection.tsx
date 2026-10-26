import {useId, useState} from 'react';
import {COLORS, DURATION, EASING, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING, TRUNCATE} from '../tokens/theme';
import {useHover} from '../hooks/useHover';
import {LinkButton} from './LinkButton';

interface FilterSectionProps {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
  /**
   * Make the header a toggle that folds the section (Browse's docked panel, owner
   * 2026-10-08). The value is whether it STARTS open; after that the reader owns
   * it. Left undefined, the section is always open, as in the dialog and drawer.
   */
  collapsible?: {defaultOpen: boolean};
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
function ToggleLabel({label, open, summary, controls, onToggle}: {
  label: string;
  open: boolean;
  summary?: string;
  controls: string;
  onToggle: () => void;
}) {
  // LinkButton keeps its own hover (it lifts the text) and passes no mouse handlers
  // through, so the wash reads the same pointer from this wrapper, which the button fills.
  const {hovered, hoverProps} = useHover();
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
          // gives back, so the header line keeps its height.
          margin: `-${SPACING.xxs}px -${WASH_BLEED}px`,
          padding: `${SPACING.xs}px ${WASH_BLEED}px`,
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
    <ToggleLabel label={label} open={open} summary={summary} controls={bodyId} onToggle={() => setOpen(!open)} />
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
