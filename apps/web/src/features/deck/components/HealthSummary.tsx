import type {CSSProperties} from 'react';
import {COLORS, FONT_SIZES, FONTS, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {DeckStatus} from '../types';
import {scoreTier} from './scoreTier';

/** How many signals (risks + worst health dimensions) the compact summary shows. */
const MAX_SIGNALS = 2;
/** Worst-first ordering: bad before warn before good. */
const STATUS_RANK: Record<DeckStatus, number> = {bad: 0, warn: 1, good: 2};

function statusColor(status: DeckStatus): string {
  return status === 'bad' ? COLORS.error : INK_COLORS.Amber.border;
}

const button: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  // 15px top/sides, 8px bottom — matches CostCurveStrip; the body centers the
  // score/signals and the "Analysis →" link sits at the foot via marginTop:auto.
  padding: '15px 15px 8px 15px',
  fontFamily: FONTS.body,
};

const capLabel: CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.md}px`,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: COLORS.textMuted,
  marginBottom: SPACING.lg,
};

// Score + signals live in a flex-fill body that centers them between the high title
// and the footer link. The empty room here is where the #5 PageSpeed ring will land.
const healthBody: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 8,
};

const link: CSSProperties = {
  marginTop: 'auto',
  paddingTop: 4,
  fontSize: `${FONT_SIZES.sm}px`,
  fontWeight: 600,
  color: COLORS.primary,
};

function Flag({color, children}: {color: string; children: React.ReactNode}) {
  return (
    <span style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textMuted}}>
      <span style={{width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: color}} />
      {children}
    </span>
  );
}

interface HealthSummaryProps {
  analysis: DeckAnalysis | null;
  isLoading: boolean;
  /** Set when the advisor pipeline failed; shown as an "unavailable" note. */
  error?: Error | null;
  /** Switch the deck panel to the Analysis tab (the full DeckAdvisorPanel). */
  onOpenAnalysis: () => void;
}

/**
 * Compact, always-visible deck-health preview in the 1/3 slot beside the cost
 * curve on the Cards tab (#472). Shows the Deck Quality Score + tier and the one
 * or two sharpest health flags; the whole card is a button that opens the
 * Analysis tab (the full advisor). Prop-driven off `useDeckAnalysis`.
 */
export function HealthSummary({analysis, isLoading, error, onOpenAnalysis}: HealthSummaryProps) {
  if (!analysis) {
    return (
      <button type="button" onClick={onOpenAnalysis} aria-label="Open deck analysis" style={button}>
        <span style={capLabel}>Deck health</span>
        <span style={{fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textDim}}>
          {error ? 'Analysis unavailable' : isLoading ? 'Analyzing…' : 'Add cards to analyze'}
        </span>
        <span style={link}>Analysis →</span>
      </button>
    );
  }

  const tier = scoreTier(analysis.quality.score);
  const riskCount = analysis.health.vulnerabilities.length;
  const flagSignals = [...analysis.health.analyzers]
    .filter((a) => a.status !== 'good')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.score - b.score)
    .map((a) => ({key: a.id, color: statusColor(a.status), text: a.label}));
  // Surface the sharpest signals: vulnerabilities first (they subtract points),
  // then the worst health dimensions. Capped so the summary stays a compact glance
  // roughly the height of the cost curve beside it.
  const signals = (
    riskCount > 0
      ? [{key: 'risks', color: COLORS.error, text: `${riskCount} risk${riskCount === 1 ? '' : 's'}`}, ...flagSignals]
      : flagSignals
  ).slice(0, MAX_SIGNALS);

  return (
    <button type="button" onClick={onOpenAnalysis} aria-label="Open deck analysis" style={button}>
      <span style={capLabel}>Deck health</span>
      <div style={healthBody}>
        <span style={{display: 'flex', alignItems: 'baseline', gap: 6}}>
          <span style={{fontFamily: FONTS.hero, fontSize: 20, lineHeight: 1, color: COLORS.text, fontVariantNumeric: 'tabular-nums'}}>
            {analysis.quality.score}
          </span>
          <span style={{fontSize: `${FONT_SIZES.xs}px`, fontWeight: 700, color: COLORS.background, background: tier.color, padding: '2px 7px', borderRadius: RADIUS.sm}}>
            {tier.label}
          </span>
        </span>
        {signals.map((s) => (
          <Flag key={s.key} color={s.color}>
            {s.text}
          </Flag>
        ))}
      </div>
      <span style={link}>Analysis →</span>
    </button>
  );
}
