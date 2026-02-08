import {useState, memo} from 'react';
import type {GroupedSynergies, SynergyMatchDisplay} from '../types';
import {SynergyCard} from './SynergyCard';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';

interface SynergyGroupProps {
  group: GroupedSynergies;
  defaultExpanded?: boolean;
}

export function SynergyGroup({group, defaultExpanded = true}: SynergyGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{marginBottom: `${SPACING.xl}px`}}>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
          color: COLORS.gray700,
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}>
        <span
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}>
          &#9654;
        </span>
        {group.label} ({group.synergies.length})
      </button>
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
    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
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
