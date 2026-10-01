import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import type {HealthAnalyzer, Vulnerability} from '../types';
import {dimensionColor} from './dimensionColor';

interface HealthGlanceProps {
  analyzers: HealthAnalyzer[];
  vulnerabilities: Vulnerability[];
}

/** Worst status first, so the biggest problem becomes the callout. */
const STATUS_RANK: Record<HealthAnalyzer['status'], number> = {bad: 0, warn: 1, good: 2};

/** The single most important thing wrong, or null when every dimension is healthy. */
function worstMessage(analyzers: HealthAnalyzer[]): string | null {
  const problems = analyzers
    .filter((a) => a.status !== 'good')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  return problems[0]?.message ?? null;
}

/**
 * Zone 3 of the Analysis tab (#471): a compact, jargon-free health read — one
 * colored dot per dimension (reusing dimensionColor's traffic-light), plus a
 * single "biggest issue" callout from the worst-status analyzer (falling back to
 * the top vulnerability). The full per-dimension breakdown lives in Details.
 */
export function HealthGlance({analyzers, vulnerabilities}: HealthGlanceProps) {
  const callout = worstMessage(analyzers) ?? vulnerabilities[0]?.message ?? null;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
      <div style={{display: 'flex', flexWrap: 'wrap', columnGap: SPACING.md, rowGap: SPACING.xs}}>
        {analyzers.map((a) => (
          <span
            key={a.id}
            style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textMuted}}>
            <span aria-hidden style={{width: 8, height: 8, borderRadius: '50%', background: dimensionColor(a.status), flexShrink: 0}} />
            {a.label}
          </span>
        ))}
      </div>
      {callout && (
        <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.text}}>
          <span aria-hidden style={{color: COLORS.error}}>▲</span> {callout}
        </div>
      )}
    </div>
  );
}
