import {describe, it, expect, vi, afterEach} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {BrowseSortOrder} from '../../shared/constants';
import type {CollectionEntries} from './collectionParser';
import type {BinderShow} from './binderCards';
import type {Axis} from './collectionStats';
import {CollectionBinderSection, type BinderStart} from './CollectionBinderSection';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const card = (id: string, setNumber: number, cost: number, setCode = '9') =>
  ({
    id,
    name: `Card ${id}`,
    fullName: `Card ${id}`,
    setCode,
    setNumber,
    cost,
    ink: 'Amber',
    type: 'Character',
    rarity: 'Common',
    inkwell: true,
  }) as unknown as LorcanaCard;

/** Set 9's #1-#3, and a card of the next set that the filters also let through. */
const POOL = [card('a', 1, 5), card('b', 2, 1), card('c', 3, 3), card('next', 1, 1, '10')];

interface SectionOptions {
  /** Every card the page holds; the four above unless a case needs more. */
  pool?: LorcanaCard[];
  sortOrder?: BrowseSortOrder;
  setCode?: string;
  entries?: CollectionEntries;
  isLoading?: boolean;
  error?: string | null;
  show?: BinderShow;
  axis?: Axis;
  onAxisChange?: (axis: Axis) => void;
  /** A friend's binder (#1045). */
  friend?: boolean;
  startAt?: BinderStart;
  /** Whether a filter or a search is on; by default, whether `matched` leaves any card out. */
  filtered?: boolean;
  renderFoilPointer?: (cards: readonly LorcanaCard[]) => ReactNode;
}

/** The section with `matched` the cards the page's filters let through, as the page counts them. */
function section(
  matched: string[],
  {
    pool = POOL,
    sortOrder = 'newest',
    setCode = '9',
    entries = {},
    isLoading = false,
    error = null,
    show = 'all',
    axis = 'complete',
    onAxisChange = vi.fn(),
    friend = false,
    startAt,
    filtered,
    renderFoilPointer,
  }: SectionOptions = {},
) {
  const counted = pool.filter((card) => matched.includes(card.id));
  return (
    <MemoryRouter>
      <CollectionBinderSection
        cards={pool}
        matchedIds={new Set(matched)}
        counted={counted}
        filtered={filtered ?? counted.length < pool.length}
        sortOrder={sortOrder}
        entries={entries}
        friend={friend}
        isLoading={isLoading}
        error={error}
        onRetry={vi.fn()}
        onCardSelect={vi.fn()}
        setCode={setCode}
        sets={['10', '9', 'P1']}
        setsLoading={false}
        onSetChange={vi.fn()}
        show={show}
        onShowChange={vi.fn()}
        axis={axis}
        onAxisChange={onAxisChange}
        startAt={startAt}
        renderFoilPointer={renderFoilPointer}
      />
    </MemoryRouter>
  );
}

const renderSection = (...args: Parameters<typeof section>) => render(section(...args));

/** The binder's pockets in order, by card. */
const pockets = () => screen.getAllByRole('button', {name: /^Card /}).map((tile) => tile.getAttribute('aria-label'));

describe('CollectionBinderSection', () => {
  describe('opened at a card (#1055)', () => {
    // Forty cards: the first spread holds 1 to 12 beside the cover, the second 13 to 36.
    const forty = Array.from({length: 40}, (_, i) => card(`s${i + 1}`, i + 1, 1));
    const ids = forty.map((each) => each.id);
    const at = (key: string) => section(ids, {pool: forty, startAt: {cardId: 's30', key}});

    it('opens at the card each navigation asks for, again over the same pockets', () => {
      const view = render(at('first'));
      expect(pockets()[0]).toBe('Card s13');
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      expect(pockets()[0]).toBe('Card s37');
      view.rerender(at('second'));
      expect(pockets()[0]).toBe('Card s13');
    });

    it('keeps the page on show when a later change of address asks nothing, over the same pockets', () => {
      const view = render(at('first'));
      fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
      view.rerender(section(ids, {pool: forty}));
      expect(pockets()[0]).toBe('Card s37');
    });

    it('opens new pockets at their start, though the navigation still names the card', () => {
      const view = render(at('first'));
      view.rerender(section(ids.slice(0, 36), {pool: forty, startAt: {cardId: 's30', key: 'first'}}));
      expect(pockets()[0]).toBe('Card s1');
    });

    it('opens at their start the pockets it was asked over, once they changed and came back', () => {
      const view = render(at('first'));
      view.rerender(section(ids.slice(0, 36), {pool: forty, startAt: {cardId: 's30', key: 'first'}}));
      view.rerender(at('first'));
      expect(pockets()[0]).toBe('Card s1');
    });
  });

  it('keeps the loading map, which holds no cards yet, from announcing "nothing missing"', () => {
    // jsdom's 1024px window is desktop, where the map docks under the binder.
    renderSection([], {isLoading: true});
    expect(screen.queryByRole('button', {name: /nothing missing/})).not.toBeInTheDocument();
  });

  it('opens the loading binder on the front cover, plain while the pockets hold placeholders, as the binder it stands for', () => {
    renderSection([], {isLoading: true});
    const cover = screen.getByRole('group', {name: 'Front cover'});
    expect(cover.querySelector('.ink-card-placeholder')).toBeNull();
    const rightPage = screen.getByRole('group', {name: 'Right page'});
    expect(rightPage.querySelector('.ink-card-placeholder')).not.toBeNull();
  });

  it('opens the loading binder on a page, with no cover, on a phone', () => {
    vi.stubGlobal('innerWidth', 390);
    renderSection([], {isLoading: true});
    expect(screen.queryByRole('group', {name: 'Front cover'})).toBeNull();
  });

  it('keeps the focus in the section when Try again swaps the error for the loading binder', async () => {
    // Retrying unmounts the button that had the focus, which then fell to the page (#790).
    const user = userEvent.setup();
    const view = renderSection([], {error: 'The rest of the cards did not load.'});
    await user.click(screen.getByRole('button', {name: 'Try again'}));
    view.rerender(section([], {isLoading: true}));
    expect(screen.getByRole('group', {name: 'Collection'})).toHaveFocus();
  });

  it("fits a phone's page to the section that Try again mounts in place of the error", () => {
    // The error state draws its own box, so the binder's section is a new element: a 394 by 904
    // section fits four rows, and its first page twelve of the thirteen cards.
    vi.stubGlobal('innerWidth', 390);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(394);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(904);
    const thirteen = Array.from({length: 13}, (_, i) => card(`s${i + 1}`, i + 1, 1));
    const ids = thirteen.map((held) => held.id);
    const view = renderSection(ids, {pool: thirteen, error: 'The rest of the cards did not load.'});
    view.rerender(section(ids, {pool: thirteen}));
    expect(pockets()).toContain('Card s12');
    expect(pockets()).not.toContain('Card s13');
  });

  it("holds only this set's cards that pass the filters, packed in the page's sort", () => {
    renderSection(['a', 'c', 'next'], {sortOrder: 'cost-asc'});
    expect(pockets()).toEqual(['Card c', 'Card a']);
  });

  it("counts only the cards the filters let through in the set panel's numbers", () => {
    // A tablet, where the section draws the panel itself, as a rail. Of Set 9's three
    // cards the filters let one through, and that one is owned: 100%, not 33%.
    vi.stubGlobal('innerWidth', 800);
    renderSection(['a'], {entries: {a: {normal: 1, foil: 0}}});
    expect(screen.getByRole('complementary', {name: 'Set'})).toHaveTextContent('filtered · 100% complete · 0% master');
  });

  it("draws a phone's binder alone, its set picker in the row Browse draws above it (#969)", () => {
    vi.stubGlobal('innerWidth', 390);
    renderSection(['a']);
    expect(pockets()).toEqual(['Card a']);
    expect(screen.queryByRole('complementary', {name: 'Set'})).toBeNull();
    expect(screen.queryByRole('button', {name: /^Binder set/})).toBeNull();
  });

  it('opens at the first spread when a filter changes what it holds', () => {
    // Thirty of Set 9's cards fill two spreads. Narrowing them must not leave the reader
    // on the second, which would now hold other cards.
    const thirty = Array.from({length: 30}, (_, i) => card(`s${i + 1}`, i + 1, 1));
    const ids = thirty.map((held) => held.id);
    const view = renderSection(ids, {pool: thirty});
    fireEvent.click(screen.getByRole('button', {name: 'Next spread'}));
    expect(screen.getByRole('button', {name: /^Spread 2 of 2/})).toHaveAttribute('aria-current', 'true');
    view.rerender(section(ids.slice(1), {pool: thirty}));
    expect(screen.getByRole('button', {name: /^Spread 1 of 2/})).toHaveAttribute('aria-current', 'true');
  });

  it('says so when nothing in this set matches, rather than drawing an empty binder', () => {
    // As a status, so a search that empties the binder is announced (#790).
    renderSection(['next']);
    expect(screen.getByRole('status')).toHaveTextContent('No cards in this set match your filters.');
    expect(screen.queryByRole('region', {name: 'Binder'})).toBeNull();
  });

  it.each([
    ['you-need', '9', 'No cards you need in this set match your filters.'],
    ['they-need', '9', 'No cards they need in this set match your filters.'],
    ['owned', 'all', 'No owned cards in their collection match your filters.'],
    ['all', 'promos', 'No cards in their promo sets match your filters.'],
  ] as const)("words a friend's empty %s view in a full sentence (#1045)", (show, setCode, line) => {
    renderSection([], {show, setCode, friend: true});
    expect(screen.getByRole('status')).toHaveTextContent(line);
  });

  describe('an empty Missing view with nothing narrowing it (#1055)', () => {
    it.each([
      ['9', 'complete', false, 'You have every card in this set.'],
      ['9', 'master', false, 'You have every card in this set, in every finish.'],
      ['all', 'complete', true, 'They have every card in every set.'],
      ['promos', 'master', false, 'You have every card in every promo set.'],
    ] as const)('says every card in %s is held under %s set (friend: %s)', (setCode, axis, friend, line) => {
      renderSection([], {pool: [...POOL, card('promo', 1, 1, 'P1')], show: 'missing', setCode, axis, friend, filtered: false});
      expect(screen.getByRole('status')).toHaveTextContent(line);
    });

    it('blames the filters, not a full binder, when the scope has no cards to hold', () => {
      renderSection([], {pool: [], show: 'missing', filtered: false});
      expect(screen.getByRole('status')).toHaveTextContent('No missing cards in this set match your filters.');
    });

    it("points to the foils friends have under Complete set, given the scope's cards", () => {
      const renderFoilPointer = vi.fn<(cards: readonly LorcanaCard[]) => ReactNode>(() => <p>Foils on offer</p>);
      renderSection([], {show: 'missing', filtered: false, renderFoilPointer});
      expect(screen.getByText('Foils on offer')).toBeInTheDocument();
      expect(renderFoilPointer.mock.calls[0][0].map((each) => each.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it.each([
      ['under Master set', {axis: 'master'}],
      ['in a promo scope', {setCode: 'promos'}],
      ['with a filter on', {filtered: true}],
      ['in another view', {show: 'owned'}],
    ] as const)('points nowhere %s', (_, options) => {
      const renderFoilPointer = vi.fn(() => <p>Foils on offer</p>);
      renderSection([], {show: 'missing', filtered: false, ...options, renderFoilPointer});
      expect(renderFoilPointer).not.toHaveBeenCalled();
    });
  });

  it('announces a load error as an alert', () => {
    renderSection([], {error: 'The rest of the cards did not load.'});
    expect(screen.getByRole('alert')).toHaveTextContent('The rest of the cards did not load.');
  });

  it('holds the whole collection set by set, each set continuing where the one before ends', () => {
    // Set 10's one card, then Set 9 straight after it on the same spread, which names both.
    renderSection(['a', 'b', 'next'], {setCode: 'all'});
    expect(pockets()).toEqual(['Card next', 'Card a', 'Card b']);
    expect(
      screen.getByRole('button', {
        name: 'Set 10, Whispers in the Well, spread 1 of 1, then Set 9, Fabled, spread 1 of 1: 3 missing',
      }),
    ).toBeInTheDocument();
  });

  describe("a phone's inside front cover, which holds the numbers (owner, 2026-10-27)", () => {
    const cover = () => screen.getByRole('group', {name: 'Front cover'});
    // A phone's binder has no arrows: its map's minis, and swipes, turn its pages.
    const toCover = () => fireEvent.click(screen.getByRole('button', {name: 'Front cover: collection numbers'}));
    /** Set 9's a, held in one finish, and b, held in both: Owned holds both under Complete, b alone under Master. */
    const HELD: CollectionEntries = {a: {normal: 1, foil: 0}, b: {normal: 1, foil: 1}};

    it('holds the numbers a page before page 1, where the binder opens', () => {
      vi.stubGlobal('innerWidth', 390);
      renderSection(['a', 'b'], {entries: HELD});
      expect(pockets()).toEqual(['Card a', 'Card b']);
      expect(screen.queryByRole('region', {name: 'Collection numbers'})).toBeNull();
      toCover();
      expect(within(cover()).getByRole('region', {name: 'Collection numbers'})).toHaveTextContent('Complete2 of 2 cards100%');
      expect(screen.queryAllByRole('button', {name: /^Card /})).toHaveLength(0);
    });

    it('keeps the cover, and the focus on the chosen headline, when Master changes what Owned holds', async () => {
      // The page lets through what Owned holds under the chosen headline (`isHeld`): Master drops
      // a, held in one finish. The binder holds other cards, so it is a new one, which opens on
      // the cover rather than page 1.
      vi.stubGlobal('innerWidth', 390);
      const user = userEvent.setup();
      const onAxisChange = vi.fn();
      const view = renderSection(['a', 'b'], {entries: HELD, show: 'owned', onAxisChange});
      toCover();
      await user.click(within(cover()).getByRole('button', {name: /^Master/}));
      expect(onAxisChange).toHaveBeenCalledWith('master');
      view.rerender(section(['b'], {entries: HELD, show: 'owned', axis: 'master', onAxisChange}));
      const master = within(cover()).getByRole('button', {name: /^Master/});
      expect(master).toHaveAttribute('aria-pressed', 'true');
      expect(master).toHaveFocus();
      fireEvent.click(screen.getByRole('button', {name: /^Page 1 of 1/}));
      expect(pockets()).toEqual(['Card b']);
    });

    it('opens on page 1 when a filter changes what it holds, even from the cover', () => {
      vi.stubGlobal('innerWidth', 390);
      const view = renderSection(['a', 'b'], {entries: HELD});
      toCover();
      view.rerender(section(['b'], {entries: HELD}));
      expect(screen.queryByRole('group', {name: 'Front cover'})).toBeNull();
      expect(pockets()).toEqual(['Card b']);
    });

    it('has no cover where nothing matches, and none on a tablet', () => {
      vi.stubGlobal('innerWidth', 390);
      const view = renderSection(['next']);
      expect(screen.queryByRole('group', {name: 'Front cover'})).toBeNull();
      expect(screen.queryByRole('region', {name: 'Collection numbers'})).toBeNull();
      view.unmount();
      vi.stubGlobal('innerWidth', 800);
      renderSection(['a']);
      expect(screen.queryByRole('group', {name: 'Front cover'})).not.toHaveTextContent('Complete');
    });
  });
});
