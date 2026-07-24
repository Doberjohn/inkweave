import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import type {Suggestion} from '../types';
import {createCard} from '../../../shared/test-utils';
import {SuggestionList} from './SuggestionList';

const cards = [createCard({id: 'a', fullName: 'Grab Your Sword'}), createCard({id: 'b', fullName: 'Fire the Cannons'})];
const getCardById = (id: string) => cards.find((c) => c.id === id);
const sug = (cardId: string, reasons: string[]): Suggestion => ({
  cardId,
  synergyScore: 5,
  gapScore: 0,
  totalScore: 5,
  synergizesWith: [],
  reasons,
});

describe('SuggestionList', () => {
  it('renders a row per suggestion with a friendly reason and an Add button', () => {
    render(
      <SuggestionList
        suggestions={[sug('a', ['Synergizes with 6 deck cards']), sug('b', ['Fills removal gap'])]}
        getCardById={getCardById}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText('Grab Your Sword')).toBeInTheDocument();
    expect(screen.getByText('Works with 6 of your cards')).toBeInTheDocument();
    expect(screen.getByText("Adds removal you're short on")).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: /add/i})).toHaveLength(2);
  });

  it('caps the list at `limit`', () => {
    const many = ['a', 'b', 'a', 'b'].map((id) => sug(id, ['Fills removal gap']));
    render(<SuggestionList suggestions={many} getCardById={getCardById} onAdd={vi.fn()} limit={2} />);
    expect(screen.getAllByRole('button', {name: /add/i})).toHaveLength(2);
  });

  it('calls onAdd with the cardId when Add is clicked', () => {
    const onAdd = vi.fn();
    render(<SuggestionList suggestions={[sug('a', ['Fills removal gap'])]} getCardById={getCardById} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', {name: /add grab your sword/i}));
    expect(onAdd).toHaveBeenCalledWith('a');
  });

  it('shows an invitation when there are no suggestions', () => {
    render(<SuggestionList suggestions={[]} getCardById={getCardById} onAdd={vi.fn()} />);
    expect(screen.getByText(/add a few more cards/i)).toBeInTheDocument();
  });

  it('skips suggestions whose card no longer resolves', () => {
    render(<SuggestionList suggestions={[sug('gone', ['Fills removal gap'])]} getCardById={getCardById} onAdd={vi.fn()} />);
    expect(screen.queryByRole('button', {name: /add/i})).not.toBeInTheDocument();
    expect(screen.getByText(/add a few more cards/i)).toBeInTheDocument();
  });
});
