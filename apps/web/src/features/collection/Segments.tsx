import type {CSSProperties, MouseEventHandler, ReactNode} from 'react';
import {CtaButton} from '../../shared/components';
import {useHover} from 'inkweave-ui/hooks/useHover';
import {COLORS, DURATION, EASING, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING, TABULAR} from '../../shared/constants';

const SEGMENTS_STYLE: CSSProperties = {
  display: 'grid',
  gap: SPACING.xs,
  padding: SPACING.xs,
  borderRadius: `${RADIUS.lg}px`,
  background: COLORS.surfaceAlt,
  border: `1px solid ${COLORS.surfaceBorder}`,
};

/**
 * A row of segments, one of them chosen: the binder's All / Owned / Missing, and the set
 * picker's Standard / Promo (owner, 2026-10-20). `columns` is the row's grid:
 * equal segments, or segments as wide as their words.
 */
export function Segments({label, columns, children}: {label: string; columns: string; children: ReactNode}) {
  return (
    <div role="group" aria-label={label} style={{...SEGMENTS_STYLE, gridTemplateColumns: columns}}>
      {children}
    </div>
  );
}

/** The kit's neutral button as one segment: gold while chosen, washed on hover. */
function segmentStyle(active: boolean, hovered: boolean): CSSProperties {
  return {
    height: 32,
    minHeight: 32,
    padding: `0 ${SPACING.xs}px`,
    borderRadius: `${RADIUS.md}px`,
    border: `1px solid ${active ? GOLD_GLOW.activeBorder : 'transparent'}`,
    background: active ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    boxShadow: active ? GOLD_GLOW.shadow : 'none',
    color: active ? COLORS.primary : hovered ? COLORS.text : COLORS.textMuted,
    fontSize: `${FONT_SIZES.lg}px`,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    // Segments don't boop, as chips don't.
    transform: undefined,
    transition: `background ${DURATION.fast}ms ${EASING.snappy}, color ${DURATION.fast}ms ${EASING.snappy}`,
  };
}

/** A segment's count: a small pill, gold while its segment is chosen. */
function countStyle(active: boolean): CSSProperties {
  return {
    ...TABULAR,
    minWidth: 22,
    padding: `${SPACING.xxs}px ${SPACING.xs}px`,
    borderRadius: `${RADIUS.pill}px`,
    background: active ? GOLD_GLOW.activeBg : COLORS.surfaceHover,
    color: active ? COLORS.primary : COLORS.text,
    fontSize: `${FONT_SIZES.sm}px`,
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

interface SegmentProps {
  label: string;
  /** A picture before the label (the promo sets' symbol), hidden from assistive tech. */
  icon?: ReactNode;
  /** A count after the label, in a pill: how many cards the view holds (You need, #1045). */
  count?: number;
  /** How many of the row's grid columns it takes, where segments of two widths share a grid. */
  span?: number;
  active: boolean;
  onSelect: MouseEventHandler<HTMLButtonElement>;
  /** -1 where the row's arrows move focus rather than Tab (the set picker's menu). */
  tabIndex?: number;
}

export function Segment({label, icon, count, span, active, onSelect, tabIndex}: SegmentProps) {
  const {hovered, hoverProps} = useHover();
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      aria-pressed={active}
      tabIndex={tabIndex}
      onClick={onSelect}
      style={{...segmentStyle(active, hovered), ...(span && {gridColumn: `span ${span}`})}}>
      {icon}
      {label}
      {/* The space parts the two in the button's name; the flex gap parts them on screen. */}
      {count !== undefined && (
        <>
          {' '}
          <span style={countStyle(active)}>{count.toLocaleString('en-US')}</span>
        </>
      )}
    </CtaButton>
  );
}
