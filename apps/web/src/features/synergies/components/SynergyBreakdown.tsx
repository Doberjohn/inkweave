import type {SynergyGroup} from '../types';
import {COLORS, FONT_SIZES, SPACING, TRUNCATE, FONT_WEIGHT, LETTER_SPACING, LINE_HEIGHT} from '../../../shared/constants';
import {getDominantScore, getStrengthTier} from '../utils';
import {StrengthBadge, TierCircle} from '../../../shared/components';

interface SynergyBreakdownProps {
  synergies: SynergyGroup[];
  totalCount: number;
}

export function SynergyBreakdown({
  synergies,
  totalCount,
}: SynergyBreakdownProps) {
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
            fontWeight: FONT_WEIGHT.semibold,
            color: COLORS.textMuted,
            letterSpacing: LETTER_SPACING.wide,
            textTransform: 'uppercase',
            marginBottom: `${SPACING.xs}px`,
          }}>
          Synergy Breakdown
        </div>
        <div
          style={{
            fontSize: `${FONT_SIZES.xxxl}px`,
            fontWeight: FONT_WEIGHT.bold,
            color: COLORS.primary,
          }}>
          {totalCount}
          <span
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.textMuted,
              fontWeight: FONT_WEIGHT.regular,
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
        const tier = getStrengthTier(getDominantScore(group.synergies));
        return (
          <div
            key={group.groupKey}
            style={{display: 'flex', alignItems: 'center', gap: `${SPACING.sm}px`}}>
            {/* Count circle */}
            <TierCircle tier={tier} size="md">
              {group.synergies.length}
            </TierCircle>

            {/* Label + strength badge */}
            <div style={{flex: 1, minWidth: 0}}>
              <div
                style={{
                  fontSize: `${FONT_SIZES.sm}px`,
                  color: COLORS.text,
                  fontWeight: FONT_WEIGHT.medium,
                  lineHeight: LINE_HEIGHT.tight,
                  ...TRUNCATE,
                }}>
                {group.label}
              </div>
              <StrengthBadge tier={tier} size="md">
                {tier.label}
              </StrengthBadge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
