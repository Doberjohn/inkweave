import {describe, it, expect, vi, afterEach} from 'vitest';
import {act, render, screen, fireEvent, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** The pocket holding card `n`. */
const pocket = (n: number) => screen.getByRole('button', {name: `Card ${n}`});

/** A promo's card in its promo set, as `printingCard` builds one (#805). */
const promo = (id: string, setNumber: number | undefined, over: Partial<LorcanaCard> = {}) =>
  ({...CARDS[0], id, baseId: 'c1', rarity: 'Special', setCode: 'C1', setNumber, ...over}) as LorcanaCard;

/**
 * A promo set's first page, beside the front cover, its cards at numbers 2, 4 and 10 and every
 * other pocket open, the first among them (#805). Number 10 sits two rows under number 2.
 */
const PROMO_PAGE = Array.from({length: 12}, (_, i) =>
  [2, 4, 10].includes(i + 1) ? promo(`p${i + 1}`, i + 1) : ({open: true, setCode: 'C1', setNumber: i + 1} as const),
);

/** The pocket holding promo number `n` of that page. */
const promoPocket = (n: number) => screen.getByRole('button', {name: `Card 1, ${n}/C1 printing`});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CollectionBinder', () => {
  it.each(['arrows', 'map'] as const)('caps the spread from its first render, with %s', (pager) => {
    // jsdom has no ResizeObserver, so only the measure before the first paint can set the
    // cap. A binder remounts on every new set, and painted a frame uncapped before it (#790).
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({width: 1200, height: 800} as DOMRect);
    render(binder({pager}));
    // The first spread's right page: its left one is the front cover.
    const pages = screen.getByRole('group', {name: 'Right page'}).parentElement;
    expect(pages?.style.maxHeight).toMatch(/^\d+(\.\d+)?px$/);
  });

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

  it('dims its flanking arrows at either end, where they stay in the Tab order', () => {
    render(binder());
    expect(screen.getByRole('button', {name: 'Previous spread'})).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
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
      // On the second spread, Card 16 ends the left page's top row, and Card 25 starts the right page's.
      await user.click(screen.getByRole('button', {name: 'Next spread'}));
      act(() => pocket(16).focus());
      await user.keyboard('{ArrowRight}');
      expect(pocket(25)).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(pocket(29)).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(pocket(20)).toHaveFocus();
    });

    it('tabs into the first spread on its first card, past the front cover, and steps no further left (#806)', async () => {
      const user = userEvent.setup();
      render(binder({pager: 'map'}));
      await user.tab();
      expect(pocket(1)).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(pocket(1)).toHaveFocus();
    });

    it('goes to the first and last card with Home and End, and no further than the cards', async () => {
      // Six cards: the first six pockets of the page beside the front cover.
      const user = userEvent.setup();
      render(binder({pager: 'map', slots: CARDS.slice(0, 6)}));
      act(() => pocket(1).focus());
      await user.keyboard('{End}');
      expect(pocket(6)).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(pocket(6)).toHaveFocus();
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
      expect(pocket(13)).toHaveAttribute('tabindex', '0');
    });

    it("stops on a promo set's first card when its first pocket is open", async () => {
      // An open pocket takes no focus, so a Tab stop left on one was no stop at all.
      const user = userEvent.setup();
      render(binder({pager: 'map', slots: PROMO_PAGE}));
      await user.tab();
      expect(promoPocket(2)).toHaveFocus();
    });

    it("passes over a promo set's open pockets with the arrow keys", async () => {
      const user = userEvent.setup();
      render(binder({pager: 'map', slots: PROMO_PAGE}));
      act(() => promoPocket(2).focus());
      await user.keyboard('{ArrowRight}');
      expect(promoPocket(4)).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowDown}');
      expect(promoPocket(10)).toHaveFocus();
    });
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

    it('steps with its arrows, which stop at either end and keep the focus there', async () => {
      // A disabled Next dropped the focus to the page at the last spread (#790).
      const user = userEvent.setup();
      render(binder({pager: 'map'}));
      expect(screen.getByRole('button', {name: 'Previous spread'})).toHaveAttribute('aria-disabled', 'true');
      const next = screen.getByRole('button', {name: 'Next spread'});
      act(() => next.focus());
      await user.keyboard('{Enter}');
      expect(firstShown()).toBe('Card 13');
      await user.keyboard('{Enter}');
      expect(firstShown()).toBe('Card 37');
      expect(next).toHaveFocus();
      expect(next).toHaveAttribute('aria-disabled', 'true');
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

  describe('counts changed from the pocket a mouse points at (#826)', () => {
    /** A pointer coming to rest on a pocket: a mouse, unless said otherwise. */
    const point = (target: HTMLElement, pointerType = 'mouse') =>
      fireEvent.pointerEnter(target, {pointerType});

    it('opens its stripe, an unheld finish at 0, and sets the count a click asks for', () => {
      const onCountChange = vi.fn();
      const onSelect = vi.fn();
      render(binder({onCountChange, onSelect}));
      point(pocket(1));
      const counts = screen.getByRole('group', {name: '1 normal, 0 foil'});
      // The stripe sits under aria-hidden: the group's label speaks for it.
      const plus = within(counts).getByRole('button', {name: 'Add one copy of foil', hidden: true});
      fireEvent.click(plus);
      expect(onCountChange).toHaveBeenCalledWith('c1', 'foil', 1);
      // The stripe is not the card: the click opens no window.
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('closes it again when the mouse leaves', () => {
      // Only the pocket pointed at says "0 foil": every other held pocket reads "1 normal".
      render(binder({onCountChange: vi.fn()}));
      point(pocket(1));
      expect(screen.getByRole('group', {name: '1 normal, 0 foil'})).toBeInTheDocument();
      fireEvent.pointerLeave(pocket(1));
      expect(screen.queryByRole('group', {name: '1 normal, 0 foil'})).toBeNull();
    });

    it('opens it on the pointer over it with no entry, as when the window closes over a resting mouse', () => {
      render(binder({onCountChange: vi.fn()}));
      // From an element React tracks, React enters only on that element's pointerout, which
      // never comes from the window's backdrop, gone from the page.
      fireEvent.pointerOver(pocket(1), {pointerType: 'mouse', relatedTarget: pocket(2)});
      expect(screen.getByRole('group', {name: '1 normal, 0 foil'})).toBeInTheDocument();
    });

    it('opens only the Foil count of a card printed only in foil', () => {
      const enchanted = {...CARDS[0], id: 'e1', rarity: 'Enchanted'} as LorcanaCard;
      const unheld = () => ({normal: 0, foil: 0});
      render(binder({slots: [enchanted], countsFor: unheld, onCountChange: vi.fn()}));
      point(screen.getByRole('button', {name: /Enchanted/}));
      expect(screen.getByRole('group', {name: '0 foil'})).toBeInTheDocument();
    });

    it('opens only the Normal count of a promo its data names in normal alone, as 1/C3 is (#880)', () => {
      const unheld = () => ({normal: 0, foil: 0});
      render(binder({slots: [promo('p1', 1, {finishes: ['normal']})], countsFor: unheld, onCountChange: vi.fn()}));
      point(screen.getByRole('button', {name: 'Card 1, 1/C1 printing'}));
      expect(screen.getByRole('group', {name: '0 normal'})).toBeInTheDocument();
    });

    it.each(['touch', 'pen'])(
      'never opens them for a %s, whose tap opens the card',
      (pointerType) => {
        render(binder({onCountChange: vi.fn()}));
        point(pocket(1), pointerType);
        expect(screen.queryByRole('group', {name: '1 normal, 0 foil'})).toBeNull();
      },
    );

    it("never opens them on a phone's lone page, where no mouse points", () => {
      render(binder({single: true, onCountChange: vi.fn()}));
      point(pocket(1));
      expect(screen.queryByRole('group', {name: '1 normal, 0 foil'})).toBeNull();
    });
  });
});
