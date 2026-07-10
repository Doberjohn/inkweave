import type {ComponentProps} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {PoolCardTile} from './PoolCardTile';
import {createCard} from '../../../shared/test-utils';

const card = createCard({fullName: 'Pocahontas - Guiding the Tribe', ink: 'Amber'});

function renderTile(props: Partial<ComponentProps<typeof PoolCardTile>> = {}) {
  const handlers = {onIncrement: vi.fn(), onDecrement: vi.fn(), onViewDetails: vi.fn()};
  render(<PoolCardTile card={card} inDeckCount={0} {...handlers} {...props} />);
  return handlers;
}

describe('PoolCardTile', () => {
  it('adds a copy when the card body is clicked', () => {
    const {onIncrement} = renderTile({inDeckCount: 0});
    fireEvent.click(screen.getByTestId('card-tile'));
    expect(onIncrement).toHaveBeenCalledWith(card);
  });

  it('adds another copy when an already-in-deck card is clicked', () => {
    const {onIncrement} = renderTile({inDeckCount: 2});
    fireEvent.click(screen.getByTestId('card-tile'));
    expect(onIncrement).toHaveBeenCalledWith(card);
  });

  it('opens details from the info button without adding', () => {
    const {onViewDetails, onIncrement} = renderTile({inDeckCount: 0});
    fireEvent.click(screen.getByRole('button', {name: /view pocahontas - guiding the tribe details/i}));
    expect(onViewDetails).toHaveBeenCalledWith(card);
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it('steps quantity with the in-deck − / + controls', () => {
    const {onIncrement, onDecrement} = renderTile({inDeckCount: 2});
    // The − / + are revealed (and exposed to AT) only on hover/focus; hover first.
    fireEvent.mouseEnter(screen.getByTestId('card-tile'));
    fireEvent.click(screen.getByRole('button', {name: /add one copy/i}));
    fireEvent.click(screen.getByRole('button', {name: /remove one copy/i}));
    expect(onIncrement).toHaveBeenCalledWith(card);
    expect(onDecrement).toHaveBeenCalledWith(card);
  });

  it('does not add past the 4-copy limit', () => {
    const {onIncrement} = renderTile({inDeckCount: 4});
    fireEvent.mouseEnter(screen.getByTestId('card-tile')); // reveal the stepper
    expect(screen.getByRole('button', {name: /max 4 copies/i})).toBeDisabled();
    fireEvent.click(screen.getByTestId('card-tile'));
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it('adds an off-ink card on click — the ink limit is a soft legality error, not a pool block', () => {
    const ruby = createCard({fullName: 'Maleficent - Monstrous Dragon', ink: 'Ruby'});
    const onIncrement = vi.fn();
    render(
      <PoolCardTile
        card={ruby}
        inDeckCount={0}
        onIncrement={onIncrement}
        onDecrement={vi.fn()}
        onViewDetails={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('card-tile'));
    expect(onIncrement).toHaveBeenCalledWith(ruby);
  });
});
