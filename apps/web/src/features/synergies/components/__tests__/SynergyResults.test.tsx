import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
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
    synergies: [{card: mockCard, score: 7, explanation: 'Shift'}],
  },
  {
    groupKey: 'lore-denial',
    category: 'playstyle',
    label: 'Lore Steal',
    description: 'Cards that prevent opponents from gaining lore',
    synergies: [{card: {...mockCard, id: '2'}, score: 5, explanation: 'Lore denial'}],
  },
];

describe('SynergyResults', () => {
  it('should render synergies title as h2 heading', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
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
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();
  });

  it('should render group filter chips', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', {name: 'All'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Shift Targets'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Lore Steal'})).toBeTruthy();
  });

  it('should render sort select', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', {name: 'Sort synergies'})).toBeTruthy();
  });

  it('should filter groups when chip is clicked', () => {
    render(
      <SynergyResults
        selectedCard={mockCard}
        synergies={mockSynergies}
        totalSynergyCount={2}
        onClearSelection={vi.fn()}
      />,
    );
    // Click "Shift Targets" chip
    fireEvent.click(screen.getByRole('button', {name: 'Shift Targets'}));
    const groups = screen.getAllByTestId('synergy-group');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent('Shift Targets');
  });
});
