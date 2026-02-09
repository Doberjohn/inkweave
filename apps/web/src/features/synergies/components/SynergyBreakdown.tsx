import type {GroupedSynergies, SynergyStrength} from '../types';
import {COLORS, FONT_SIZES, RADIUS, SPACING, STRENGTH_STYLES} from '../../../shared/constants';

interface SynergyBreakdownProps {
  synergies: GroupedSynergies[];
  totalCount: number;
}

const STRENGTH_ORDER: Record<SynergyStrength, number> = {
  strong: 3,
  moderate: 2,
  weak: 1,
};

function getDominantStrength(group: GroupedSynergies): SynergyStrength {
  let best: SynergyStrength = 'weak';
  for (const s of group.synergies) {
    if (STRENGTH_ORDER[s.strength] > STRENGTH_ORDER[best]) {
      best = s.strength;
    }
  }
  return best;
}

export function SynergyBreakdown({synergies, totalCount}: SynergyBreakdownProps) {
  if (synergies.length === 0) return null;

  return (
    <div
      data-testid="synergy-breakdown"
      style={{
        width: 180,
        minWidth: 180,
        borderLeft: `1px solid ${COLORS.surfaceBorder}`,
        background: COLORS.surface,
        padding: `${SPACING.lg}px ${SPACING.md}px`,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACING.md}px`,
      }}>
      {/* Header */}
      <div>
        <div
          style={{
            fontSize: `${FONT_SIZES.xs}px`,
            fontWeight: 600,
            color: COLORS.textMuted,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: `${SPACING.xs}px`,
          }}>
          Synergy Breakdown
        </div>
        <div
          style={{
            fontSize: `${FONT_SIZES.xxxl}px`,
            fontWeight: 700,
            color: COLORS.primary,
          }}>
          {totalCount}
          <span
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.textMuted,
              fontWeight: 400,
              marginLeft: 4,
            }}>
            cards
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{height: 1, background: COLORS.surfaceBorder}} />

      {/* Groups */}
      {synergies.map((group) => {
        const strength = getDominantStrength(group);
        const style = STRENGTH_STYLES[strength];
        return (
          <div key={group.type} style={{display: 'flex', alignItems: 'center', gap: `${SPACING.sm}px`}}>
            {/* Count circle */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: style.bg,
                color: style.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${FONT_SIZES.sm}px`,
                fontWeight: 700,
                flexShrink: 0,
              }}>
              {group.synergies.length}
            </div>

            {/* Label + strength badge */}
            <div style={{flex: 1, minWidth: 0}}>
              <div
                style={{
                  fontSize: `${FONT_SIZES.sm}px`,
                  color: COLORS.text,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                {group.label}
              </div>
              <span
                style={{
                  fontSize: `${FONT_SIZES.xs}px`,
                  color: style.text,
                  background: style.bg,
                  padding: '1px 6px',
                  borderRadius: `${RADIUS.sm}px`,
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}>
                {strength}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
