import {useState, memo} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup} from '../types';
import {getDominantScore, getStrengthTier} from '../utils';
import {COLORS, FONT_SIZES, RADIUS, SPACING, LAYOUT} from '../../../shared/constants';
import {CardImage, CardTextBlock} from '../../../shared/components';

interface CardDetailPanelProps {
  card: LorcanaCard;
  /** Synergy groups — when provided, renders the breakdown inline */
  synergies?: SynergyGroup[];
  onGroupClick?: (groupKey: string) => void;
  /** Currently active group filter — highlights the matching row */
  activeGroupKey?: string | null;
}

export const CardDetailPanel = memo(function CardDetailPanel({
  card,
  synergies,
  onGroupClick,
  activeGroupKey,
}: CardDetailPanelProps) {
  const hasSynergies = synergies && synergies.length > 0;
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

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
        gap: `${SPACING.lg}px`,
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
              fontSize: `${FONT_SIZES.base}px`,
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
            padding: `${SPACING.md}px`,
            background: COLORS.surfaceAlt,
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.surfaceBorder}`,
          }}>
          <CardTextBlock card={card} />
        </div>
      )}

      {/* Synergy Breakdown */}
      {hasSynergies && (
        <div
          data-testid="synergy-breakdown"
          style={{
            padding: `${SPACING.md}px`,
            background: COLORS.surfaceAlt,
            borderRadius: `${RADIUS.md}px`,
            border: `1px solid ${COLORS.surfaceBorder}`,
          }}>
          {/* Header */}
          <div
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 600,
              color: COLORS.textMuted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
            Synergy Breakdown
          </div>

          {/* Rows */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            {synergies.map((group) => {
              const tier = getStrengthTier(getDominantScore(group.synergies));
              const isHovered = hoveredGroup === group.groupKey;
              const isActive = activeGroupKey === group.groupKey;
              return (
                <div
                  key={group.groupKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => onGroupClick?.(group.groupKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onGroupClick?.(group.groupKey);
                    }
                  }}
                  onMouseEnter={() => setHoveredGroup(group.groupKey)}
                  onMouseLeave={() => setHoveredGroup(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    borderRadius: `${RADIUS.sm}px`,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    background: isActive
                      ? 'rgba(212, 175, 55, 0.12)'
                      : isHovered
                        ? 'rgba(212, 175, 55, 0.08)'
                        : 'transparent',
                    border: isActive
                      ? '1px solid rgba(212, 175, 55, 0.3)'
                      : '1px solid transparent',
                  }}>
                  {/* Count circle */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: tier.bg,
                      color: tier.color,
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
                      fontSize: `${FONT_SIZES.base}px`,
                      color: COLORS.text,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                    {group.label}
                  </div>

                  {/* Arrow */}
                  <span
                    style={{
                      fontSize: `${FONT_SIZES.xs}px`,
                      color: isHovered ? COLORS.primary500 : COLORS.textMuted,
                      transition: 'color 0.15s',
                    }}>
                    &rarr;
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
});
