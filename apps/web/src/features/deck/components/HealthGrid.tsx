import {useState} from 'react';
import type {CSSProperties} from 'react';
import {CAP_LABEL, COLORS, FONTS, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING} from '../../../shared/constants';
import type {HealthAnalyzer, ScoreContribution} from '../types';
import {dimensionColor} from './dimensionColor';
import {ScoreRing} from './ScoreRing';

/** Section header cap, matching ScoreGauge / VulnerabilityBox. */
const capLabel: CSSProperties = {...CAP_LABEL, marginBottom: SPACING.md};

/**
 * Grid caption per analyzer id. Display-only: the brain's full `label` stays the
 * canonical name (detail slot, score breakdown, future package exports); this map
 * just keeps captions unambiguous at ring width. Naive first-word truncation made
 * Card Draw and Card Types both read "Card", hence explicit entries. Unknown ids
 * fall back to the full label.
 */
const SHORT_LABELS: Record<string, string> = {
  curve: 'Curve',
  inkable: 'Inkable',
  draw: 'Draw',
  removal: 'Removal',
  actionsCap: 'Actions',
  typeMix: 'Card Types',
  ruleOfEight: 'Rule of 8',
  consistency: 'Consistency',
  lore: 'Lore',
  shiftCoverage: 'Shift',
  synergyDensity: 'Synergy',
};

/** Triage rank per status: problems first, then warnings, then healthy dimensions. */
const STATUS_RANK: Record<HealthAnalyzer['status'], number> = {bad: 0, warn: 1, good: 2};

/**
 * Presentation order for the grid: status-grouped (bad → warn → good) with ties
 * broken by the brain's build order. Grouping clusters trouble at the top-left;
 * the build-order tiebreak keeps cells from reshuffling on every edit (a
 * score-sorted grid would jump while the user tunes the deck).
 * `Array.prototype.sort` is stable (ES2019+), which is what preserves the
 * build order within each status group.
 */
export function orderAnalyzers(analyzers: HealthAnalyzer[]): HealthAnalyzer[] {
  return [...analyzers].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
}

/**
 * The advisor panel's per-dimension health view (#472, the V3 "ring grid" ruling):
 * every analyzer as a selectable score ring, worst statuses leading, with one
 * detail slot below showing the selected dimension's verdict and its point
 * contribution from the glass-box breakdown. Scan first, read second; the full
 * prose lives one tap away instead of stacking eleven paragraphs.
 */
export function HealthGrid({analyzers, breakdown}: {analyzers: HealthAnalyzer[]; breakdown: ScoreContribution[]}) {
  const ordered = orderAnalyzers(analyzers);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Default to the worst dimension (first cell); an explicit pick sticks until
  // its analyzer disappears, then we fall back to the worst again.
  const active = ordered.find((a) => a.id === selectedId) ?? ordered[0];
  const points = active ? breakdown.find((b) => b.dimension === active.id) : undefined;

  if (ordered.length === 0) return null;

  return (
    <div style={{background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, borderRadius: RADIUS.card, padding: SPACING.lg}}>
      <div style={capLabel}>Health by dimension</div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: SPACING.md, justifyItems: 'center'}}>
        {ordered.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedId(a.id)}
            aria-pressed={a.id === active.id}
            style={{
              // #511 selection rule: never `outline`; a stable 2px border (transparent
              // when unselected) + gold glow encodes the active ring.
              border: a.id === active.id ? `2px solid ${COLORS.primary}` : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: RADIUS.md,
              padding: 4,
              boxShadow: a.id === active.id ? GOLD_GLOW.shadow : 'none',
            }}>
            <ScoreRing score={a.score} color={dimensionColor(a.status)} size={40} label={SHORT_LABELS[a.id] ?? a.label} />
          </button>
        ))}
      </div>
      <div style={{marginTop: SPACING.md, borderTop: `1px solid ${COLORS.surfaceBorder}`, paddingTop: SPACING.md}}>
        <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, fontWeight: 700, color: COLORS.text}}>
          {active.label} · {active.score}
          {points && (
            <span
              style={{
                marginLeft: 8,
                fontSize: `${FONT_SIZES.sm}px`,
                color: points.contribution < 0 ? COLORS.error : COLORS.textMuted,
                fontVariantNumeric: 'tabular-nums',
              }}>
              {points.contribution >= 0 ? '+' : ''}
              {Math.round(points.contribution)} points
            </span>
          )}
        </div>
        <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, lineHeight: 1.4, color: COLORS.textMuted}}>
          {active.message}
        </div>
      </div>
    </div>
  );
}
