import {describe, it, expect, vi} from 'vitest';
import {act, render, screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** The pocket holding card `n`. */
const pocket = (n: number) => screen.getByRole('button', {name: `Card ${n}`});

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

  it('dims its flanking arrows at either end, where they stay in the Tab order', () => {
    render(binder());
    expect(screen.getByRole('button', {name: 'Previous spread'})).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    expect(screen.getByRole('button', {name: 'Next spread'})).toHaveAttribute('aria-disabled', 'true');
  });

  describe('from the keyboard, one Tab stop for the pockets (#790)', () => {
    it('reaches the spread map with one Tab from the first pocket', async () => {
      const user = userEvent.setup();
      render(binder({pager: 'map'}));
      await user.tab();
      expect(pocket(1)).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', {name: 'Previous spread'})).toHaveFocus();
    });

    it('moves between the pockets with the arrow keys, across the spine', async () => {
      const user = userEvent.setup();
      render(binder({pager: 'map'}));
      // Card 4 ends the left page's top row, and Card 13 starts the right page's.
      act(() => pocket(4).focus());
      await user.keyboard('{ArrowRight}');
      expect(pocket(13)).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(pocket(17)).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(pocket(8)).toHaveFocus();
    });

    it('goes to the first and last card with Home and End, and no further than the cards', async () => {
      // Eighteen cards: a full left page, and the right page's first six.
      const user = userEvent.setup();
      render(binder({pager: 'map', cards: CARDS.slice(0, 18)}));
      act(() => pocket(1).focus());
      await user.keyboard('{End}');
      expect(pocket(18)).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(pocket(18)).toHaveFocus();
      await user.keyboard('{Home}');
      expect(pocket(1)).toHaveFocus();
    });

    it('keeps the Tab stop on the card focused last, until the spread turns', async () => {
      const user = userEvent.setup();
      render(binder({pager: 'map'}));
      act(() => pocket(5).focus());
      await user.tab();
      await user.tab({shift: true});
      expect(pocket(5)).toHaveFocus();
      await user.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(pocket(25)).toHaveAttribute('tabindex', '0');
    });
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

    it('steps with its arrows, which stop at either end and keep the focus there', async () => {
      // A disabled Next dropped the focus to the page at the last spread (#790).
      const user = userEvent.setup();
      render(binder({pager: 'map'}));
      expect(screen.getByRole('button', {name: 'Previous spread'})).toHaveAttribute('aria-disabled', 'true');
      const next = screen.getByRole('button', {name: 'Next spread'});
      act(() => next.focus());
      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');
      expect(firstShown()).toBe('Card 25');
      expect(next).toHaveFocus();
      expect(next).toHaveAttribute('aria-disabled', 'true');
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
