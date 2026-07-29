import {COLORS, FONT_SIZES, FONTS, hexRgba, INK_COLORS, SPACING} from '../../../shared/constants';
import type {Ink} from '../types';
import {toColumns, totalCopies} from './costCurveColumns';

/** Fixed chart-area height in px; each bar fills a 0..100% of it. */
const CHART_HEIGHT = 52;

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
        padding: '15px 15px 8px 15px',
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
              title={`${col.count} card${col.count === 1 ? '' : 's'} at cost ${col.label}`}
              style={{
                flex: 1,
                height: `${col.heightPct}%`,
                minHeight: col.count > 0 ? 2 : 0,
                borderRadius: '2px 2px 0 0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column-reverse',
                background: COLORS.surfaceAlt,
                boxShadow: col.count > 0 ? `0 0 5px ${hexRgba(glow, 0.5)}, 0 0 12px ${hexRgba(glow, 0.24)}` : 'none',
              }}>
              {col.segments.map((seg) => (
                <div key={seg.ink} style={{width: '100%', height: `${seg.pct}%`, background: INK_COLORS[seg.ink].border}} />
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
