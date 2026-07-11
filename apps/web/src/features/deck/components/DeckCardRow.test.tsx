import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {DeckCardRow} from './DeckCardRow';
import {createCard} from '../../../shared/test-utils';

describe('DeckCardRow', () => {
  const card = createCard({fullName: 'Elsa - Snow Queen'});

  it('calls onIncrement when + is clicked', () => {
    const onIncrement = vi.fn();
    render(
      <DeckCardRow card={card} quantity={2} onIncrement={onIncrement} onDecrement={vi.fn()} onRemove={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /add one copy/i}));
    expect(onIncrement).toHaveBeenCalledOnce();
  });

  it('calls onDecrement when − is clicked', () => {
    const onDecrement = vi.fn();
    render(
      <DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={onDecrement} onRemove={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /remove one copy/i}));
    expect(onDecrement).toHaveBeenCalledOnce();
  });

  it('disables + at the 4-copy limit (UI-side enforcement)', () => {
    render(<DeckCardRow card={card} quantity={4} onIncrement={vi.fn()} onDecrement={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', {name: /maximum 4 copies/i})).toBeDisabled();
  });

  it('calls onRemove when × is clicked', () => {
    const onRemove = vi.fn();
    render(
      <DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={vi.fn()} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /remove elsa - snow queen from deck/i}));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
