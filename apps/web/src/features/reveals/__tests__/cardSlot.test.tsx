import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardSlot} from '../CardSlot';

const card = {id: '13001', fullName: 'Test Card', ink: 'Amber', rarity: 'rare'} as LorcanaCard;

describe('CardSlot dimming', () => {
  it('marks the slot dimmed when dimmed is true', () => {
    render(<CardSlot ink="Amber" card={card} onOpen={() => {}} dimmed />);
    expect(screen.getByTestId('reveal-card-slot')).toHaveAttribute('data-dimmed', 'true');
  });

  it('omits the dimmed marker by default', () => {
    render(<CardSlot ink="Amber" card={card} onOpen={() => {}} />);
    expect(screen.getByTestId('reveal-card-slot')).not.toHaveAttribute('data-dimmed');
  });
});
