import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SynergyGroup} from '../SynergyGroup';
import type {SynergyGroup as SynergyGroupData} from '../../types';

// Mock SynergyCard to avoid deep render
vi.mock('../SynergyCard', () => ({
  SynergyCard: ({card}: {card: {fullName: string}}) => (
    <div data-testid="synergy-card">{card.fullName}</div>
  ),
}));

function makeSynergy(id: string, name: string) {
  return {
    card: {id, fullName: name, name} as SynergyGroupData['synergies'][0]['card'],
    score: 7,
    explanation: 'Test synergy',
  };
}

const mockGroup: SynergyGroupData = {
  groupKey: 'shift-targets',
  category: 'direct',
  label: 'Shift Targets',
  description: 'Characters with Shift and their same-named targets',
  synergies: [makeSynergy('1', 'Elsa - Snow Queen')],
};

describe('SynergyGroup', () => {
  it('should render group name as an h3 heading', () => {
    render(<SynergyGroup group={mockGroup} />);
    expect(screen.getByRole('heading', {level: 3})).toHaveTextContent('Shift Targets');
  });

  it('should always render description', () => {
    render(<SynergyGroup group={mockGroup} />);
    expect(screen.getByText('Characters with Shift and their same-named targets')).toBeTruthy();
  });

  it('should render card count', () => {
    render(<SynergyGroup group={mockGroup} />);
    expect(screen.getByText('1 card')).toBeTruthy();
  });

  it('should render MoreTile when cards exceed maxVisibleCards', () => {
    const bigGroup = {
      ...mockGroup,
      synergies: Array.from({length: 8}, (_, i) => makeSynergy(String(i), `Card ${i}`)),
    };
    render(<SynergyGroup group={bigGroup} maxVisibleCards={6} />);
    expect(screen.getByLabelText('Show 2 more cards')).toBeTruthy();
  });

  it('should not render MoreTile when all cards fit', () => {
    render(<SynergyGroup group={mockGroup} maxVisibleCards={6} />);
    expect(screen.queryByText('more cards')).toBeNull();
  });
});
