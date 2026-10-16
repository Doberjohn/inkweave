import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CardGrid} from '../CardGrid';
import {BrowseCardGrid} from '../BrowseCardGrid';
import {createCard} from '../../../../shared/test-utils';

describe('CardGrid tiles', () => {
  it('opens a card from a plain button, not a toggle that reads "not pressed"', () => {
    const ariel = createCard({id: 'ariel', name: 'Ariel', fullName: 'Ariel - Spectacular Singer'});
    render(<CardGrid cards={[ariel]} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', {name: /Ariel/})).not.toHaveAttribute('aria-pressed');
  });
});

describe('empty card grids', () => {
  it('CardGrid announces its empty message as a status', () => {
    render(<CardGrid cards={[]} onSelect={vi.fn()} emptyMessage="No cards match your filters." />);

    expect(screen.getByRole('status')).toHaveTextContent('No cards match your filters.');
  });

  it('BrowseCardGrid announces that no cards match as a status', () => {
    render(<BrowseCardGrid cards={[]} isLoading={false} onCardSelect={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('No cards match your filters.');
  });
});
