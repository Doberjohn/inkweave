import {memo} from 'react';
import type {LorcanaCard} from '../../cards';
import type {GroupedSynergies} from '../types';
import {getDominantStrength} from '../utils';
import {
  INK_COLORS,
  COLORS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  LAYOUT,
  STRENGTH_STYLES,
} from '../../../shared/constants';
import {CardImage, CardTextBlock, InkIcon} from '../../../shared/components';

interface CardDetailPanelProps {
  card: LorcanaCard;
  /** Synergy groups — when provided, renders the breakdown inline */
  synergies?: GroupedSynergies[];
  totalSynergyCount?: number;
}

export const CardDetailPanel = memo(function CardDetailPanel({
  card,
  synergies,
  totalSynergyCount,
}: CardDetailPanelProps) {
  const inkColors = INK_COLORS[card.ink];
  const hasSynergies = synergies && synergies.length > 0;

  return (
    <div
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
          width={220}
          height={308}
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
            fontSize: `${FONT_SIZES.xl}px`,
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
              fontSize: `${FONT_SIZES.base}px`,
              color: COLORS.textMuted,
              marginTop: 2,
            }}>
            {card.version}
          </div>
        )}
      </div>

      {/* Stats row: Ink, Cost, Type */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
        }}>
        <StatBadge bg={inkColors.bg} color={inkColors.text}>
          <span style={{display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
            <InkIcon ink={card.ink} size={14} />
            {card.ink}
          </span>
        </StatBadge>
        <StatBadge bg={COLORS.surfaceAlt} color={COLORS.textMuted}>
          Cost {card.cost}
        </StatBadge>
        <StatBadge bg={COLORS.surfaceAlt} color={COLORS.textMuted}>
          {card.type}
        </StatBadge>
      </div>

      {/* Character stats: Strength / Willpower / Lore */}
      {card.type === 'Character' && (
        <div
          style={{
            display: 'flex',
            gap: `${SPACING.md}px`,
            justifyContent: 'center',
            padding: `${SPACING.sm}px 0`,
          }}>
          {card.strength !== undefined && (
            <StatCircle label="STR" value={card.strength} color="#ef4444" />
          )}
          {card.willpower !== undefined && (
            <StatCircle label="WIL" value={card.willpower} color="#3b82f6" />
          )}
          {card.lore !== undefined && <StatCircle label="LORE" value={card.lore} color="#d4af37" />}
        </div>
      )}

      {/* Keywords */}
      {card.keywords && card.keywords.length > 0 && (
        <div style={{display: 'flex', gap: '4px', flexWrap: 'wrap'}}>
          {card.keywords.map((kw) => (
            <span
              key={kw}
              style={{
                background: COLORS.primary100,
                color: COLORS.primary,
                padding: '3px 8px',
                borderRadius: `${RADIUS.sm}px`,
                fontSize: `${FONT_SIZES.xs}px`,
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}>
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Classifications */}
      {card.classifications && card.classifications.length > 0 && (
        <div
          style={{
            fontSize: `${FONT_SIZES.sm}px`,
            color: COLORS.textMuted,
          }}>
          {card.classifications.join(' · ')}
        </div>
      )}

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
                  key={group.type}
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
    </div>
  );
});

function StatBadge({bg, color, children}: {bg: string; color: string; children: React.ReactNode}) {
  return (
    <span
      style={{
        background: bg,
        color,
        padding: '3px 8px',
        borderRadius: `${RADIUS.sm}px`,
        fontSize: `${FONT_SIZES.xs}px`,
        fontWeight: 500,
      }}>
      {children}
    </span>
  );
}

function StatCircle({label, value, color}: {label: string; value: number; color: string}) {
  return (
    <div style={{textAlign: 'center'}}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
        }}>
        <span
          style={{
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 700,
            color,
          }}>
          {value}
        </span>
      </div>
      <div
        style={{
          fontSize: `${FONT_SIZES.xs}px`,
          color: COLORS.textMuted,
          marginTop: 2,
          letterSpacing: '0.05em',
        }}>
        {label}
      </div>
    </div>
  );
}
