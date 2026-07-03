import {COLORS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';

export interface ScorecardProps {
  value: string;
  label: string;
  hint?: string;
  emphasis?: boolean;
  rawTag?: boolean;
}

/** A single stat card. `emphasis` golds the number; `rawTag` marks raw-votes-derived stats. */
export function Scorecard({value, label, hint, emphasis, rawTag}: ScorecardProps) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${emphasis ? COLORS.primary200 : COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
      }}>
      <div style={{fontSize: FONT_SIZES.xxl, fontWeight: 700, color: emphasis ? COLORS.primary : COLORS.text}}>
        {value}
      </div>
      <div style={{fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: 3, lineHeight: 1.3}}>
        {label}
        {rawTag && (
          <span
            style={{
              fontSize: 9,
              color: COLORS.textDim,
              border: `1px solid ${COLORS.surfaceBorder}`,
              borderRadius: RADIUS.xs,
              padding: '0 4px',
              marginLeft: 4,
            }}>
            raw
          </span>
        )}
        {hint && <span style={{display: 'block', color: COLORS.textDim}}>{hint}</span>}
      </div>
    </div>
  );
}

/** A responsive row of scorecards. */
export function ScorecardRow({children}: {children: React.ReactNode}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: SPACING.sm,
        marginBottom: SPACING.section,
      }}>
      {children}
    </div>
  );
}
