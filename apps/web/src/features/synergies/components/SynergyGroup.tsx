import {useState, memo} from 'react';
import type {SynergyGroup as SynergyGroupData, SynergyMatchDisplay} from '../types';
import {SynergyCard} from './SynergyCard';
import {COLORS, FONT_SIZES, LAYOUT, SPACING, RADIUS} from '../../../shared/constants';

interface SynergyGroupProps {
  group: SynergyGroupData;
  defaultExpanded?: boolean;
}

export const SynergyGroup = memo(function SynergyGroup({
  group,
  defaultExpanded = true,
}: SynergyGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{marginBottom: `${SPACING.xl}px`}}>
      {/* Group header: title + strength badge + count */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
          color: COLORS.text,
          marginBottom: `${SPACING.xs}px`,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          width: '100%',
        }}>
        <span
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            fontSize: `${FONT_SIZES.sm}px`,
          }}>
          &#9654;
        </span>
        <h3 style={{margin: 0, fontSize: 'inherit', fontWeight: 'inherit'}}>{group.label}</h3>
        {/* Count */}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: `${FONT_SIZES.sm}px`,
            color: COLORS.textMuted,
            fontWeight: 400,
            textTransform: 'none',
            letterSpacing: 0,
          }}>
          {group.synergies.length} card{group.synergies.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Group description */}
      {expanded && (
        <div
          style={{
            margin: `${SPACING.sm}px 0 ${SPACING.md}px 0`,
            padding: `${SPACING.sm}px ${SPACING.md}px`,
            background: COLORS.primary100,
            borderLeft: `3px solid ${COLORS.primary}`,
            borderRadius: `0 ${RADIUS.sm}px ${RADIUS.sm}px 0`,
          }}>
          <p
            style={{
              margin: 0,
              fontSize: `${FONT_SIZES.base}px`,
              color: COLORS.text,
              lineHeight: 1.5,
            }}>
            {group.description}
          </p>
        </div>
      )}

      {/* Card grid */}
      {expanded && <SynergyCardList synergies={group.synergies} />}
    </div>
  );
});

// Memoized card list to prevent re-renders when parent toggles expansion
interface SynergyCardListProps {
  synergies: SynergyMatchDisplay[];
}

const SynergyCardList = memo(function SynergyCardList({synergies}: SynergyCardListProps) {
  return (
    <ul
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${LAYOUT.synergyCardMinWidth}px, 1fr))`,
        gap: '10px',
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}>
      {synergies.map((synergy) => (
        <li key={synergy.card.id}>
          <SynergyCard
            card={synergy.card}
            strength={synergy.strength}
            explanation={synergy.explanation}
          />
        </li>
      ))}
    </ul>
  );
});
