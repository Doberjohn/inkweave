import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CollectionBinder} from './CollectionBinder';

/** A 48-card set: three spreads, the first opening on the front cover, or four single pages. */
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

/** Every card held, except cards 22 to 24, on the second spread. */
const countsFor = (cardId: string) => ({normal: ['c22', 'c23', 'c24'].includes(cardId) ? 0 : 1, foil: 0});

function binder(props: Partial<Parameters<typeof CollectionBinder>[0]> = {}) {
  return (
    <MemoryRouter>
      <CollectionBinder slots={CARDS} countsFor={countsFor} onSelect={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

/** The name on the first slot in view: the card each page or spread opens on. */
const firstShown = () => screen.getAllByRole('button', {name: /^Card \d+$/})[0].getAttribute('aria-label');

/** A promo's card in its promo set, as `printingCard` builds one (#805). */
const promo = (id: string, setNumber: number | undefined, over: Partial<LorcanaCard> = {}) =>
  ({...CARDS[0], id, baseId: 'c1', rarity: 'Special', setCode: 'C1', setNumber, ...over}) as LorcanaCard;

describe('CollectionBinder', () => {
  it('opens a spread on the front cover, cards 1 to 12 beside it, then pages 24 cards at a time (owner, 2026-10-18)', () => {
    render(binder());
    expect(screen.getByRole('group', {name: 'Front cover'})).toBeInTheDocument();
    expect(firstShown()).toBe('Card 1');
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    expect(firstShown()).toBe('Card 13');
    expect(screen.queryByRole('group', {name: 'Front cover'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    expect(firstShown()).toBe('Card 37');
  });

  it('pages a single page, 12 at a time, on phone widths, with no cover', () => {
    render(binder({single: true}));
    expect(screen.queryByRole('group', {name: 'Front cover'})).toBeNull();
    expect(firstShown()).toBe('Card 1');
    fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(firstShown()).toBe('Card 13');
  });

  it('keeps the cards in view when the layout switches between spreads and single pages', () => {
    // Spread 2 holds slots 12-35, a page in for the cover: on one page per view the binder
    // opens that spread's first page of cards (slots 12-23), and back on spreads, spread 2.
    const view = render(binder());
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    view.rerender(binder({single: true}));
    expect(firstShown()).toBe('Card 13');
    view.rerender(binder());
    expect(firstShown()).toBe('Card 13');
  });

  describe('with the spread map, where the page docks its panels', () => {
    it('turns to the spread it is clicked on, with no arrows beside the spread', () => {
      render(binder({pager: 'map'}));
      fireEvent.click(screen.getByRole('button', {name: /^Spread 3 of 3/}));
      expect(firstShown()).toBe('Card 37');
      // Its own two arrows, at either end of the map, are the only arrows left.
      expect(screen.getAllByRole('button', {name: /(Previous|Next) spread/})).toHaveLength(2);
    });

    it("marks the spread on show and says what each one is missing, the first counting its one page's", () => {
      render(binder({pager: 'map'}));
      const first = screen.getByRole('button', {name: 'Spread 1 of 3: nothing missing'});
      expect(first).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('button', {name: 'Spread 2 of 3: 3 missing'})).not.toHaveAttribute('aria-current');
    });

    it('steps with its arrows, which stop at either end', () => {
      render(binder({pager: 'map'}));
      expect(screen.getByRole('button', {name: 'Previous spread'})).toBeDisabled();
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(firstShown()).toBe('Card 13');
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(firstShown()).toBe('Card 37');
      expect(screen.getByRole('button', {name: 'Next spread'})).toBeDisabled();
    });

    it("draws the last spread's empty right page as the back cover, and only that one", () => {
      // Twenty cards: the cover's spread holds twelve, and the second the last eight, on its left page.
      render(binder({pager: 'map', slots: CARDS.slice(0, 20)}));
      expect(screen.queryByRole('group', {name: 'Back cover'})).toBeNull();
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(screen.getByRole('group', {name: 'Back cover'})).toBeInTheDocument();
      expect(screen.queryByRole('group', {name: 'Right page'})).toBeNull();
    });

    it('keeps a last right page with cards on it a page', () => {
      // Thirty cards: the second spread's right page holds cards 25 to 30.
      render(binder({pager: 'map', slots: CARDS.slice(0, 30)}));
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(screen.getByRole('group', {name: 'Right page'})).toBeInTheDocument();
      expect(screen.queryByRole('group', {name: 'Back cover'})).toBeNull();
    });

    it('never ends the first spread in the back cover: its right page holds the first cards', () => {
      render(binder({pager: 'map', slots: CARDS.slice(0, 12)}));
      expect(screen.getByRole('group', {name: 'Front cover'})).toBeInTheDocument();
      expect(screen.getByRole('group', {name: 'Right page'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Spread 1 of 1: nothing missing'})).toBeInTheDocument();
    });

    it('leaves a lone page its arrows: the map draws spreads', () => {
      render(binder({pager: 'map', single: true}));
      expect(screen.queryByRole('navigation', {name: 'Binder pages'})).toBeNull();
      expect(screen.getByRole('button', {name: 'Next page'})).toBeInTheDocument();
    });

    it("never counts an open pocket as a missing card: there's no card in it", () => {
      render(binder({pager: 'map', slots: [promo('p1', 1), {open: true, setCode: 'C1', setNumber: 2}]}));
      expect(screen.getByRole('button', {name: 'Spread 1 of 1: nothing missing'})).toBeInTheDocument();
    });

    it("draws a waiting promo's scan in the map as the spread shows it, a card, and an empty pocket empty", () => {
      const hades = {open: true, setCode: 'C3', setNumber: 29, id: '80033', fullName: 'Hades - Dark Usurper'} as const;
      const empty = {open: true, setCode: 'C3', setNumber: 30} as const;
      render(binder({pager: 'map', slots: [{...hades, imageUrl: '/a.avif'}, empty]}));
      const map = screen.getByRole('button', {name: 'Spread 1 of 1: nothing missing'});
      // Past the front cover's twelve cells, the right page's: the pockets.
      const cells = [...map.querySelectorAll<HTMLElement>('span[aria-hidden] > span')].slice(12);
      const [scan, open] = cells.map((cell) => cell.style.background);
      expect(scan).not.toBe('');
      expect(open).toBe('');
    });
  });

  describe('a promo set (#805)', () => {
    it("writes no code over a promo's art (owner, 2026-10-17), but names its tile by it, a twin's finish too", () => {
      render(binder({slots: [promo('p3f', 3, {finish: 'foil'}), promo('p3n', 3, {finish: 'normal'})]}));
      expect(screen.queryByText(/3\/C1/)).toBeNull();
      expect(screen.getByRole('button', {name: 'Card 1, 3/C1 non-foil printing'})).toBeInTheDocument();
    });

    it("holds a number nobody has listed in an open pocket, and names the card a waiting promo is for", () => {
      render(
        binder({
          slots: [
            {open: true, setCode: 'C1', setNumber: 2},
            {open: true, setCode: 'C3', setNumber: 29, id: '80033', fullName: 'Hades - Dark Usurper'},
          ],
        }),
      );
      expect(screen.getByText('2/C1').nextSibling).toHaveTextContent('Not listed yet');
      expect(screen.getByText('Hades - Dark Usurper')).toBeInTheDocument();
      expect(screen.getByText('Not in our data yet')).toBeInTheDocument();
    });

    it("shows a waiting promo's scan, greyed, with what it is and why it waits in its name (owner, 2026-10-19)", () => {
      const hades = {open: true, setCode: 'C3', setNumber: 29, id: '80033', fullName: 'Hades - Dark Usurper'} as const;
      render(binder({slots: [{...hades, imageUrl: '/card-images-preview/80033.avif'}]}));
      const art = screen.getByRole('img', {name: 'Hades - Dark Usurper, 29/C3 printing: not in our data yet'});
      expect(art).toHaveAttribute('src', '/card-images-preview/80033-sm.avif');
      expect(screen.queryByText('Not in our data yet')).toBeNull();
      expect(screen.queryByRole('button', {name: /Hades/})).toBeNull();
    });

    it("falls back to the waiting promo's name and reason when its scan fails to load", () => {
      const hades = {open: true, setCode: 'C3', setNumber: 29, id: '80033', fullName: 'Hades - Dark Usurper'} as const;
      render(binder({slots: [{...hades, imageUrl: '/card-images-preview/80033.avif'}]}));
      fireEvent.error(screen.getByRole('img'));
      expect(screen.getByText('29/C3').nextSibling).toHaveTextContent('Hades - Dark Usurper');
      expect(screen.getByText('Not in our data yet')).toBeInTheDocument();
    });

    it('says a number its promo set never released was not released, rather than not listed yet', () => {
      render(binder({slots: [{open: true, setCode: 'P2', setNumber: 37, unreleased: true}]}));
      expect(screen.getByText('37/P2').nextSibling).toHaveTextContent(/^Not released$/);
    });

    it('says a number its promo set has still to release is not released yet', () => {
      render(binder({slots: [{open: true, setCode: 'P4', setNumber: 2, upcoming: true}]}));
      expect(screen.getByText('2/P4').nextSibling).toHaveTextContent(/^Not released yet$/);
    });
  });
});
