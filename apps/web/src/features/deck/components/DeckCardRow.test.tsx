import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {DeckCardRow} from './DeckCardRow';
import {createCard} from '../../../shared/test-utils';

describe('DeckCardRow', () => {
  const card = createCard({fullName: 'Elsa - Snow Queen'});

  it('calls onIncrement when + is clicked', () => {
    const onIncrement = vi.fn();
    render(
      <DeckCardRow card={card} quantity={2} onIncrement={onIncrement} onDecrement={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /add one copy/i}));
    expect(onIncrement).toHaveBeenCalledOnce();
  });

  it('calls onDecrement when − is clicked', () => {
    const onDecrement = vi.fn();
    render(
      <DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={onDecrement} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /remove one copy/i}));
    expect(onDecrement).toHaveBeenCalledOnce();
  });

  it('disables + at the 4-copy limit (UI-side enforcement)', () => {
    render(<DeckCardRow card={card} quantity={4} onIncrement={vi.fn()} onDecrement={vi.fn()} />);
    expect(screen.getByRole('button', {name: /maximum 4 copies/i})).toBeDisabled();
  });

  // The row has no delete affordance: removal is the stepper's − at one copy
  // (setCardQuantity drops the line at 0), so a separate trash button was redundant.
  it('has no delete button — the stepper is the only way to remove a card', () => {
    render(<DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={vi.fn()} />);
    expect(screen.queryByRole('button', {name: /from deck/i})).not.toBeInTheDocument();
  });

  it('has no core-card star — the row is identity plus stepper only', () => {
    // Removed by owner ruling 2026-07-30. This guards the removal rather than the
    // old behaviour: the `isCore` data model still exists for a future guided-mode
    // surface, so a stray star could be re-wired without anything else failing.
    render(<DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={vi.fn()} />);
    expect(screen.queryByRole('button', {name: /core card/i})).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3); // identity + stepper's − and +
  });
});
