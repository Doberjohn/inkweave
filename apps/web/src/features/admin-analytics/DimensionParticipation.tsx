import {COLORS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import {dimensionStats} from './dimensionStats';
import type {DimensionFill} from './voteAnalyticsTypes';

/** Horizontal bars: what fraction of votes filled each dimension. */
export function DimensionParticipation({fill, totalVotes}: {fill: DimensionFill | null; totalVotes: number}) {
  const rows = dimensionStats(fill, totalVotes);
  return (
    <section
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.section,
      }}>
      <h3 style={{fontSize: FONT_SIZES.base, fontWeight: 600, margin: `0 0 ${SPACING.sm}px`}}>Dimension participation</h3>
      <div style={{display: 'flex', flexDirection: 'column', gap: 7}}>
        {rows.map((row) => (
          <div key={row.label} style={{display: 'flex', alignItems: 'center', gap: SPACING.sm, fontSize: FONT_SIZES.base}}>
            <span style={{width: 96, color: COLORS.textMuted}}>{row.label}</span>
            <div style={{flex: 1, height: 8, background: COLORS.surfaceAlt, borderRadius: RADIUS.sm, overflow: 'hidden'}}>
              <div style={{height: '100%', width: `${row.pct}%`, background: COLORS.primary, opacity: 0.7}} />
            </div>
            <span style={{width: 44, textAlign: 'right', color: COLORS.text, fontVariantNumeric: 'tabular-nums'}}>
              {row.pct}%
            </span>
          </div>
        ))}
      </div>
      <div style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim, marginTop: SPACING.sm}}>
        Which questions voters actually answer. who_carries excluded (98.8% default).
      </div>
    </section>
  );
}
