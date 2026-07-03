import {COLORS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import type {WeeklyPoint} from './voteAnalyticsTypes';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-06-29" -> "Jun 29" (deterministic, no locale/Date parsing). */
function shortDate(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

interface WeeklyActivityChartProps {
  weekly: WeeklyPoint[];
  /** Date of the newest vote (YYYY-MM-DD); clarifies that the last (Monday-labeled) bar runs through today. */
  latestDate?: string;
}

/**
 * Votes-per-week bars. Each bar is one ISO week; the axis labels the first and
 * last week by their Monday ("week of ...") so the rightmost bar reads as the
 * current, in-progress week rather than a hard endpoint.
 */
export function WeeklyActivityChart({weekly, latestDate}: WeeklyActivityChartProps) {
  const max = Math.max(1, ...weekly.map((w) => w.votes));
  const first = weekly[0]?.week;
  const last = weekly[weekly.length - 1]?.week;
  return (
    <section
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.section,
      }}>
      <h3 style={{fontSize: FONT_SIZES.base, fontWeight: 600, margin: `0 0 ${SPACING.sm}px`}}>Weekly activity</h3>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 5, height: 72}}>
        {weekly.map((w) => (
          <div
            key={w.week}
            title={`Week of ${shortDate(w.week)}: ${w.votes} votes${w.meanGap == null ? '' : `, gap ${w.meanGap.toFixed(2)}`}`}
            style={{
              flex: 1,
              minHeight: 2,
              height: `${(w.votes / max) * 100}%`,
              background: COLORS.primary,
              opacity: 0.55,
              borderRadius: '2px 2px 0 0',
            }}
          />
        ))}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: FONT_SIZES.xs, color: COLORS.textDim}}>
        <span>{first ? `week of ${shortDate(first)}` : ''}</span>
        <span>{last ? `week of ${shortDate(last)}` : ''}</span>
      </div>
      {latestDate && (
        <div style={{marginTop: SPACING.xs, fontSize: FONT_SIZES.xs, color: COLORS.textDim}}>
          Bars are Monday-start weeks; the last bar runs through the latest vote ({shortDate(latestDate)}).
        </div>
      )}
    </section>
  );
}
