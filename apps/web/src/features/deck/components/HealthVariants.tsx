import {COLORS, FONTS, FONT_SIZES, hexRgba} from '../../../shared/constants';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {HealthAnalyzer} from '../types';
import {scoreTier} from './scoreTier';
import {ScoreRing} from './ScoreRing';
import {dimensionColor} from './dimensionColor';

/** Which health-cell lens to render (dropdown, #472). All three share the overall
 *  ring; they differ in which dimensions they surface (or, for radar, the shape). */
export type HealthVariant = 'priorities' | 'vitals' | 'radar';

/** Fills the cell below the "Deck health" title (the title + button shell stay in HealthSummary). */
const body = {flex: 1, minHeight: 0} as const;

/** Compact dimension labels for the ring row (full labels overflow a 58px ring). */
const SHORT_LABEL: Record<string, string> = {
  curve: 'Curve',
  inkable: 'Inkable',
  draw: 'Draw',
  removal: 'Removal',
  actionsCap: 'Actions',
  typeMix: 'Types',
  ruleOfEight: 'Rule of 8',
  consistency: 'Consist.',
  lore: 'Lore',
  shiftCoverage: 'Shift',
  synergyDensity: 'Synergy',
};
function shortLabel(a: HealthAnalyzer): string {
  return SHORT_LABEL[a.id] ?? a.label.split(' ')[0];
}

// ─────────────────────────── dimension selection ───────────────────────────

/** Priorities: the dimensions dragging the overall score down the most — ranked by
 *  points lost (`weight × (100 − score)`), so the sub-rings EXPLAIN the overall. */
function selectDragDimensions(analysis: DeckAnalysis): HealthAnalyzer[] {
  const weightById = new Map(analysis.quality.breakdown.map((b) => [b.dimension, b.weight]));
  return [...analysis.health.analyzers]
    .map((a) => ({a, drag: (weightById.get(a.id) ?? 0) * (100 - a.score)}))
    .sort((x, y) => y.drag - x.drag)
    .slice(0, 3)
    .map((x) => x.a);
}

/** Vitals: the three deck fundamentals, always the same axes for a stable reference. */
const VITALS_DIMS = ['curve', 'inkable', 'draw'];
function selectVitalsDimensions(analyzers: HealthAnalyzer[]): HealthAnalyzer[] {
  const byId = new Map(analyzers.map((a) => [a.id, a]));
  const picked = VITALS_DIMS.map((id) => byId.get(id)).filter((a): a is HealthAnalyzer => a !== undefined);
  for (const a of analyzers) {
    if (picked.length >= 3) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked.slice(0, 3);
}

// ─────────────────────────── shared ring layout ───────────────────────────
// Overall hero ring + archetype/risk caption + a ROW of dimension rings.

function DimensionRingsView({analysis, dims}: {analysis: DeckAnalysis; dims: HealthAnalyzer[]}) {
  const tier = scoreTier(analysis.quality.score);
  const riskCount = analysis.health.vulnerabilities.length;
  return (
    <div style={{...body, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8}}>
      <ScoreRing score={analysis.quality.score} color={tier.color} size={82} />
      <div style={{display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONTS.body, fontSize: FONT_SIZES.xs}}>
        <span style={{letterSpacing: '0.1em', textTransform: 'uppercase', color: COLORS.textMuted, fontWeight: 600}}>
          <span style={{color: COLORS.primary}}>◆</span> {analysis.health.archetype}
        </span>
        {riskCount > 0 && (
          <span style={{color: COLORS.textDim, fontWeight: 600}}>
            · <span style={{color: COLORS.error, fontWeight: 700}}>{riskCount}</span> risk{riskCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div style={{display: 'flex', justifyContent: 'center', gap: 12, marginTop: 2}}>
        {dims.map((d) => (
          <div key={d.id} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3}}>
            <ScoreRing score={d.score} color={dimensionColor(d.status)} size={58} />
            <span style={{fontFamily: FONTS.body, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontWeight: 600, whiteSpace: 'nowrap'}}>
              {shortLabel(d)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Default lens: the deck's biggest score drags — the sub-rings explain the overall. */
export function PrioritiesView({analysis}: {analysis: DeckAnalysis}) {
  return <DimensionRingsView analysis={analysis} dims={selectDragDimensions(analysis)} />;
}

/** Fundamentals lens: Curve / Inkable / Card Draw as a stable reference. */
export function VitalsView({analysis}: {analysis: DeckAnalysis}) {
  return <DimensionRingsView analysis={analysis} dims={selectVitalsDimensions(analysis.health.analyzers)} />;
}

// ═══════════════════════════════ Radar Medallion ════════════════════════════════
// Score coin at the center of a 6-axis radar — the deck's whole health SHAPE.

/** Preferred 6 axes (falls back to whatever analyzers exist, up to 6). */
const RADAR_PREF = ['curve', 'inkable', 'draw', 'consistency', 'removal', 'lore'];
const RADAR_ABBR: Record<string, string> = {
  curve: 'Curve',
  inkable: 'Ink',
  draw: 'Draw',
  consistency: 'Cons',
  removal: 'Rem',
  lore: 'Lore',
};
const CX = 110;
const CY = 88;
const R = 58;

function pickRadarDimensions(analyzers: HealthAnalyzer[]): HealthAnalyzer[] {
  const byId = new Map(analyzers.map((a) => [a.id, a]));
  const preferred = RADAR_PREF.map((id) => byId.get(id)).filter((a): a is HealthAnalyzer => a !== undefined);
  const rest = analyzers.filter((a) => !RADAR_PREF.includes(a.id));
  return [...preferred, ...rest].slice(0, 6);
}

/** Cartesian point `dist` from the centre along axis `i` of `n`, starting at 12 o'clock. */
function pointAt(dist: number, i: number, n: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [CX + dist * Math.cos(angle), CY + dist * Math.sin(angle)];
}
function ring(fraction: number, n: number): string {
  return Array.from({length: n}, (_, i) => pointAt(fraction * R, i, n).map((v) => v.toFixed(1)).join(',')).join(' ');
}

export function RadarMedallion({analysis}: {analysis: DeckAnalysis}) {
  const dims = pickRadarDimensions(analysis.health.analyzers);
  const n = dims.length;
  const tier = scoreTier(analysis.quality.score);
  const riskCount = analysis.health.vulnerabilities.length;
  const dataVerts = dims.map((d, i) => pointAt((Math.max(0, Math.min(100, d.score)) / 100) * R, i, n));
  const dataPoints = dataVerts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div style={{...body, display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center', fontFamily: FONTS.body}}>
      <svg viewBox="0 0 220 172" style={{display: 'block', margin: '0 auto', height: 150, width: 'auto', maxWidth: '100%'}}>
        <polygon points={ring(1, n)} fill="none" stroke={COLORS.surfaceBorder} strokeWidth={1} />
        <polygon points={ring(0.5, n)} fill="none" stroke={COLORS.surfaceBorder} strokeWidth={1} opacity={0.55} />
        <g stroke={COLORS.surfaceBorder} strokeWidth={0.7} opacity={0.55}>
          {dims.map((_, i) => {
            const [x, y] = pointAt(R, i, n);
            return <line key={i} x1={CX} y1={CY} x2={x} y2={y} />;
          })}
        </g>
        <polygon points={dataPoints} fill={hexRgba(tier.color, 0.15)} stroke={tier.color} strokeWidth={1.6} strokeLinejoin="round" />
        {dataVerts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill={dimensionColor(dims[i].status)} />
        ))}
        <circle cx={CX} cy={CY} r={22} fill={COLORS.surfaceAlt} stroke={COLORS.surfaceBorder} strokeWidth={1} />
        <text x={CX} y={CY + 2} textAnchor="middle" dominantBaseline="middle" fontFamily={FONTS.body} fontWeight={700} fontSize={29} fill={tier.color}>
          {analysis.quality.score}
        </text>
        {dims.map((d, i) => {
          const [lx, ly] = pointAt(R + 15, i, n);
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontFamily={FONTS.body} fontSize={11} fill={COLORS.textMuted}>
              {RADAR_ABBR[d.id] ?? d.label.split(' ')[0]}
            </text>
          );
        })}
      </svg>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
          borderTop: `1px solid ${COLORS.surfaceBorder}`,
          fontSize: FONT_SIZES.sm,
        }}>
        <span style={{color: COLORS.textMuted, textTransform: 'capitalize'}}>{analysis.health.archetype}</span>
        <span style={{color: COLORS.textMuted}}>
          <span style={{color: tier.color, fontWeight: 600}}>{riskCount}</span> risk{riskCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}
