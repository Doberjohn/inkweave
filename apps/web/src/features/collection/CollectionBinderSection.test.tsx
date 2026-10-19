import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {BrowseSortOrder} from '../../shared/constants';
import type {CollectionEntries} from './collectionParser';
import {CollectionBinderSection} from './CollectionBinderSection';

afterEach(() => {
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
  sortOrder?: BrowseSortOrder;
  setCode?: string;
  entries?: CollectionEntries;
  isLoading?: boolean;
}

/** The section with `matched` the cards the page's filters let through, as the page counts them. */
function renderSection(
  matched: string[],
  {sortOrder = 'newest', setCode = '9', entries = {}, isLoading = false}: SectionOptions = {},
) {
  const counted = POOL.filter((card) => matched.includes(card.id));
  render(
    <MemoryRouter>
      <CollectionBinderSection
        cards={POOL}
        matchedIds={new Set(matched)}
        counted={counted}
        filtered={counted.length < POOL.length}
        sortOrder={sortOrder}
        entries={entries}
        isLoading={isLoading}
        error={null}
        onRetry={vi.fn()}
        onCardSelect={vi.fn()}
        setCode={setCode}
        sets={['10', '9']}
        setsLoading={false}
        onSetChange={vi.fn()}
        show="all"
        onShowChange={vi.fn()}
      />
    </MemoryRouter>,
  );
}

/** The binder's pockets in order, by card. */
const pockets = () => screen.getAllByRole('button', {name: /^Card /}).map((tile) => tile.getAttribute('aria-label'));

describe('CollectionBinderSection', () => {
  it('keeps the loading map, which holds no cards yet, from announcing "nothing missing"', () => {
    // jsdom's 1024px window is desktop, where the map docks under the binder.
    renderSection([], {isLoading: true});
    expect(screen.queryByRole('button', {name: /nothing missing/})).not.toBeInTheDocument();
  });

  it('opens the loading binder on the front cover, plain while the pockets shimmer, as the binder it stands for', () => {
    renderSection([], {isLoading: true});
    const cover = screen.getByRole('group', {name: 'Front cover'});
    expect(cover.querySelector('.inkweave-shimmer-tile')).toBeNull();
    expect(screen.getByRole('group', {name: 'Right page'}).querySelector('.inkweave-shimmer-tile')).not.toBeNull();
  });

  it('opens the loading binder on a page, with no cover, on a phone', () => {
    vi.stubGlobal('innerWidth', 390);
    renderSection([], {isLoading: true});
    expect(screen.queryByRole('group', {name: 'Front cover'})).toBeNull();
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

  it('says so when nothing in this set matches, rather than drawing an empty binder', () => {
    renderSection(['next']);
    expect(screen.getByText('No cards in this set match your filters.')).toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Binder'})).toBeNull();
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
});
