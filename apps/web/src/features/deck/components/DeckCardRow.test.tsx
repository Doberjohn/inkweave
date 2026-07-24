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

  it('calls onSetCore when the core star is clicked', () => {
    const onSetCore = vi.fn();
    render(
      <DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={vi.fn()} onRemove={vi.fn()} onSetCore={onSetCore} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /mark elsa - snow queen as a core card/i}));
    expect(onSetCore).toHaveBeenCalledOnce();
  });

  it('marks the star pressed and offers to unmark once the card is core', () => {
    render(
      <DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={vi.fn()} onRemove={vi.fn()} isCore onSetCore={vi.fn()} />,
    );
    expect(screen.getByRole('button', {name: /unmark elsa - snow queen as a core card/i})).toHaveAttribute('aria-pressed', 'true');
  });

  it('omits the core star entirely when onSetCore is not provided', () => {
    render(<DeckCardRow card={card} quantity={2} onIncrement={vi.fn()} onDecrement={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByRole('button', {name: /core card/i})).not.toBeInTheDocument();
  });
});
