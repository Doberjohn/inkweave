import {describe, it, expect, vi, afterEach} from 'vitest';
import {act, render, screen, fireEvent, within} from '@testing-library/react';
import userEvent, {type UserEvent} from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CollectionBinder} from './CollectionBinder';
import {settleOf} from './binderPockets';
import {preloadArt} from './preloadArt';

// jsdom loads no image: the binder's art loaded ahead is only asked for.
vi.mock('./preloadArt', () => ({preloadArt: vi.fn()}));

/** A 48-card set: three spreads, the first opening on the front cover, or six lone pages of nine. */
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

/** Tabs to the pockets' one stop, past the Previous arrow on the spread's left edge before them. */
async function tabToPockets(user: UserEvent) {
  await user.tab();
  await user.tab();
}

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

/** A waiting promo with a scan (#805): Hades 29/C3, whose card no dataset holds yet. */
const WAITING_HADES = {
  open: true,
  setCode: 'C3',
  setNumber: 29,
  id: '80033',
  fullName: 'Hades - Dark Usurper',
  imageUrl: '/card-images-preview/80033.avif',
} as const;

/** Its pocket's name: what it is and why it waits. */
const HADES_NAME = 'Hades - Dark Usurper, 29/C3 printing: not in our data yet';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CollectionBinder', () => {
  it.each(['arrows', 'map'] as const)('caps the spread from its first render, with %s', (pager) => {
    // jsdom has no ResizeObserver, so only the measure before the first paint can set the
    // cap. A binder remounts on every new set, and painted a frame uncapped before it (#790).
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({width: 1200, height: 800} as DOMRect);
    render(binder({pager}));
    // The box around the first spread's pages (its left one is the front cover), which the
    // spread map's discs share with them.
    const pages = screen.getByRole('group', {name: 'Right page'}).closest<HTMLElement>('[style*="max-height"]');
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

  it('pages a single page, 9 at a time, on phone widths, opening on page 1 (#969)', () => {
    render(binder({single: true, cover: <p>The numbers</p>}));
    expect(screen.queryByRole('group', {name: 'Front cover'})).toBeNull();
    expect(firstShown()).toBe('Card 1');
    fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(firstShown()).toBe('Card 10');
  });

  it("opens on the spread, or a phone's page, holding the card it is asked to start at", () => {
    const {unmount} = render(binder({startCard: 'c30'}));
    expect(firstShown()).toBe('Card 13');
    unmount();
    render(binder({single: true, startCard: 'c30'}));
    expect(firstShown()).toBe('Card 28');
  });

  it('opens at its start when the card to start at has no pocket', () => {
    render(binder({startCard: 'not-here'}));
    expect(firstShown()).toBe('Card 1');
  });

  describe("a phone's inside front cover (owner, 2026-10-27)", () => {
    const COVER = <p>The numbers</p>;
    const cover = () => screen.getByRole('group', {name: 'Front cover'});

    it('holds what the binder gives it, a page before page 1, with no card on it', () => {
      render(binder({single: true, cover: COVER}));
      fireEvent.click(screen.getByRole('button', {name: 'Previous page'}));
      expect(within(cover()).getByText('The numbers')).toBeInTheDocument();
      expect(screen.queryAllByRole('button', {name: /^Card \d+$/})).toHaveLength(0);
      expect(screen.getByRole('button', {name: 'Previous page'})).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
      expect(firstShown()).toBe('Card 1');
    });

    it('keeps the cover when the page gains or loses a row', () => {
      const view = render(binder({single: true, cover: COVER}));
      fireEvent.click(screen.getByRole('button', {name: 'Previous page'}));
      view.rerender(binder({single: true, cover: COVER, loneFit: {rows: 4}}));
      expect(within(cover()).getByText('The numbers')).toBeInTheDocument();
      view.rerender(binder({single: true, cover: COVER}));
      expect(within(cover()).getByText('The numbers')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
      expect(firstShown()).toBe('Card 1');
    });

    it("opens the first spread from the cover once the screen is a spread's, its cover beside page 1", () => {
      // What each screen's cover holds is the section's to pick: a spread's holds only an
      // empty collection's note (`CollectionBinderSection`).
      const view = render(binder({single: true, cover: COVER}));
      fireEvent.click(screen.getByRole('button', {name: 'Previous page'}));
      view.rerender(binder({cover: undefined}));
      expect(firstShown()).toBe('Card 1');
      expect(cover()).toBeInTheDocument();
      expect(screen.queryByText('The numbers')).toBeNull();
    });

    it("draws a spread's cover content on its inside front cover", () => {
      render(binder({cover: COVER}));
      expect(within(cover()).getByText('The numbers')).toBeInTheDocument();
      expect(firstShown()).toBe('Card 1');
    });

    it('opens on the cover when asked to, as the binder that replaces one showing it', () => {
      render(binder({single: true, cover: COVER, opensOnCover: true}));
      expect(within(cover()).getByText('The numbers')).toBeInTheDocument();
    });

    it('says whether the cover is on show, as it changes', () => {
      const onCoverChange = vi.fn();
      render(binder({single: true, cover: COVER, onCoverChange}));
      expect(onCoverChange).toHaveBeenLastCalledWith(false);
      fireEvent.click(screen.getByRole('button', {name: 'Previous page'}));
      expect(onCoverChange).toHaveBeenLastCalledWith(true);
      fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
      expect(onCoverChange).toHaveBeenLastCalledWith(false);
    });
  });

  it('pages 12 at a time where a phone fits four rows (#1000)', () => {
    render(binder({single: true, loneFit: {rows: 4}}));
    expect(firstShown()).toBe('Card 1');
    expect(pocket(12)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(firstShown()).toBe('Card 13');
  });

  it("keeps the page's first card in view when a phone's page gains or loses a row", () => {
    // Page 4 of nine holds slots 27-35 (cards 28 to 36): at twelve a page, the page that holds its
    // first card is page 3 (slots 24-35, cards 25 to 36), and back at nine, page 4 again.
    const view = render(binder({single: true}));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(firstShown()).toBe('Card 28');
    view.rerender(binder({single: true, loneFit: {rows: 4}}));
    expect(firstShown()).toBe('Card 25');
    expect(pocket(28)).toBeInTheDocument();
    view.rerender(binder({single: true}));
    expect(firstShown()).toBe('Card 28');
  });

  describe("the art either side, loaded ahead so a turn lands drawn (owner, 2026-10-26)", () => {
    const WITH_ART = CARDS.map((card) => ({...card, imageUrl: `/art/${card.id}.avif`}));
    /** The small art of cards `from` to `to`, as their pockets draw it. */
    const artOf = (from: number, to: number) =>
      Array.from({length: to - from + 1}, (_, i) => `/art/c${from + i}-sm.avif`);
    const askedFor = () => {
      const asked = vi.mocked(preloadArt).mock.calls.flatMap(([srcs]) => srcs);
      vi.mocked(preloadArt).mockClear();
      return asked.sort();
    };

    it('on a phone, loads the next page ahead, then the pages either side of the one turned to', () => {
      vi.mocked(preloadArt).mockClear();
      render(binder({slots: WITH_ART, single: true}));
      expect(askedFor()).toEqual(artOf(10, 18).sort());

      fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
      expect(askedFor()).toEqual([...artOf(1, 9), ...artOf(19, 27)].sort());
    });

    it('on a spread, loads the next spread ahead, past the front cover', () => {
      vi.mocked(preloadArt).mockClear();
      render(binder({slots: WITH_ART}));
      expect(askedFor()).toEqual(artOf(13, 36).sort());
    });

    it("loads a waiting promo's scan ahead too, and nothing for an empty pocket (Claude review, PR #1002)", () => {
      vi.mocked(preloadArt).mockClear();
      const empty = {open: true, setCode: 'C3', setNumber: 30} as const;
      render(binder({slots: [...WITH_ART.slice(0, 9), WAITING_HADES, empty], single: true}));
      expect(askedFor()).toEqual(['/card-images-preview/80033-sm.avif']);
    });
  });

  it('keeps the cards in view when the layout switches between spreads and single pages', () => {
    // Spread 2 holds slots 12-35, a page in for the cover: on one page per view the binder
    // opens the page that holds its first card (slots 9-17, cards 10 to 18), and back on
    // spreads, spread 2.
    const view = render(binder());
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    view.rerender(binder({single: true}));
    expect(firstShown()).toBe('Card 10');
    expect(pocket(13)).toBeInTheDocument();
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
    it("stops at the pockets between the arrows on the spread's edges, then the spread map", async () => {
      const user = userEvent.setup();
      render(binder({pager: 'map'}));
      await user.tab();
      expect(screen.getByRole('button', {name: 'Previous spread'})).toHaveFocus();
      await user.tab();
      expect(pocket(1)).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', {name: 'Next spread'})).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', {name: /^Spread 1 of 3/})).toHaveFocus();
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
      await tabToPockets(user);
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
      await tabToPockets(user);
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
    it("turns to the spread it is clicked on, the arrows on the spread's edges and none in it", () => {
      render(binder({pager: 'map'}));
      fireEvent.click(screen.getByRole('button', {name: /^Spread 3 of 3/}));
      expect(firstShown()).toBe('Card 37');
      // The two arrows moved from the map's ends to the spread's edges (owner, 2026-10-22).
      expect(screen.getAllByRole('button', {name: /(Previous|Next) spread/})).toHaveLength(2);
      const map = screen.getByRole('navigation', {name: 'Binder pages'});
      expect(within(map).queryAllByRole('button', {name: /(Previous|Next) spread/})).toHaveLength(0);
    });

    it("marks the spread on show and says what each one is missing, the first counting its one page's", () => {
      render(binder({pager: 'map'}));
      const first = screen.getByRole('button', {name: 'Spread 1 of 3: nothing missing'});
      expect(first).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('button', {name: 'Spread 2 of 3: 3 missing'})).not.toHaveAttribute('aria-current');
    });

    it("steps with the arrows on the spread's edges, which stop at either end and keep the focus there", async () => {
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

    it("draws pages under a phone's lone page, in its arrows' place, and turns to the one tapped (#969)", () => {
      // The front cover, then six pages of nine: cards 22 to 24, the ones missing, on the third.
      render(binder({pager: 'map', single: true}));
      const map = screen.getByRole('navigation', {name: 'Binder pages'});
      expect(within(map).getAllByRole('button')).toHaveLength(7);
      expect(screen.getByRole('button', {name: 'Page 1 of 6: nothing missing'})).toHaveAttribute('aria-current', 'true');
      expect(screen.queryByRole('button', {name: /(Previous|Next) page/})).toBeNull();
      fireEvent.click(screen.getByRole('button', {name: 'Page 3 of 6: 3 missing'}));
      expect(firstShown()).toBe('Card 19');
      expect(screen.getByRole('button', {name: 'Page 3 of 6: 3 missing'})).toHaveAttribute('aria-current', 'true');
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
      render(binder({slots: [WAITING_HADES]}));
      const art = screen.getByRole('img', {name: HADES_NAME});
      expect(art).toHaveAttribute('src', '/card-images-preview/80033-sm.avif');
      expect(art).toHaveClass('binder-waiting-art');
      expect(screen.queryByText('Not in our data yet')).toBeNull();
    });

    it("opens a waiting promo's scan full size and in colour, with no card to open (owner, 2026-10-23)", () => {
      const onSelect = vi.fn();
      render(binder({onSelect, slots: [WAITING_HADES]}));
      fireEvent.click(screen.getByRole('button', {name: HADES_NAME}));
      const dialog = screen.getByRole('dialog', {
        name: 'Enlarged view of Hades - Dark Usurper, 29/C3 printing',
      });
      const scan = within(dialog).getByRole('img');
      expect(scan).toHaveAttribute('src', '/card-images-preview/80033.avif');
      expect(scan).not.toHaveClass('binder-waiting-art');
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("opens a waiting promo's scan on Enter, and Escape gives the focus back to its pocket", async () => {
      const user = userEvent.setup();
      render(binder({slots: [WAITING_HADES]}));
      const pocket = screen.getByRole('button', {name: HADES_NAME});
      act(() => pocket.focus());
      await user.keyboard('{Enter}');
      expect(screen.getByRole('dialog', {name: /^Enlarged view of Hades/})).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(pocket).toHaveFocus();
    });

    it("closes a waiting promo's scan on a click outside it, without opening it again", () => {
      render(binder({slots: [WAITING_HADES]}));
      fireEvent.click(screen.getByRole('button', {name: HADES_NAME}));
      // DialogShell's scrim is the sibling before the dialog's wrapper (#510).
      const scrim = screen.getByRole('dialog').parentElement?.previousElementSibling;
      fireEvent.click(scrim!);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it("takes a waiting promo's pocket into the arrow keys, as a card's, past an open pocket", async () => {
      const user = userEvent.setup();
      render(
        binder({
          slots: [
            promo('p1', 1),
            WAITING_HADES,
            {open: true, setCode: 'C3', setNumber: 30},
            promo('p4', 4),
          ],
        }),
      );
      act(() => screen.getByRole('button', {name: 'Card 1, 1/C1 printing'}).focus());
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', {name: HADES_NAME})).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', {name: 'Card 1, 4/C1 printing'})).toHaveFocus();
    });

    it("falls back to the waiting promo's name and reason when its scan fails to load, and still opens it", () => {
      render(binder({slots: [WAITING_HADES]}));
      fireEvent.error(screen.getByRole('img'));
      expect(screen.getByText('29/C3').nextSibling).toHaveTextContent('Hades - Dark Usurper');
      expect(screen.getByText('Not in our data yet')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', {name: HADES_NAME}));
      expect(screen.getByRole('dialog', {name: /^Enlarged view of Hades/})).toBeInTheDocument();
    });

    it("keeps a twin's code on one line, and its finish on lines of its own after it (#973)", () => {
      render(binder({slots: [{...WAITING_HADES, finish: 'normal'}]}));
      fireEvent.error(screen.getByRole('img'));
      const code = screen.getByText('29/C3');
      expect(code).toHaveStyle({whiteSpace: 'nowrap'});
      expect(code.nextSibling).toHaveTextContent(/^non-foil$/);
      expect(code.parentElement).toHaveTextContent(/^29\/C3 non-foil/);
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

  describe('a card in its pocket, as a real one sits (#941)', () => {
    /** What pocket `n` wears for binder.css: the element round its card and its copies. */
    const look = (n: number) => pocket(n).closest<HTMLElement>('.binder-pocket > div')!;

    /** The held cards' copies, changed between renders: card 1 held, card 2 not, unless set. */
    function heldBinder(held: Record<string, {normal: number; foil: number}>) {
      const countsOf = (cardId: string) => held[cardId] ?? {normal: 0, foil: 0};
      return (windowOpen = false) => binder({countsFor: countsOf, windowOpen});
    }

    /** Reduced motion on, as the OS setting asks for it. */
    const stubReducedMotion = () =>
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: query.includes('reduce'),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );

    /**
     * The browser saying an animation in pocket `n` has run its course. Under both names: jsdom
     * has no AnimationEvent, so React listens for the prefixed one there, and the plain one in a
     * browser.
     */
    const animationEnd = (n: number, animationName: string) => {
      for (const type of ['animationend', 'webkitAnimationEnd']) {
        fireEvent(look(n), Object.assign(new Event(type, {bubbles: true}), {animationName}));
      }
    };

    it('gives each pocket on a page of cards a sleeve, a card or no card in it, and the covers none', () => {
      // Five cards: the right page holds them, then seven empty sleeves.
      render(binder({slots: CARDS.slice(0, 5)}));
      const pockets = [...screen.getByRole('group', {name: 'Right page'}).querySelectorAll(':scope > .binder-pocket')];
      expect(pockets).toHaveLength(12);
      expect(pockets.filter((sleeve) => sleeve.childElementCount === 0)).toHaveLength(7);
      expect(screen.getByRole('group', {name: 'Front cover'}).querySelector('.binder-pocket')).toBeNull();
    });

    it('wears the holo on a card held in foil, and on no other', () => {
      render(heldBinder({c1: {normal: 0, foil: 1}, c2: {normal: 2, foil: 0}})());
      expect(look(1)).toHaveClass('binder-foil');
      expect(look(2)).not.toHaveClass('binder-foil');
    });

    it('settles each card by its id, the same way on every visit', () => {
      const first = render(binder());
      const settled = look(1).getAttribute('style');
      first.unmount();
      render(binder());
      expect(look(1).getAttribute('style')).toBe(settled);
      const {sx, sy, sr} = settleOf('c1');
      expect(look(1).style.getPropertyValue('--sx')).toBe(String(sx));
      expect(look(1).style.getPropertyValue('--sy')).toBe(String(sy));
      expect(look(1).style.getPropertyValue('--sr')).toBe(String(sr));
    });

    it('slides a first copy in and greys the last one out, each once its colour settles', () => {
      const held = {c1: {normal: 1, foil: 0}};
      const view = render(heldBinder(held)());
      held.c1 = {normal: 0, foil: 0};
      Object.assign(held, {c2: {normal: 1, foil: 0}});
      view.rerender(heldBinder(held)());
      expect(look(1)).toHaveClass('binder-grey-out');
      expect(look(2)).toHaveClass('binder-slide-in');
      expect(look(2).querySelector('.binder-unowned')).toBeNull();
      // The slide ends first; only its colour coming in ends the change.
      animationEnd(2, 'binder-slide');
      expect(look(2)).toHaveClass('binder-slide-in');
      animationEnd(2, 'binder-colour-in');
      animationEnd(1, 'binder-colour-out');
      expect(look(2)).not.toHaveClass('binder-slide-in');
      expect(look(1)).not.toHaveClass('binder-grey-out');
    });

    it('plays nothing for the counts it opens with', () => {
      render(heldBinder({c1: {normal: 1, foil: 0}})());
      expect(look(1).className).not.toMatch(/binder-(slide-in|grey-out)/);
      expect(look(2).className).not.toMatch(/binder-(slide-in|grey-out)/);
    });

    it('plays nothing when a search or a filter moves another card into a pocket', () => {
      // Cards 1 and 3 held: without card 1, card 2, not held, moves into the first pocket, and
      // card 3, held, into the second. Neither copy count changed.
      const held: Record<string, {normal: number; foil: number}> = {c1: {normal: 1, foil: 0}, c3: {normal: 1, foil: 0}};
      const countsOf = (cardId: string) => held[cardId] ?? {normal: 0, foil: 0};
      const view = render(binder({countsFor: countsOf}));
      view.rerender(binder({slots: CARDS.slice(1), countsFor: countsOf}));
      expect(look(2).className).not.toMatch(/binder-(slide-in|grey-out)/);
      expect(look(3).className).not.toMatch(/binder-(slide-in|grey-out)/);
    });

    it('plays a copy added in the card window once the window closes', () => {
      const held: Record<string, {normal: number; foil: number}> = {};
      const view = render(heldBinder(held)(true));
      held.c2 = {normal: 1, foil: 0};
      view.rerender(heldBinder(held)(true));
      // Behind the window, the pocket still shows what it showed.
      expect(look(2)).not.toHaveClass('binder-slide-in');
      expect(look(2).querySelector('.binder-unowned')).not.toBeNull();
      view.rerender(heldBinder(held)(false));
      expect(look(2)).toHaveClass('binder-slide-in');
    });

    it('just changes under reduced motion', () => {
      stubReducedMotion();
      const held: Record<string, {normal: number; foil: number}> = {};
      const view = render(heldBinder(held)());
      held.c2 = {normal: 1, foil: 0};
      view.rerender(heldBinder(held)());
      expect(look(2).className).not.toMatch(/binder-slide-in/);
      expect(look(2).querySelector('.binder-unowned')).toBeNull();
    });
  });

  describe('what lies over a pocket (#1055)', () => {
    const none = () => ({normal: 0, foil: 0});
    const badge = (card: LorcanaCard) => (card.id === 'c1' ? <button type="button">3 friends have it</button> : null);

    it('lays what pocketBadge gives over its card, outside the grey, and describes the card by it', () => {
      render(binder({countsFor: none, pocketBadge: badge}));
      const layer = screen.getByRole('button', {name: '3 friends have it'}).closest<HTMLElement>('.binder-badge')!;
      expect(layer.closest('.binder-unowned')).toBeNull();
      expect(pocket(1)).toHaveAttribute('aria-describedby', layer.id);
      expect(pocket(1)).toHaveAccessibleDescription('3 friends have it');
    });

    it('never opens the card under it from a press on it', () => {
      const onSelect = vi.fn();
      render(binder({countsFor: none, pocketBadge: badge, onSelect}));
      fireEvent.click(screen.getByRole('button', {name: '3 friends have it'}));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('leaves a pocket it gives nothing for undescribed', () => {
      render(binder({countsFor: none, pocketBadge: badge}));
      expect(pocket(2)).toHaveAccessibleDescription('');
    });

    it('lays nothing over the pockets without it', () => {
      render(binder());
      expect(document.querySelector('.binder-badge')).toBeNull();
      expect(pocket(1)).not.toHaveAttribute('aria-describedby');
    });
  });
});
