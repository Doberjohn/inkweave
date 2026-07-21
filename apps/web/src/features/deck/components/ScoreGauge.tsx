import {useState} from 'react';
import {COLORS, FONT_SIZES, FONTS, hexRgba, RADIUS, SPACING} from '../../../shared/constants';
import type {QualityScore, ScoreContribution} from '../types';
import {scoreTier} from './scoreTier';

/** The subtractive vulnerability-penalty row id — always rendered last, below a divider. */
const PENALTY_ID = 'vulnerability-penalty';
/** Positive-dimension rows shown before the "show all" toggle. */
const TOP_N = 5;

/** Display labels for the score dimensions (mirrors the analyzers' + penalty labels). */
const DIMENSION_LABELS: Record<string, string> = {
  curve: 'Curve',
  inkable: 'Inkable Ratio',
  draw: 'Card Draw',
  removal: 'Removal',
  actionsCap: 'Actions & Songs',
  typeMix: 'Card Types',
  ruleOfEight: 'Rule of Eight',
  consistency: 'Consistency',
  lore: 'Lore Output',
  shiftCoverage: 'Shift Coverage',
  synergyDensity: 'Synergy Density',
  [PENALTY_ID]: 'Vulnerabilities',
};

/** Label for a dimension id, title-casing an unmapped id defensively (no build break). */
function labelFor(dimension: string): string {
  return (
    DIMENSION_LABELS[dimension] ??
    dimension
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .replace(/^./, (c) => c.toUpperCase())
      .trim()
  );
}

const toggleButton: React.CSSProperties = {
  alignSelf: 'flex-start',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: COLORS.primary,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.md}px`,
  padding: '2px 0',
};

/** One breakdown row: signed points + dimension label + reason. */
function BreakdownRow({row}: {row: ScoreContribution}) {
  const points = Math.round(row.contribution);
  const signed = points > 0 ? `+${points}` : `${points}`;
  return (
    <div style={{display: 'flex', alignItems: 'baseline', gap: SPACING.sm}}>
      <span
        style={{
          width: 28,
          flexShrink: 0,
          textAlign: 'right',
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: points < 0 ? COLORS.error : COLORS.text,
        }}>
        {signed}
      </span>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, color: COLORS.text}}>{labelFor(row.dimension)}</div>
        <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, lineHeight: 1.4, color: COLORS.textMuted}}>{row.reason}</div>
      </div>
    </div>
  );
}

/**
 * The Deck Quality Score display (#472): the composite 0..100 score from
 * `score.ts` with a tier chip + quality meter, and the glass-box breakdown (each
 * weighted dimension's point contribution + reason, vulnerability penalty last).
 * Top contributors show by default; "show all" reveals the rest. Pure/prop-driven
 * — the page's useDeckAnalysis hook produces the {@link QualityScore}.
 */
export function ScoreGauge({quality}: {quality: QualityScore}) {
  const [showAll, setShowAll] = useState(false);
  const tier = scoreTier(quality.score);

  const analyzers = quality.breakdown
    .filter((b) => b.dimension !== PENALTY_ID)
    .sort((a, b) => b.contribution - a.contribution);
  const penalty = quality.breakdown.find((b) => b.dimension === PENALTY_ID);
  const shown = showAll ? analyzers : analyzers.slice(0, TOP_N);
  const hidden = analyzers.length - shown.length;

  return (
    <div style={{background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, borderRadius: RADIUS.card, padding: SPACING.lg}}>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.md}px`,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: COLORS.textMuted,
          marginBottom: SPACING.md,
        }}>
        Deck quality score
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: COLORS.primary,
            border: `1px solid ${hexRgba(COLORS.primary, 0.4)}`,
            borderRadius: 3,
            padding: '1px 4px',
            marginLeft: 6,
            verticalAlign: 'middle',
          }}>
          BETA
        </span>
      </div>

      <div style={{display: 'flex', alignItems: 'baseline', gap: SPACING.md, marginBottom: SPACING.md}}>
        <span style={{fontFamily: FONTS.hero, fontSize: 52, lineHeight: 1, color: COLORS.text, fontVariantNumeric: 'tabular-nums'}}>{quality.score}</span>
        <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xl}px`, color: COLORS.textDim}}>/100</span>
        <span
          style={{
            marginLeft: 'auto',
            alignSelf: 'center',
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.md}px`,
            fontWeight: 700,
            color: COLORS.background,
            background: tier.color,
            padding: '3px 10px',
            borderRadius: RADIUS.md,
          }}>
          {tier.label}
        </span>
      </div>

      <div style={{height: 8, borderRadius: RADIUS.sm, background: COLORS.surfaceAlt, overflow: 'hidden', marginBottom: SPACING.lg}}>
        <div style={{width: `${quality.score}%`, height: '100%', background: tier.color, transition: 'width 0.3s ease'}} />
      </div>

      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.md}px`,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: COLORS.textMuted,
          marginBottom: SPACING.sm,
        }}>
        Score breakdown
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 7}}>
        {shown.map((row) => (
          <BreakdownRow key={row.dimension} row={row} />
        ))}
        {hidden > 0 && (
          <button type="button" onClick={() => setShowAll(true)} style={toggleButton}>
            Show {hidden} more
          </button>
        )}
        {showAll && analyzers.length > TOP_N && (
          <button type="button" onClick={() => setShowAll(false)} style={toggleButton}>
            Show less
          </button>
        )}
        {penalty && (
          <div style={{borderTop: `1px solid ${COLORS.surfaceBorder}`, marginTop: 2, paddingTop: SPACING.sm}}>
            <BreakdownRow row={penalty} />
          </div>
        )}
      </div>

      <div style={{marginTop: SPACING.md, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim, lineHeight: 1.5}}>
        <span style={{color: COLORS.primary, fontWeight: 700}}>Beta scoring.</span> Targets are still being calibrated
        against real decks — treat this as a rough guide, not a verdict.
        <br />
        Inkweave Engine Score · config {quality.configVersion} · transparent weighted formula
      </div>
    </div>
  );
}
