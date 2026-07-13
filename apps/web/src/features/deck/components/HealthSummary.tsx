import type {CSSProperties} from 'react';
import {COLORS, FONT_SIZES, FONTS, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {DeckStatus} from '../types';
import {scoreTier} from './scoreTier';

/** How many warn/bad health dimensions to surface as flags in the compact summary. */
const MAX_FLAGS = 2;
/** Worst-first ordering: bad before warn before good. */
const STATUS_RANK: Record<DeckStatus, number> = {bad: 0, warn: 1, good: 2};

function statusColor(status: DeckStatus): string {
  return status === 'bad' ? COLORS.error : INK_COLORS.Amber.border;
}

const button: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  width: '100%',
  height: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: `${SPACING.sm}px ${SPACING.md}px ${SPACING.md}px`,
  fontFamily: FONTS.body,
};

const capLabel: CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.md}px`,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: COLORS.textMuted,
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
  const flags = [...analysis.health.analyzers]
    .filter((a) => a.status !== 'good')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.score - b.score)
    .slice(0, MAX_FLAGS);
  const riskCount = analysis.health.vulnerabilities.length;

  return (
    <button type="button" onClick={onOpenAnalysis} aria-label="Open deck analysis" style={button}>
      <span style={capLabel}>Deck health</span>
      <span style={{display: 'flex', alignItems: 'baseline', gap: 6}}>
        <span style={{fontFamily: FONTS.hero, fontSize: 26, lineHeight: 1, color: COLORS.text, fontVariantNumeric: 'tabular-nums'}}>
          {analysis.quality.score}
        </span>
        <span style={{fontSize: `${FONT_SIZES.xs}px`, fontWeight: 700, color: COLORS.background, background: tier.color, padding: '2px 7px', borderRadius: RADIUS.sm}}>
          {tier.label}
        </span>
      </span>
      {flags.map((f) => (
        <Flag key={f.id} color={statusColor(f.status)}>
          {f.label}
        </Flag>
      ))}
      {riskCount > 0 && (
        <Flag color={COLORS.error}>
          {riskCount} risk{riskCount === 1 ? '' : 's'}
        </Flag>
      )}
      <span style={link}>Analysis →</span>
    </button>
  );
}
