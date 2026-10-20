import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {CollectionSetBody} from './CollectionSetPanel';
import {tallyCollection} from './collectionStats';
import {
  STORY_PROMO_SET,
  STORY_PROMO_STATS,
  STORY_SETS,
  STORY_SETS_WITH_PROMOS,
  STORY_STATS,
} from './collectionStoryData';

type BodyProps = Parameters<typeof CollectionSetBody>[0];

function bodyProps(overrides: Partial<BodyProps> = {}): BodyProps {
  return {
    setCode: '13',
    sets: STORY_SETS,
    setsLoading: false,
    onSetChange: vi.fn(),
    show: 'all',
    onShowChange: vi.fn(),
    axis: 'complete',
    onAxisChange: vi.fn(),
    stats: STORY_STATS,
    ...overrides,
  };
}

function renderBody(overrides: Partial<BodyProps> = {}) {
  const props = bodyProps(overrides);
  const view = render(<CollectionSetBody {...props} />);
  return {props, view};
}

const numbers = () => screen.getByRole('region', {name: 'Collection numbers'});

describe('CollectionSetBody', () => {
  it('leaves the set picker to the toolbar where it docks, and starts at what the binder shows', () => {
    renderBody({withPicker: false});
    expect(screen.queryByRole('button', {name: /^Binder set/})).toBeNull();
    expect(screen.getByRole('group', {name: 'Binder shows'})).toBeInTheDocument();
  });

  it("shows the open set's numbers", () => {
    renderBody();
    const {complete, cards} = STORY_STATS.sets.find((set) => set.code === '13')!.tally;
    expect(numbers()).toHaveTextContent('Complete set');
    expect(numbers()).toHaveTextContent(`${complete} of ${cards} cards`);
  });

  it("swaps a headline's name for its count while it is hovered, and back after", () => {
    renderBody();
    const {complete, cards} = STORY_STATS.sets.find((set) => set.code === '13')!.tally;
    // Both stay in the headline's name; only which one shows changes.
    const name = screen.getByText('Complete set');
    const count = screen.getByText(`${complete} of ${cards} cards`);
    const headline = screen.getByRole('button', {name: /^Complete set/});
    expect(count).toHaveStyle({opacity: '0'});
    fireEvent.mouseEnter(headline);
    expect(count).toHaveStyle({opacity: '1'});
    expect(name).toHaveStyle({opacity: '0'});
    fireEvent.mouseLeave(headline);
    expect(count).toHaveStyle({opacity: '0'});
    expect(name).toHaveStyle({opacity: '1'});
  });

  it("shows the whole collection's numbers in the same blocks", () => {
    renderBody({setCode: 'all'});
    const {complete, cards} = STORY_STATS.totals;
    expect(numbers()).toHaveTextContent('Complete collection');
    expect(numbers()).toHaveTextContent(`${complete.toLocaleString()} of ${cards.toLocaleString()} cards`);
    expect(screen.getByRole('region', {name: 'By rarity, complete'})).toBeInTheDocument();
  });

  it("drops the headlines' noun while the filters narrow what it counts", () => {
    renderBody({setCode: 'all', filtered: true});
    // The cards counted are no whole collection.
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText('Complete collection')).toBeNull();
  });

  it('says so when the filters leave no card, rather than drawing empty numbers', () => {
    renderBody({setCode: 'all', filtered: true, stats: tallyCollection([], {}, STORY_SETS)});
    expect(numbers()).toHaveTextContent('No cards match your filters');
    expect(screen.queryByRole('button', {name: /^Complete/})).toBeNull();
  });

  it("asks for the whole collection from the picker's first row, All sets", () => {
    const {props} = renderBody();
    fireEvent.click(screen.getByRole('button', {name: /^Binder set/}));
    expect(screen.getAllByRole('option')[0]).toHaveAccessibleName(/^All sets, the whole collection/);
    fireEvent.click(screen.getByRole('option', {name: /^All sets, the whole collection/}));
    expect(props.onSetChange).toHaveBeenCalledWith('all');
  });

  it('switches what the binder shows', () => {
    const {props} = renderBody();
    fireEvent.click(screen.getByRole('button', {name: 'Missing'}));
    expect(props.onShowChange).toHaveBeenCalledWith('missing');
  });

  it('breaks even a finished set down toward complete, until Master set is chosen', () => {
    // Set 12 is finished. It used to switch to master unasked, and a complete set's
    // Common 10/72 was taken for a bug.
    const {props, view} = renderBody({setCode: '12'});
    expect(screen.getByRole('button', {name: /^Complete set/})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', {name: 'By ink, complete'})).toBeInTheDocument();
    // The page holds the choice, since Owned and Missing ask it too (owner, 2026-10-20).
    fireEvent.click(screen.getByRole('button', {name: /^Master set/}));
    expect(props.onAxisChange).toHaveBeenCalledWith('master');
    view.rerender(<CollectionSetBody {...bodyProps({setCode: '12', axis: 'master'})} />);
    expect(screen.getByRole('button', {name: /^Master set/})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', {name: 'By rarity, master'})).toBeInTheDocument();
  });

  it('breaks the whole collection down toward the chosen headline too', () => {
    renderBody({setCode: 'all', axis: 'master'});
    expect(screen.getByRole('button', {name: /^Master collection/})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', {name: 'By ink, master'})).toBeInTheDocument();
  });

  it('lists the chase printings after the five rarities an import can fill', () => {
    renderBody();
    const rows = screen.getByRole('region', {name: 'By rarity, complete'}).textContent ?? '';
    const rulebookOrder = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic'];
    const order = rulebookOrder.map((rarity) => rows.indexOf(rarity));
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]))).toBe(true);
  });

  it("holds the numbers' place while the pool loads", () => {
    renderBody({stats: null});
    expect(numbers()).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Complete set')).not.toBeInTheDocument();
  });

  describe('a promo set (#805)', () => {
    const promoSet = {setCode: STORY_PROMO_SET, sets: STORY_SETS_WITH_PROMOS, stats: STORY_PROMO_STATS};

    it('shows Complete set and By ink alone, counting promos, whatever headline was chosen', () => {
      renderBody({...promoSet, axis: 'master'});
      const {complete, cards} = STORY_PROMO_STATS.sets.find((set) => set.code === STORY_PROMO_SET)!.tally;
      expect(numbers()).toHaveTextContent(`${complete} of ${cards} promos`);
      expect(screen.queryByRole('button', {name: /^Master set/})).toBeNull();
      expect(screen.getByRole('region', {name: 'By ink, complete'})).toBeInTheDocument();
      expect(screen.queryByRole('region', {name: /^By rarity/})).toBeNull();
    });

    it('shows every promo set as one, Complete promos counting promos alone (owner, 2026-10-20)', () => {
      renderBody({...promoSet, setCode: 'promos'});
      const {complete, cards} = STORY_PROMO_STATS.promoTotals;
      expect(screen.getByText('Complete promos')).toBeInTheDocument();
      expect(numbers()).toHaveTextContent(`${complete} of ${cards} promos`);
      expect(screen.queryByRole('button', {name: /^Master/})).toBeNull();
    });

    it("counts the promos in the whole collection's numbers, under Promo by rarity", () => {
      renderBody({...promoSet, setCode: 'all'});
      const rows = screen.getByRole('region', {name: 'By rarity, complete'});
      // Three of the story's seven promos are held.
      expect(within(rows).getByText('Promo').parentElement).toHaveTextContent('Promo3/7');
      expect(rows).not.toHaveTextContent('Special');
    });

    it("holds one headline's place while the pool loads, since its numbers have one", () => {
      renderBody({...promoSet, stats: null});
      // A headline's place is its line and its bar.
      expect(numbers().querySelectorAll('.react-loading-skeleton')).toHaveLength(2);
    });
  });
});
