import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import {browseView, printingIdsFor} from '../browseView';
import {binderRarities} from '../../features/collection/binderCards';

// Core folds Elsa's Enchanted printing into her card; the collection's wide pool
// also holds that printing as a card of its own, and cards from before Core.
const elsa = createCard({id: 'elsa', rarity: 'Legendary', variants: [{id: 'elsa-ench', rarity: 'Enchanted', number: 205}]});
const anna = createCard({id: 'anna', rarity: 'Rare'});
const core = [elsa, anna];
const wide = [...core, createCard({id: 'elsa-ench', rarity: 'Enchanted'}), createCard({id: 'set-1', setCode: '1'})];

const params = (rarities?: string[], setCodes?: string[]) => ({
  filters: {...(rarities && {rarities}), ...(setCodes && {setCodes})},
  inkFilters: [],
  typeFilters: [],
  costFilters: [],
  searchQuery: '',
  sortOrder: 'ink-cost' as const,
});

/** Holds Anna and the Set 1 card, and nothing else. */
const owns = (cardId: string) => cardId === 'anna' || cardId === 'set-1';
/** Collection mode's slots, its binder showing every card unless told otherwise. */
const binder = (active: boolean, show: 'all' | 'owned' | 'missing' = 'all') => ({
  active,
  pool: wide,
  show,
  owns,
  rarityOptions: binderRarities,
});

const ids = (cards: LorcanaCard[]) => cards.map((card) => card.id).sort();

describe('browseView', () => {
  it('lists Core while the binder is off, even with the wide pool loaded for an import', () => {
    expect(ids(browseView(binder(false), core, params()).sortedCards)).toEqual(['anna', 'elsa']);
  });

  it("finds the grid's cards through a picked printing, and offers their printings' rarities", () => {
    const view = browseView(null, core, params(['Enchanted']));
    expect(ids(view.sortedCards)).toEqual(['elsa']);
    expect(view.rarities).toEqual(['Rare', 'Legendary', 'Enchanted']);
  });

  it("offers the binder its pool's keywords and classifications, which sets 1-8 widen", () => {
    const broom = createCard({id: 'broom', setCode: '1', keywords: ['Vanish'], classifications: ['Broom']});
    const view = browseView({...binder(true), pool: [...wide, broom]}, core, params());
    expect(view.binderOptions?.keywords).toContain('Vanish');
    expect(view.binderOptions?.classifications).toContain('Broom');
    // The grid keeps Core's options, which CardDataContext already holds.
    expect(browseView(null, core, params()).binderOptions).toBeNull();
  });

  it("matches the binder's printings by their own rarity, not their base card", () => {
    expect(ids(browseView(binder(true), core, params(['Enchanted'])).sortedCards)).toEqual(['elsa-ench']);
  });

  it('shows the binder the cards you hold, or the ones you hold none of', () => {
    expect(ids(browseView(binder(true, 'owned'), core, params()).sortedCards)).toEqual(['anna', 'set-1']);
    expect(ids(browseView(binder(true, 'missing'), core, params()).sortedCards)).toEqual(['elsa', 'elsa-ench']);
  });

  it('leaves the grid alone: it has no binder view', () => {
    expect(ids(browseView(binder(false, 'owned'), core, params()).sortedCards)).toEqual(['anna', 'elsa']);
  });

  it('applies no set filter to the binder, whose set is chosen in the collection panel', () => {
    expect(ids(browseView(binder(true), core, params(undefined, ['99'])).sortedCards)).toHaveLength(4);
    expect(ids(browseView(binder(false), core, params(undefined, ['99'])).sortedCards)).toEqual([]);
  });

  it("hands the collection panel the cards before the binder's view, or Owned would read 100%", () => {
    const view = browseView(binder(true, 'owned'), core, params());
    expect(ids(view.sortedCards)).toEqual(['anna', 'set-1']);
    expect(ids(view.matchedCards)).toEqual(['anna', 'elsa', 'elsa-ench', 'set-1']);
  });

  it('calls the list filtered for a search or a filter it applies, never for the set filter the binder drops', () => {
    expect(browseView(binder(true), core, params()).filtered).toBe(false);
    expect(browseView(binder(true), core, {...params(), searchQuery: 'Elsa'}).filtered).toBe(true);
    expect(browseView(binder(true), core, params(['Enchanted'])).filtered).toBe(true);
    expect(browseView(binder(true), core, params(undefined, ['99'])).filtered).toBe(false);
  });
});

describe('printingIdsFor', () => {
  it('opens each card on its printing of a picked rarity, and the rest on their own art', () => {
    const byId = new Map(core.map((card) => [card.id, card]));
    const printingFor = printingIdsFor((id) => byId.get(id), ['Enchanted']);
    expect(printingFor('elsa')).toBe('elsa-ench');
    expect(printingFor('anna')).toBeUndefined();
  });
});
