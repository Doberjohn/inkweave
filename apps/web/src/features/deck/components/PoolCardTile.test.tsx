import type {ComponentProps} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {PoolCardTile} from './PoolCardTile';
import {createCard} from '../../../shared/test-utils';

const card = createCard({fullName: 'Pocahontas - Guiding the Tribe', ink: 'Amber'});

function renderTile(props: Partial<ComponentProps<typeof PoolCardTile>> = {}) {
  const handlers = {onIncrement: vi.fn(), onDecrement: vi.fn(), onViewDetails: vi.fn()};
  render(<PoolCardTile card={card} deckInks={['Amber']} inDeckCount={0} {...handlers} {...props} />);
  return handlers;
}

describe('PoolCardTile', () => {
  it('adds when the + is clicked (not in deck)', () => {
    const {onIncrement} = renderTile({inDeckCount: 0});
    fireEvent.click(screen.getByRole('button', {name: /add pocahontas - guiding the tribe to deck/i}));
    expect(onIncrement).toHaveBeenCalledWith(card);
  });

  it('increments and decrements when already in deck', () => {
    const {onIncrement, onDecrement} = renderTile({inDeckCount: 2});
    fireEvent.click(screen.getByRole('button', {name: /add one copy/i}));
    fireEvent.click(screen.getByRole('button', {name: /remove one copy/i}));
    expect(onIncrement).toHaveBeenCalledWith(card);
    expect(onDecrement).toHaveBeenCalledWith(card);
  });

  it('disables the + at the 4-copy limit', () => {
    const {onIncrement} = renderTile({inDeckCount: 4});
    const inc = screen.getByRole('button', {name: /max 4 copies/i});
    expect(inc).toBeDisabled();
    fireEvent.click(inc);
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it('disables adding an off-ink card', () => {
    const ruby = createCard({fullName: 'Maleficent - Monstrous Dragon', ink: 'Ruby'});
    const onIncrement = vi.fn();
    render(
      <PoolCardTile
        card={ruby}
        deckInks={['Amber', 'Amethyst']}
        inDeckCount={0}
        onIncrement={onIncrement}
        onDecrement={vi.fn()}
        onViewDetails={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: /can't have more than two ink colors/i}));
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it('opens details when the card body is clicked', () => {
    const {onViewDetails} = renderTile({inDeckCount: 0});
    fireEvent.click(screen.getByTestId('card-tile'));
    expect(onViewDetails).toHaveBeenCalledWith(card);
  });
});
