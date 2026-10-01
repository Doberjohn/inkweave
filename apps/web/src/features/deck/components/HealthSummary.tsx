import type {CSSProperties} from 'react';
import {CAP_LABEL, COLORS, FONT_SIZES, FONTS, SPACING} from '../../../shared/constants';
import {BetaTag} from '../../../shared/components';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import {PrioritiesView, RadarMedallion, VitalsView, type HealthVariant} from './HealthVariants';

const button: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  // 15px top/sides, 8px bottom — matches CostCurveStrip so the title sits high and the
  // lens body below fills the rest of the fixed-height row.
  padding: '15px 15px 8px 15px',
  fontFamily: FONTS.body,
};

const capLabel: CSSProperties = {...CAP_LABEL, marginBottom: SPACING.lg};

interface HealthSummaryProps {
  analysis: DeckAnalysis | null;
  isLoading: boolean;
  /** Set when the advisor pipeline failed; shown as an "unavailable" note. */
  error?: Error | null;
  /**
   * Opens the full advisor. Optional: the Analysis tab is currently removed from
   * the panel, so the cell renders as a non-interactive summary when omitted.
   */
  onOpenAnalysis?: () => void;
  /** Which health-cell lens to render (dropdown, #472). */
  variant?: HealthVariant;
}

/**
 * Compact, always-visible deck-health preview in the slot beside the cost curve on the
 * Cards tab (#472). The whole card is a button that opens the Analysis tab; the visible
 * lens is chosen by the dropdown (Priorities / Vitals / Radar) — see HealthVariants.
 * Prop-driven off `useDeckAnalysis`.
 */
export function HealthSummary({analysis, isLoading, error, onOpenAnalysis, variant = 'priorities'}: HealthSummaryProps) {
  return (
    <button type="button" onClick={onOpenAnalysis} aria-label="Open deck analysis" disabled={!onOpenAnalysis} style={button}>
      <span style={capLabel}>
        Deck health
        <BetaTag style={{marginLeft: 6}} />
      </span>
      {analysis ? (
        variant === 'radar' ? (
          <RadarMedallion analysis={analysis} />
        ) : variant === 'vitals' ? (
          <VitalsView analysis={analysis} />
        ) : (
          <PrioritiesView analysis={analysis} />
        )
      ) : (
        <span style={{fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textDim}}>
          {error ? 'Analysis unavailable' : isLoading ? 'Analyzing…' : 'Add cards to analyze'}
        </span>
      )}
    </button>
  );
}
