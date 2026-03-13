import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SynergyResults} from '../SynergyResults';
import type {SynergyGroup as SynergyGroupData} from '../../types';
import type {LorcanaCard} from '../../../cards';
import {createCard, createSynergyGroup} from '../../../../shared/test-utils';

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

const mockCard = createCard({
  id: '1',
  fullName: 'Elsa - Snow Queen',
  name: 'Elsa',
  ink: 'Amethyst',
  cost: 4,
});

const mockSynergies: SynergyGroupData[] = [
  createSynergyGroup({
    groupKey: 'shift-targets',
    category: 'direct',
    label: 'Shift Targets',
    synergies: [{card: mockCard, score: 7, explanation: 'Shift'}],
  }),
  createSynergyGroup({
    groupKey: 'lore-denial',
    category: 'playstyle',
    label: 'Lore Steal',
    description: 'Cards that prevent opponents from gaining lore',
    synergies: [{card: {...mockCard, id: '2'}, score: 5, explanation: 'Lore denial'}],
  }),
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
