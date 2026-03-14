import type {Playstyle, PlaystyleId} from '../types';

const playstyles: Playstyle[] = [
  {
    id: 'lore-denial',
    name: 'Lore Steal',
    description:
      'Cards that make your opponent lose lore. Stacking these creates a consistent denial strategy that pressures your opponent while you gain lore.',
  },
  {
    id: 'location-control',
    name: 'Locations',
    description:
      'Cards that synergize through location-based gameplay. Moving characters to locations, buffing them there, and triggering location payoffs.',
  },
  {
    id: 'discard',
    name: 'Discard',
    description:
      'Force opponents to discard cards while leveraging hand-size advantage. Stack discard enablers to empty their hand, then capitalize with cards that reward having more cards than your opponent.',
  },
];

const playstyleMap = new Map(playstyles.map((p) => [p.id, p]));

export const getAllPlaystyles = (): Playstyle[] => [...playstyles];

export const getPlaystyleById = (id: PlaystyleId): Playstyle | undefined => playstyleMap.get(id);
