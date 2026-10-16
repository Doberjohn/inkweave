import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CollectionBinder} from './CollectionBinder';

/** A 48-card set: two spreads, or four single pages. */
const CARDS = Array.from(
  {length: 48},
  (_, i) =>
    ({
      id: `c${i + 1}`,
      name: `Card ${i + 1}`,
      fullName: `Card ${i + 1}`,
      setCode: '1',
      setNumber: i + 1,
      cost: 1,
      ink: 'Amber',
      type: 'Character',
      rarity: 'Common',
      inkwell: true,
    }) as unknown as LorcanaCard,
);

/** Every card held, except the first spread's last three. */
const countsFor = (cardId: string) => ({normal: ['c22', 'c23', 'c24'].includes(cardId) ? 0 : 1, foil: 0});

function binder(props: Partial<Parameters<typeof CollectionBinder>[0]> = {}) {
  return (
    <MemoryRouter>
      <CollectionBinder cards={CARDS} countsFor={countsFor} onSelect={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

/** The name on the first slot in view: the card each page or spread opens on. */
const firstShown = () => screen.getAllByRole('button', {name: /^Card \d+$/})[0].getAttribute('aria-label');

describe('CollectionBinder', () => {
  it('pages a spread, 24 cards at a time', () => {
    render(binder());
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    expect(firstShown()).toBe('Card 25');
  });

  it('pages a single page, 12 at a time, on phone widths', () => {
    render(binder({single: true}));
    fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(firstShown()).toBe('Card 13');
  });

  it('opens the first page of the spread in view when the layout switches to a single page', () => {
    // Spread 1 (0-based) holds slots 24-47; on one page per view the binder must
    // open on that spread's first page (slots 24-35), not reset to the start and
    // not jump to a stored view NUMBER's cards (page 1, slots 12-23).
    const view = render(binder());
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    view.rerender(binder({single: true}));
    expect(firstShown()).toBe('Card 25');
  });

  describe('with the spread map, where the page docks its panels', () => {
    it('turns to the spread it is clicked on, with no arrows beside the spread', () => {
      render(binder({pager: 'map'}));
      fireEvent.click(screen.getByRole('button', {name: /^Spread 2 of 2/}));
      expect(firstShown()).toBe('Card 25');
      // Its own two arrows, at either end of the map, are the only arrows left.
      expect(screen.getAllByRole('button', {name: /(Previous|Next) spread/})).toHaveLength(2);
    });

    it('marks the spread on show and says what each one is missing', () => {
      render(binder({pager: 'map'}));
      const first = screen.getByRole('button', {name: 'Spread 1 of 2: 3 missing'});
      expect(first).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('button', {name: 'Spread 2 of 2: nothing missing'})).not.toHaveAttribute('aria-current');
    });

    it('steps with its arrows, which stop at either end', () => {
      render(binder({pager: 'map'}));
      expect(screen.getByRole('button', {name: 'Previous spread'})).toBeDisabled();
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(firstShown()).toBe('Card 25');
      expect(screen.getByRole('button', {name: 'Next spread'})).toBeDisabled();
    });

    it("draws the last spread's empty right page as the back cover, and only that one", () => {
      // Thirty cards: the second spread holds six, all on its left page.
      render(binder({pager: 'map', cards: CARDS.slice(0, 30)}));
      expect(screen.queryByRole('group', {name: 'Back cover'})).toBeNull();
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(screen.getByRole('group', {name: 'Back cover'})).toBeInTheDocument();
      expect(screen.queryByRole('group', {name: 'Right page'})).toBeNull();
    });

    it('keeps a last right page with cards on it a page', () => {
      render(binder({pager: 'map'}));
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(screen.getByRole('group', {name: 'Right page'})).toBeInTheDocument();
    });

    it('leaves a lone page its arrows: the map draws spreads', () => {
      render(binder({pager: 'map', single: true}));
      expect(screen.queryByRole('navigation', {name: 'Binder pages'})).toBeNull();
      expect(screen.getByRole('button', {name: 'Next page'})).toBeInTheDocument();
    });
  });
});
