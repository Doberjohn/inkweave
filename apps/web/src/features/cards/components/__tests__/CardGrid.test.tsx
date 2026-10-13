import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CardGrid} from '../CardGrid';
import {BrowseCardGrid} from '../BrowseCardGrid';

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
