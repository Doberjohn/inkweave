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

const mockGroup: SynergyGroupData = {
  groupKey: 'shift-targets',
  category: 'direct',
  label: 'Shift Targets',
  description: 'Characters with Shift and their same-named targets',
  synergies: [
    {
      card: {
        id: '1',
        fullName: 'Elsa - Snow Queen',
        name: 'Elsa',
      } as SynergyGroupData['synergies'][0]['card'],
      strength: 'strong',
      explanation: 'Shift synergy',
    },
  ],
};

describe('SynergyGroup', () => {
  it('should render group name as an h3 heading', () => {
    render(<SynergyGroup group={mockGroup} />);

    expect(screen.getByRole('heading', {level: 3})).toHaveTextContent('Shift Targets');
  });
});
