import {COLORS, FONTS, FONT_SIZES, hexRgba} from '../../../shared/constants';
import type {Archetype} from '../types';

/** Display labels for the six archetypes (canonical union in types.ts). */
export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  aggro: 'Aggro',
  tempo: 'Tempo',
  midrange: 'Midrange',
  control: 'Control',
  combo: 'Combo',
  ramp: 'Ramp',
};

/** One-line read of each gameplan, shown under the archetype name. */
const ARCHETYPE_HINTS: Record<Archetype, string> = {
  aggro: 'Race to 20 lore with cheap early pressure',
  tempo: 'Stay ahead through efficient exchanges',
  midrange: 'Flexible threats and value trades',
  control: 'Answer the board, win the long game',
  combo: 'Assemble a decisive engine and fire it',
  ramp: 'Jump ahead on ink into oversized finishers',
};

/**
 * Confidence phrasing for the auto-detected archetype. Thresholds are coarse on
 * purpose: the classifier's confidence is a heuristic, so the copy only claims
 * three distinguishable states rather than a false-precision percentage.
 */
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return 'Detected';
  if (confidence >= 0.5) return 'Likely';
  return 'Leaning';
}

/**
 * The deck's strategy identity for the advisor panel (#472): archetype name +
 * one-line gameplan hint, with provenance (declared by the user vs auto-detected
 * with coarse confidence). Pure and prop-driven; the panel derives `declared`
 * from `deck.gameplan != null`.
 */
export function ArchetypeBadge({archetype, confidence, declared}: {archetype: Archetype; confidence: number; declared?: boolean}) {
  const provenance = declared ? 'Declared gameplan' : `${confidenceLabel(confidence)} gameplan`;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          flexShrink: 0,
          background: COLORS.primary,
          transform: 'rotate(45deg)',
          boxShadow: `0 0 8px ${hexRgba(COLORS.primary, 0.5)}`,
        }}
      />
      <div style={{minWidth: 0}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap'}}>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.lg}px`,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: COLORS.text,
            }}>
            {ARCHETYPE_LABELS[archetype]}
          </span>
          <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim}}>{provenance}</span>
        </div>
        <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textMuted, lineHeight: 1.4}}>
          {ARCHETYPE_HINTS[archetype]}
        </div>
      </div>
    </div>
  );
}
