import {useState, memo} from 'react';
import type {GroupedSynergies, SynergyMatchDisplay, SynergyType} from '../types';
import {SynergyCard} from './SynergyCard';
import {COLORS, FONT_SIZES, SPACING, RADIUS, STRENGTH_STYLES} from '../../../shared/constants';
import {getDominantStrength} from '../utils';

/** Short explanation for each synergy group type */
const GROUP_EXPLANATIONS: Record<SynergyType, string> = {
  keyword: 'Cards that share or benefit from the same keyword abilities',
  classification: 'Cards that synergize through shared character types',
  shift: 'Floodborn cards that can shift onto these characters',
  named: 'Cards that specifically reference each other by name',
  mechanic: 'Cards that work together through game mechanics',
  ink: 'Cards that share ink color for deck-building synergy',
  'cost-curve': 'Cards that complement the mana curve progression',
};

interface SynergyGroupProps {
  group: GroupedSynergies;
  defaultExpanded?: boolean;
}

export function SynergyGroup({group, defaultExpanded = true}: SynergyGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const dominantStrength = getDominantStrength(group.synergies);
  const strengthStyle = STRENGTH_STYLES[dominantStrength];

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
        {group.label}
        {/* Strength badge */}
        <span
          style={{
            background: strengthStyle.bg,
            color: strengthStyle.text,
            padding: '2px 8px',
            borderRadius: `${RADIUS.sm}px`,
            fontSize: `${FONT_SIZES.xs}px`,
            fontWeight: 600,
            textTransform: 'capitalize',
            letterSpacing: 0,
          }}>
          {dominantStrength}
        </span>
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

      {/* Group explanation */}
      {expanded && (
        <p
          style={{
            margin: `0 0 ${SPACING.md}px 0`,
            fontSize: `${FONT_SIZES.sm}px`,
            color: COLORS.textMuted,
            lineHeight: 1.4,
            paddingLeft: `${SPACING.xl}px`,
          }}>
          {GROUP_EXPLANATIONS[group.type]}
        </p>
      )}

      {/* Card grid */}
      {expanded && <SynergyCardList synergies={group.synergies} />}
    </div>
  );
}

// Memoized card list to prevent re-renders when parent toggles expansion
interface SynergyCardListProps {
  synergies: SynergyMatchDisplay[];
}

const SynergyCardList = memo(function SynergyCardList({synergies}: SynergyCardListProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
        gap: '10px',
      }}>
      {synergies.map((synergy) => (
        <SynergyCard
          key={synergy.card.id}
          card={synergy.card}
          strength={synergy.strength}
          explanation={synergy.explanation}
        />
      ))}
    </div>
  );
});
