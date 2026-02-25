import {memo} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup} from '../types';
import {getDominantStrength} from '../utils';
import {
  COLORS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  LAYOUT,
  STRENGTH_STYLES,
} from '../../../shared/constants';
import {CardImage, CardTextBlock} from '../../../shared/components';

interface CardDetailPanelProps {
  card: LorcanaCard;
  /** Synergy groups — when provided, renders the breakdown inline */
  synergies?: SynergyGroup[];
  totalSynergyCount?: number;
}

export const CardDetailPanel = memo(function CardDetailPanel({
  card,
  synergies,
  totalSynergyCount,
}: CardDetailPanelProps) {
  const hasSynergies = synergies && synergies.length > 0;

  return (
    <article
      data-testid="card-detail-panel"
      style={{
        width: `${LAYOUT.cardDetailWidth}px`,
        minWidth: `${LAYOUT.cardDetailWidth}px`,
        borderRight: `1px solid ${COLORS.surfaceBorder}`,
        background: COLORS.surface,
        overflowY: 'auto',
        maxHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
        display: 'flex',
        flexDirection: 'column',
        padding: `${SPACING.lg}px`,
        gap: `${SPACING.md}px`,
        boxSizing: 'border-box',
      }}>
      {/* Card image */}
      <div style={{display: 'flex', justifyContent: 'center'}}>
        <CardImage
          src={card.imageUrl ?? card.thumbnailUrl}
          alt={card.fullName}
          width={298}
          height={417}
          inkColor={card.ink}
          cost={card.cost}
          lazy={false}
          borderRadius={RADIUS.xl}
        />
      </div>

      {/* Card name + version */}
      <div>
        <h2
          style={{
            fontSize: `${FONT_SIZES.xxl}px`,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
            lineHeight: 1.2,
          }}>
          {card.name}
        </h2>
        {card.version && (
          <div
            style={{
              fontSize: `${FONT_SIZES.lg}px`,
              color: COLORS.textMuted,
              marginTop: 3,
            }}>
            {card.version}
          </div>
        )}
      </div>

      {/* Card text */}
      {(card.textSections?.length || card.text) && (
        <div
          style={{
            padding: `${SPACING.sm}px`,
            background: COLORS.surfaceAlt,
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.surfaceBorder}`,
          }}>
          <CardTextBlock card={card} />
        </div>
      )}

      {/* Synergy Breakdown (inline, replaces standalone SynergyBreakdown column) */}
      {hasSynergies && (
        <div data-testid="synergy-breakdown">
          {/* Divider */}
          <div style={{height: 1, background: COLORS.surfaceBorder, marginBottom: SPACING.md}} />

          {/* Header */}
          <div
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 600,
              color: COLORS.textMuted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: SPACING.sm,
            }}>
            Synergy Breakdown
          </div>

          {/* Groups */}
          <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
            {synergies.map((group) => {
              const strength = getDominantStrength(group.synergies);
              const strengthStyle = STRENGTH_STYLES[strength];
              return (
                <div
                  key={group.groupKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.sm,
                  }}>
                  {/* Count circle */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: strengthStyle.bg,
                      color: strengthStyle.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: `${FONT_SIZES.xs}px`,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                    {group.synergies.length}
                  </div>

                  {/* Label */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: `${FONT_SIZES.sm}px`,
                      color: COLORS.text,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                    {group.label}
                  </div>

                  {/* Strength badge */}
                  <span
                    style={{
                      fontSize: `${FONT_SIZES.xs}px`,
                      color: strengthStyle.text,
                      background: strengthStyle.bg,
                      padding: '1px 6px',
                      borderRadius: `${RADIUS.sm}px`,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                      flexShrink: 0,
                    }}>
                    {strength}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div
            style={{
              marginTop: SPACING.md,
              padding: `${SPACING.sm}px`,
              background: COLORS.surfaceAlt,
              borderRadius: `${RADIUS.md}px`,
              textAlign: 'center',
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.textMuted,
            }}>
            <span style={{color: COLORS.primary, fontWeight: 700}}>{totalSynergyCount}</span>{' '}
            synergies found
          </div>
        </div>
      )}
    </article>
  );
});
