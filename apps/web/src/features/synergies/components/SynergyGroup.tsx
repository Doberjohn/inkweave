import {useState, memo} from 'react';
import type {SynergyGroup as SynergyGroupData, SynergyMatchDisplay} from '../types';
import {SynergyCard} from './SynergyCard';
import {COLORS, FONT_SIZES, LAYOUT, SPACING, RADIUS} from '../../../shared/constants';

interface SynergyGroupProps {
  group: SynergyGroupData;
  isMobile?: boolean;
  maxVisibleCards?: number;
  onShowAll?: (groupKey: string) => void;
}

export const SynergyGroup = memo(function SynergyGroup({
  group,
  isMobile = false,
  maxVisibleCards = 6,
  onShowAll,
}: SynergyGroupProps) {
  return (
    <div data-group-key={group.groupKey} style={{marginBottom: `${SPACING.xl}px`}}>
      {/* Group header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
          color: COLORS.text,
          marginBottom: `${SPACING.sm}px`,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
        <h3 style={{margin: 0, fontSize: 'inherit', fontWeight: 'inherit'}}>{group.label}</h3>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.textMuted,
            fontWeight: 400,
            textTransform: 'none',
            letterSpacing: 0,
          }}>
          {group.synergies.length} card{group.synergies.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Group description callout */}
      <div
        style={{
          margin: `${SPACING.sm}px 0 ${SPACING.lg}px`,
          padding: `${SPACING.sm}px ${SPACING.md}px`,
          background: COLORS.calloutBg,
          borderLeft: `3px solid ${COLORS.primary}`,
          borderRadius: `0 ${RADIUS.sm}px ${RADIUS.sm}px 0`,
        }}>
        <p
          style={{
            margin: 0,
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.descriptionText,
            lineHeight: 1.5,
          }}>
          {group.description}
        </p>
      </div>

      {/* Card grid */}
      <SynergyCardList
        synergies={group.synergies}
        isMobile={isMobile}
        maxVisibleCards={maxVisibleCards}
        groupKey={group.groupKey}
        onShowAll={onShowAll}
      />
    </div>
  );
});

// MoreTile — dashed tile for overflowed cards
function MoreTile({
  count,
  onClick,
  isMobile,
}: {
  count: number;
  onClick?: () => void;
  isMobile?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Show ${count} more cards`}
      style={{
        position: 'relative',
        borderRadius: `${RADIUS.lg}px`,
        overflow: 'hidden',
        aspectRatio: '0.72',
        cursor: 'pointer',
        background: COLORS.surfaceAlt,
        border: `1px dashed ${hovered ? 'rgba(212, 175, 55, 0.35)' : '#444466'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isMobile ? '4px' : '6px',
        width: '100%',
        padding: 0,
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        transform: hovered ? 'scale(1.04) translateY(-3px)' : undefined,
        boxShadow: hovered ? '0 0 16px rgba(212, 175, 55, 0.15)' : undefined,
        fontFamily: 'inherit',
      }}>
      <span style={{fontSize: `${FONT_SIZES.xxl}px`, fontWeight: 700, color: COLORS.primary500}}>
        +{count}
      </span>
      <span style={{fontSize: `${FONT_SIZES.xs}px`, fontWeight: 500, color: COLORS.textMuted}}>
        more cards
      </span>
    </button>
  );
}

// Memoized card list with overflow handling
interface SynergyCardListProps {
  synergies: SynergyMatchDisplay[];
  isMobile: boolean;
  maxVisibleCards: number;
  groupKey: string;
  onShowAll?: (groupKey: string) => void;
}

const SynergyCardList = memo(function SynergyCardList({
  synergies,
  isMobile,
  maxVisibleCards,
  groupKey,
  onShowAll,
}: SynergyCardListProps) {
  const visible = synergies.slice(0, maxVisibleCards);
  const remaining = synergies.length - visible.length;

  return (
    <ul
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? 'repeat(3, 1fr)'
          : `repeat(auto-fill, minmax(${LAYOUT.synergyCardMinWidth}px, 1fr))`,
        gap: '10px',
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}>
      {visible.map((synergy) => (
        <li key={synergy.card.id}>
          <SynergyCard
            card={synergy.card}
            score={synergy.score}
            explanation={synergy.explanation}
            isMobile={isMobile}
          />
        </li>
      ))}
      {remaining > 0 && (
        <li>
          <MoreTile count={remaining} onClick={() => onShowAll?.(groupKey)} isMobile={isMobile} />
        </li>
      )}
    </ul>
  );
});
