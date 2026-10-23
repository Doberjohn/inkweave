import type {ReactNode} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {CardGrid} from '../CardGrid';
import {BrowseCardGrid} from '../BrowseCardGrid';
import {printingCard} from '../../loader';
import {createCard} from '../../../../shared/test-utils';

// jsdom lays nothing out, so the real grid renders no tiles: this one renders them all.
vi.mock('react-virtuoso', async () => {
  const {createElement, Fragment} = await import('react');
  return {
    VirtuosoGrid: ({totalCount, itemContent}: {totalCount: number; itemContent: (index: number) => ReactNode}) =>
      createElement(Fragment, null, ...Array.from({length: totalCount}, (_, index) => itemContent(index))),
  };
});

describe('CardGrid tiles', () => {
  it('opens a card from a plain button, not a toggle that reads "not pressed"', () => {
    const ariel = createCard({id: 'ariel', name: 'Ariel', fullName: 'Ariel - Spectacular Singer'});
    render(<CardGrid cards={[ariel]} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', {name: /Ariel/})).not.toHaveAttribute('aria-pressed');
  });
});

describe('BrowseCardGrid tiles', () => {
  it("links a promo's tile to its card's page, the one page a card has (#805)", () => {
    const mickey = createCard({id: '1949', fullName: 'Mickey Mouse - True Friend'});
    const promo = printingCard(mickey, {id: '80042', rarity: 'Special', number: 25, promoGrouping: 'P1'});
    render(<BrowseCardGrid cards={[mickey, promo]} isLoading={false} onCardSelect={vi.fn()} />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/card/1949/mickey-mouse-true-friend', '/card/1949/mickey-mouse-true-friend']);
  });

  it('opens a card that has no page from a plain button, not a link to "Card not found" (#911)', () => {
    const singing = createCard({id: '1951', name: 'Ariel', fullName: 'Ariel - Singing Mermaid'});
    const onHumanLegs = createCard({id: '1', name: 'Ariel', fullName: 'Ariel - On Human Legs', setCode: '1'});
    const onCardSelect = vi.fn();
    render(
      <BrowseCardGrid
        cards={[singing, onHumanLegs]}
        isLoading={false}
        onCardSelect={onCardSelect}
        hasCardPage={(card) => card.id === '1951'}
      />,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/card/1951/ariel-singing-mermaid');
    const button = screen.getByRole('button', {name: /On Human Legs/});
    expect(button).not.toHaveAttribute('aria-pressed');
    fireEvent.click(button);
    expect(onCardSelect).toHaveBeenCalledWith(onHumanLegs);
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
