import {describe, expect, it} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {FilterDraft} from '../../../shared/hooks/useFilterParams';
import {ALL_PROMO_SETS, WHOLE_COLLECTION} from '../binderCards';
import {draftOf, filtersCards, readRules, ruleKinds, ruleLine, rulePool, writeRules} from './binderRules';

/** A card for these tests, named by its id: a 1-cost Amber Common in Set 12 unless told otherwise. */
const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({
    name: facts.id,
    fullName: facts.id,
    cost: 1,
    ink: 'Amber',
    inkwell: true,
    type: 'Character',
    rarity: 'Common',
    setCode: '12',
    ...facts,
  }) as LorcanaCard;

const POOL = [
  cardOf({id: 'stitch', name: 'Stitch', fullName: 'Stitch - Rock Star'}),
  cardOf({id: 'stitch-epic', name: 'Stitch', fullName: 'Stitch - Rock Star', rarity: 'Epic', baseId: 'stitch'}),
  cardOf({id: 'elsa', name: 'Elsa', fullName: 'Elsa - Ice Maker', ink: 'Amethyst', rarity: 'Epic'}),
  cardOf({id: 'mickey', name: 'Mickey', fullName: 'Mickey - Wayward', setCode: '11'}),
  cardOf({id: 'promo', name: 'Goofy', fullName: 'Goofy - Promo', rarity: 'Special', setCode: 'P1'}),
  cardOf({id: 'promo-steel', name: 'Pluto', fullName: 'Pluto - Promo', ink: 'Steel', rarity: 'Special', setCode: 'P2'}),
];

const ids = (cards: readonly LorcanaCard[]) => cards.map((card) => card.id);
const binder = (scope: string, rules = '') => ({scope, rules});

describe('readRules', () => {
  it('reads the filter params alone, leaving out the set, sort, views and unknown params', () => {
    const rules = readRules({rules: 'ink=Amber&set=12&sort=name&binder=all&owned=owned&friend=x&custom=b1&zap=1'});
    expect(rules).toEqual({searchQuery: '', inkFilters: ['Amber'], typeFilters: [], costFilters: [], filters: {}});
  });

  it('drops values the app does not know, as the page does', () => {
    const rules = readRules({rules: 'ink=Amber,Gold&cost=3,12&inkwell=maybe&type=Spell,Item'});
    expect(rules).toMatchObject({inkFilters: ['Amber'], costFilters: [3], typeFilters: ['Item'], filters: {}});
  });
});

describe('filtersCards', () => {
  it('is false for Sets alone and true for any rule or search', () => {
    expect(filtersCards({rules: ''})).toBe(false);
    expect(filtersCards({rules: 'sort=name'})).toBe(false);
    expect(filtersCards({rules: 'rarity=Epic'})).toBe(true);
    expect(filtersCards({rules: 'q=Stitch'})).toBe(true);
  });
});

describe('rulePool', () => {
  it('holds the whole pool for every set and no rule', () => {
    expect(ids(rulePool(POOL, binder(WHOLE_COLLECTION)))).toEqual(ids(POOL));
  });

  it('holds an ink across every set, the promos included', () => {
    expect(ids(rulePool(POOL, binder(WHOLE_COLLECTION, 'ink=Amber')))).toEqual([
      'stitch',
      'stitch-epic',
      'mickey',
      'promo',
    ]);
  });

  it('matches a rarity by each card, a printing by its own', () => {
    expect(ids(rulePool(POOL, binder(WHOLE_COLLECTION, 'rarity=Epic')))).toEqual(['stitch-epic', 'elsa']);
  });

  it('matches the search as the search box does', () => {
    expect(ids(rulePool(POOL, binder(WHOLE_COLLECTION, 'q=Stitch')))).toEqual(['stitch', 'stitch-epic']);
  });

  it('holds one set, and every promo set, by its Sets', () => {
    expect(ids(rulePool(POOL, binder('11')))).toEqual(['mickey']);
    expect(ids(rulePool(POOL, binder(ALL_PROMO_SETS)))).toEqual(['promo', 'promo-steel']);
  });

  it('ignores a rarity rule in a promo scope, as the binder ignores the page’s', () => {
    expect(ids(rulePool(POOL, binder(ALL_PROMO_SETS, 'rarity=Epic&ink=Steel')))).toEqual(['promo-steel']);
  });

  it('never applies a set filter its rules carry', () => {
    expect(ids(rulePool(POOL, binder('12', 'set=11')))).toEqual(['stitch', 'stitch-epic', 'elsa']);
  });
});

describe('ruleKinds', () => {
  it('names each kind of rule in a fixed order, never a value', () => {
    expect(ruleKinds(binder('12', 'rarity=Epic&ink=Amber'))).toBe('sets,ink,rarity');
    expect(ruleKinds(binder(WHOLE_COLLECTION, 'q=Stitch&classification=Hero'))).toBe('classification,name');
    expect(ruleKinds(binder(WHOLE_COLLECTION, 'ink=Amber,Steel&inkmatch=dual&inkwell=inkable&cost=3'))).toBe(
      'ink,dual,inkwell,cost',
    );
  });

  it('says none for every card', () => {
    expect(ruleKinds(binder(WHOLE_COLLECTION))).toBe('none');
  });

  // The filter ignores the switch there, as the page drops it.
  it('leaves out the dual-ink switch beside no ink, or three or more', () => {
    expect(ruleKinds(binder(WHOLE_COLLECTION, 'ink=Amber,Steel,Ruby&inkmatch=dual'))).toBe('ink');
    expect(ruleKinds(binder(WHOLE_COLLECTION, 'inkmatch=dual'))).toBe('none');
  });
});

describe('ruleLine', () => {
  it('names one rule of each kind as its chip does', () => {
    expect(ruleLine(binder(WHOLE_COLLECTION, 'ink=Amber'))).toBe('Amber ink');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'rarity=Special'))).toBe('Promo');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'inkwell=uninkable'))).toBe('Uninkable');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'cost=3'))).toBe('Cost 3');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'q=Stitch'))).toBe('Name has "Stitch"');
    expect(ruleLine(binder('12'))).toBe('The Wilds Unknown');
  });

  it('runs two values and three together', () => {
    expect(ruleLine(binder(WHOLE_COLLECTION, 'ink=Amber,Steel'))).toBe('Amber and Steel ink');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'ink=Amber,Steel&inkmatch=dual'))).toBe('Amber and Steel dual-ink');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'ink=Amber,Steel,Ruby&inkmatch=dual'))).toBe('Amber, Steel and Ruby ink');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'cost=9,3,5'))).toBe('Costs 3, 5 and 9+');
    expect(ruleLine(binder(WHOLE_COLLECTION, 'type=Character,Item'))).toBe('Character and Item');
  });

  it('joins the rules in the panel’s order, the search and the Sets last', () => {
    expect(ruleLine(binder(ALL_PROMO_SETS, 'q=Mickey&rarity=Epic&ink=Amber&keyword=Ward'))).toBe(
      'Amber ink · Epic · Ward · Name has "Mickey" · All promo sets',
    );
  });

  it('reads "Every card" with no rule, as My collection does', () => {
    expect(ruleLine(binder(WHOLE_COLLECTION))).toBe('Every card');
  });
});

describe('writeRules', () => {
  it('writes the rules in one fixed order, never a set', () => {
    const draft: FilterDraft = {
      inks: ['Steel', 'Amber'],
      types: ['Character'],
      costs: [3],
      opts: {rarities: ['Epic'], keywords: ['Evasive'], inkMatch: 'dual', setCodes: ['12']},
    };
    const rules = new URLSearchParams(writeRules(draft, ' Stitch '));
    expect([...rules.keys()]).toEqual(['q', 'ink', 'type', 'cost', 'keyword', 'rarity', 'inkmatch']);
    expect(rules.get('q')).toBe('Stitch');
  });

  it('reads back as the rules it wrote', () => {
    const rules = 'q=Stitch&ink=Amber%2CSteel&cost=3&classification=Hero%2CPrincess&inkwell=inkable&inkmatch=dual';
    const {draft, query} = draftOf({rules});
    expect(writeRules(draft, query)).toBe(rules);
    expect(readRules({rules: writeRules(draft, query)})).toEqual(readRules({rules}));
  });

  it('drops the dual-ink switch where the filter ignores it, and writes nothing for no rule', () => {
    expect(writeRules({inks: ['Amber'], types: [], costs: [], opts: {inkMatch: 'dual'}}, '')).toBe('ink=Amber&inkmatch=dual');
    expect(writeRules({inks: [], types: [], costs: [], opts: {inkMatch: 'dual'}}, '  ')).toBe('');
  });
});
