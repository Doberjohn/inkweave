import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  error?: string | null;
}

/** The section with `matched` the cards the page's filters let through, as the page counts them. */
function section(
  matched: string[],
  {sortOrder = 'newest', setCode = '9', entries = {}, isLoading = false, error = null}: SectionOptions = {},
) {
  const counted = POOL.filter((card) => matched.includes(card.id));
  return (
    <MemoryRouter>
      <CollectionBinderSection
        cards={POOL}
        matchedIds={new Set(matched)}
        counted={counted}
        filtered={counted.length < POOL.length}
        sortOrder={sortOrder}
        entries={entries}
        isLoading={isLoading}
        error={error}
        onRetry={vi.fn()}
        onCardSelect={vi.fn()}
        setCode={setCode}
        sets={['10', '9']}
        setsLoading={false}
        onSetChange={vi.fn()}
        show="all"
        onShowChange={vi.fn()}
      />
    </MemoryRouter>
  );
}

const renderSection = (...args: Parameters<typeof section>) => render(section(...args));

/** The binder's pockets in order, by card. */
const pockets = () => screen.getAllByRole('button', {name: /^Card /}).map((tile) => tile.getAttribute('aria-label'));

describe('CollectionBinderSection', () => {
  it('keeps the loading map, which holds no cards yet, from announcing "nothing missing"', () => {
    // jsdom's 1024px window is desktop, where the map docks under the binder.
    renderSection([], {isLoading: true});
    expect(screen.queryByRole('button', {name: /nothing missing/})).not.toBeInTheDocument();
  });

  it('keeps the focus in the section when Try again swaps the error for the loading binder', async () => {
    // Retrying unmounts the button that had the focus, which then fell to the page (#790).
    const user = userEvent.setup();
    const view = renderSection([], {error: 'The rest of the cards did not load.'});
    await user.click(screen.getByRole('button', {name: 'Try again'}));
    view.rerender(section([], {isLoading: true}));
    expect(screen.getByRole('group', {name: 'Collection'})).toHaveFocus();
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
    // As a status, so a search that empties the binder is announced (#790).
    renderSection(['next']);
    expect(screen.getByRole('status')).toHaveTextContent('No cards in this set match your filters.');
    expect(screen.queryByRole('region', {name: 'Binder'})).toBeNull();
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
});
