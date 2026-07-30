import {COLORS, FONT_SIZES, FONTS, hexRgba, INK_COLORS, SPACING} from '../../../shared/constants';
import type {Ink} from '../types';
import {toColumns, totalCopies} from './costCurveColumns';

/** Minimum chart-area height in px; each bar fills a 0..100% of it. */
const CHART_HEIGHT = 52;

/**
 * Smallest a single ink band may render. This is a hover-target size, not a
 * spacing step, so it sits outside ICON_SIZE deliberately (same reasoning as
 * DeckProfile's SYMBOL_SIZE). Flex honours it before distributing the remainder.
 *
 * INVARIANT: MIN_BAND_PX * 6 inks (48) must stay <= CHART_HEIGHT (52). A
 * maximally split bucket's floors have to fit the chart area, which has no
 * overflow guard: overshoot pushes the bar up through the padding into the tab
 * strip. Raising this constant means raising CHART_HEIGHT with it.
 */
const MIN_BAND_PX = 8;

/** Smallest a nonzero bar may render when it has no bands to fit. */
const MIN_BAR_PX = 2;

interface CostCurveStripProps {
  /** Cost -> copy count (drives bar heights). */
  costCurve: Record<number, number>;
  /** Cost -> ink -> copy count (drives the ink-colored segments). */
  costCurveByInk: Record<number, Partial<Record<Ink, number>>>;
}

/**
 * A compact mana-cost histogram pinned above the Cards-tab deck list — the
 * cost-curve mini-chart + ink split of the DeckStatsBar (#468). Presentation-only:
 * it renders the `costCurve` / `costCurveByInk` from calculateDeckStats, one bar
 * per cost bucket (top bucket labelled "7+"), stacked into design-system ink
 * colors by composition and glowing its dominant ink. Copy counts live on each
 * bar's hover title (kept intentionally minimal — no numeric labels or legend).
 * Hidden while the deck is empty. Bar styling mirrors WeeklyActivityChart (div
 * bars, no SVG).
 */
export function CostCurveStrip({costCurve, costCurveByInk}: CostCurveStripProps) {
  if (totalCopies(costCurve) === 0) return null;
  const columns = toColumns(costCurve, costCurveByInk);

  return (
    <section
      aria-label="Cost curve"
      style={{
        flexShrink: 0,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        // The tab strip above names this view, so the chart carries no visible title;
        // `aria-label` keeps the section named for assistive tech.
        padding: '25px 10px 8px 30px',
      }}>
      {/* flex:1 lets the chart grow to fill the section height (min CHART_HEIGHT) so the
          bars scale with the row instead of leaving a void, and the axis below stays
          grounded just above the bottom padding. Bar heights are a % of this area. */}
      <div style={{display: 'flex', alignItems: 'flex-end', gap: SPACING.xs, flex: 1, minHeight: CHART_HEIGHT}}>
        {columns.map((col) => {
          // Glow the bar in its own dominant ink (like the CTA glows its own orange).
          const glowInk = col.segments.length
            ? col.segments.reduce((a, b) => (b.pct > a.pct ? b : a)).ink
            : null;
          const glow = glowInk ? INK_COLORS[glowInk].border : COLORS.primary;
          return (
            <div
              key={col.bucket}
              data-bucket={col.bucket}
              title={`${col.count} card${col.count === 1 ? '' : 's'} at cost ${col.label}`}
              style={{
                flex: 1,
                height: `${col.heightPct}%`,
                // A bar must be tall enough for every band's floor, or the bands
                // overflow and `overflow: hidden` silently clips an entire ink.
                minHeight: col.count > 0 ? Math.max(MIN_BAR_PX, MIN_BAND_PX * col.segments.length) : 0,
                borderRadius: '2px 2px 0 0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column-reverse',
                background: COLORS.surfaceAlt,
                boxShadow: col.count > 0 ? `0 0 5px ${hexRgba(glow, 0.5)}, 0 0 12px ${hexRgba(glow, 0.24)}` : 'none',
              }}>
              {col.segments.map((seg) => (
                <div
                  key={seg.ink}
                  // Grow proportionally to the count from a zero basis, but never
                  // below MIN_BAND_PX: flex floors the small bands and shares what
                  // is left among the rest, which is the sizing rule we want.
                  style={{
                    flex: `${seg.count} 1 0`,
                    minHeight: MIN_BAND_PX,
                    width: '100%',
                    background: INK_COLORS[seg.ink].border,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div style={{display: 'flex', gap: SPACING.xs, marginTop: 6}}>
        {columns.map((col) => (
          <span
            key={col.bucket}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.xs}px`,
              color: COLORS.textMuted,
            }}>
            {col.label}
          </span>
        ))}
      </div>
    </section>
  );
}
