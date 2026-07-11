import {ALL_INKS, COLORS, FONT_SIZES, FONTS, hexRgba, INK_COLORS, SPACING} from '../../../shared/constants';
import type {Ink} from '../types';
import {toColumns, totalCopies} from './costCurveColumns';

/** Fixed chart-area height in px. */
const CHART_HEIGHT = 72;
/** Tallest a bar may grow, leaving headroom above it for the copy-count label + gap. */
const BAR_MAX_PX = 52;

interface CostCurveStripProps {
  /** Cost -> copy count (drives bar heights + the count labels). */
  costCurve: Record<number, number>;
  /** Cost -> ink -> copy count (drives the ink-colored segments). */
  costCurveByInk: Record<number, Partial<Record<Ink, number>>>;
}

function InkLegend({inks}: {inks: Ink[]}) {
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: `2px ${SPACING.sm}px`}}>
      {inks.map((ink) => (
        <span
          key={ink}
          style={{display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textMuted}}>
          <span style={{width: 8, height: 8, borderRadius: 2, background: INK_COLORS[ink].border}} />
          {ink}
        </span>
      ))}
    </div>
  );
}

/**
 * A compact mana-cost histogram pinned above the Cards-tab deck list — the
 * cost-curve mini-chart + ink split of the DeckStatsBar (#468). Presentation-only: it renders the
 * `costCurve` / `costCurveByInk` already produced by calculateDeckStats, one bar
 * per cost bucket (top bucket labelled "7+"), the bar split into design-system
 * ink colors by composition, with the copy count above and the cost below.
 * Hidden while the deck is empty so a fresh build doesn't show a flat axis. Bar
 * styling mirrors WeeklyActivityChart (div bars, no SVG); the height-scaling and
 * segment math live in costCurveColumns.
 */
export function CostCurveStrip({costCurve, costCurveByInk}: CostCurveStripProps) {
  if (totalCopies(costCurve) === 0) return null;
  const columns = toColumns(costCurve, costCurveByInk);
  const inks = ALL_INKS.filter((ink) => Object.values(costCurveByInk).some((m) => (m[ink] ?? 0) > 0));

  return (
    <section
      aria-label="Cost curve"
      style={{
        flexShrink: 0,
        padding: `${SPACING.sm}px ${SPACING.md}px ${SPACING.md}px`,
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
      }}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, marginBottom: SPACING.sm}}>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.md}px`,
            fontWeight: 700,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
          Cost curve
        </span>
        <InkLegend inks={inks} />
      </div>

      <div style={{display: 'flex', alignItems: 'flex-end', gap: SPACING.xs, height: CHART_HEIGHT}}>
        {columns.map((col) => {
          // Glow the bar in its own dominant ink (like the CTA glows its own
          // orange). Lives on the container: its overflow:hidden clips child
          // shadows, but a container's own box-shadow escapes the clip.
          const glowInk = col.segments.length
            ? col.segments.reduce((a, b) => (b.pct > a.pct ? b : a)).ink
            : null;
          const glow = glowInk ? INK_COLORS[glowInk].border : COLORS.primary;
          return (
            <div
              key={col.bucket}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 3,
              }}>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: `${FONT_SIZES.sm}px`,
                  lineHeight: 1,
                  color: col.count > 0 ? COLORS.text : COLORS.textDim,
                }}>
                {col.count}
              </span>
              <div
                title={`${col.count} card${col.count === 1 ? '' : 's'} at cost ${col.label}`}
                style={{
                  width: '100%',
                  height: Math.round((col.heightPct / 100) * BAR_MAX_PX),
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
