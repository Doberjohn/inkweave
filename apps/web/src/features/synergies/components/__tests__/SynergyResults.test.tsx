import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SynergyResults} from '../SynergyResults';
import type {SynergyGroup as SynergyGroupData} from '../../types';
import type {LorcanaCard} from '../../../cards';

// Mock child components
vi.mock('../SynergyGroup', () => ({
  SynergyGroup: ({group}: {group: SynergyGroupData}) => (
    <div data-testid="synergy-group">{group.label}</div>
  ),
}));

vi.mock('.', () => ({
  CardDetail: ({card}: {card: LorcanaCard}) => <div data-testid="card-detail">{card.name}</div>,
  SynergyGroup: ({group}: {group: SynergyGroupData}) => (
    <div data-testid="synergy-group">{group.label}</div>
  ),
}));

vi.mock('../../../shared/components', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

const mockCard: LorcanaCard = {
  id: '1',
  fullName: 'Elsa - Snow Queen',
  name: 'Elsa',
  type: 'Character',
  ink: 'Amethyst',
  cost: 4,
  inkwell: true,
  set: {code: '5', name: 'Shimmering Skies', number: 5},
  rarity: 'Rare',
  number: 42,
  classifications: [],
} as LorcanaCard;

const mockSynergies: SynergyGroupData[] = [
  {
    groupKey: 'shift-targets',
    category: 'direct',
    label: 'Shift Targets',
    description: 'Characters with Shift and their same-named targets',
    synergies: [{card: mockCard, strength: 'strong', explanation: 'Shift'}],
  },
];

describe('SynergyResults', () => {
  it('should render synergies title as h2 heading', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={1}
        onClearSelection={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('Synergies');
  });

  it('should wrap content in a section element', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={1}
        onClearSelection={vi.fn()}
      />,
    );

    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();
  });
});
