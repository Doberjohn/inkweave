import {describe, expect, it} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {FilterDraft} from '../../../shared/hooks/useFilterParams';
import {ALL_PROMO_SETS, WHOLE_COLLECTION} from '../binderCards';
import type {CollectionEntries} from '../collectionParser';
import {binderFace} from './binderCovers';
import {BINDER_NAME_MAX, isValidBinderName} from './binderName';
import {joinRules, saveOffer, suggestName} from './saveRules';

/** A page's filters: none unless told otherwise. */
const draftOf = (picks: Partial<FilterDraft> = {}): FilterDraft => ({inks: [], types: [], costs: [], opts: {}, ...picks});
const rulesOf = (rules: string) => ({rules});

describe('joinRules', () => {
  it("writes the page's filters and search as the row stores them in My collection", () => {
    expect(joinRules(null, draftOf({inks: ['Amber'], opts: {rarities: ['Epic']}}), ' Stitch ')).toBe(
      'q=Stitch&ink=Amber&rarity=Epic',
    );
  });

  it("joins a rarity onto an ink binder, and Hero onto Princess's classifications", () => {
    expect(joinRules(rulesOf('ink=Amber'), draftOf({opts: {rarities: ['Epic']}}), '')).toBe('ink=Amber&rarity=Epic');
    expect(joinRules(rulesOf('classification=Princess'), draftOf({opts: {classifications: ['Hero']}}), '')).toBe(
      'classification=Princess%2CHero',
    );
  });

  it("keeps a pick that is the binder's own", () => {
    expect(joinRules(rulesOf('ink=Amber&rarity=Epic'), draftOf({inks: ['Amber']}), '')).toBe('ink=Amber&rarity=Epic');
  });

  it('answers null for another ink, the dual-ink switch onto an ink rule, and a second rarity', () => {
    expect(joinRules(rulesOf('ink=Amber'), draftOf({inks: ['Steel']}), '')).toBeNull();
    expect(joinRules(rulesOf('ink=Amber'), draftOf({inks: ['Amber'], opts: {inkMatch: 'dual'}}), '')).toBeNull();
    expect(joinRules(rulesOf('rarity=Epic'), draftOf({opts: {rarities: ['Legendary']}}), '')).toBeNull();
  });

  it('answers null for a second search, and keeps the same one in any case', () => {
    expect(joinRules(rulesOf('q=Stitch'), draftOf(), 'Elsa')).toBeNull();
    expect(joinRules(rulesOf('q=Stitch'), draftOf(), 'stitch')).toBe('q=Stitch');
  });
});

describe('suggestName', () => {
  it('names a binder by its first rule: ink, rarity, type, classification, keyword, then search', () => {
    expect(suggestName({scope: WHOLE_COLLECTION, rules: 'ink=Amber,Steel&rarity=Epic'})).toBe('Amber and Steel');
    expect(suggestName({scope: WHOLE_COLLECTION, rules: 'rarity=Epic&type=Item'})).toBe('Epic');
    expect(suggestName({scope: WHOLE_COLLECTION, rules: 'rarity=Special'})).toBe('Promo');
    expect(suggestName({scope: WHOLE_COLLECTION, rules: 'classification=Princess&keyword=Evasive'})).toBe('Princess');
    expect(suggestName({scope: WHOLE_COLLECTION, rules: 'keyword=Evasive&q=Stitch'})).toBe('Evasive');
    expect(suggestName({scope: WHOLE_COLLECTION, rules: 'q=Stitch&cost=3'})).toBe('Stitch');
  });

  it('falls back on its Sets, then its first rule as its line reads it', () => {
    expect(suggestName({scope: ALL_PROMO_SETS, rules: 'cost=3'})).toBe('All promo sets');
    expect(suggestName({scope: WHOLE_COLLECTION, rules: 'cost=3'})).toBe('Cost 3');
  });

  it('cuts a long name at a word, within 30 letters', () => {
    const name = suggestName({scope: WHOLE_COLLECTION, rules: 'ink=Amber,Amethyst,Emerald,Ruby,Sapphire,Steel'});
    expect(name).toBe('Amber, Amethyst, Emerald, Ruby');
    expect(suggestName({scope: WHOLE_COLLECTION, rules: `q=${'x'.repeat(40)}`})).toBe('x'.repeat(30));
  });

  it('cuts at the very limit the name check holds, so a suggestion is never refused nor cut short', () => {
    const name = suggestName({scope: WHOLE_COLLECTION, rules: `q=${'x'.repeat(BINDER_NAME_MAX + 10)}`});
    expect(name).toBe('x'.repeat(BINDER_NAME_MAX));
    expect(isValidBinderName(name)).toBe(true);
  });
});

describe('saveOffer', () => {
  const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
    ({name: facts.id, fullName: facts.id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', setNumber: 1, ...facts}) as LorcanaCard;
  const POOL = [
    cardOf({id: 'amber-common', setNumber: 3}),
    cardOf({id: 'amber-epic', rarity: 'Epic', setNumber: 210}),
    cardOf({id: 'steel-rare', ink: 'Steel', rarity: 'Rare', setCode: '11', setNumber: 8}),
  ];
  const ENTRIES: CollectionEntries = {'amber-epic': {normal: 1, foil: 0}};
  const myCollection = {binder: null, scope: WHOLE_COLLECTION, pool: POOL, entries: ENTRIES};

  it('offers nothing with no filter and no search on', () => {
    expect(saveOffer(myCollection, draftOf(), '  ')).toBeNull();
  });

  it("offers the page's rules, its line, and the numbers the binder would read on its cover", () => {
    const offer = saveOffer(myCollection, draftOf({inks: ['Amber']}), '');
    const face = binderFace(POOL, ENTRIES, {id: 'b', name: 'Amber', scope: WHOLE_COLLECTION, rules: 'ink=Amber', pages: 4, cover: null, place: 0});
    expect(offer).toEqual({scope: WHOLE_COLLECTION, rules: 'ink=Amber', line: 'Amber ink', figures: face.figures});
    expect(offer?.figures).toMatchObject({complete: 1, cards: 2});
  });

  it("joins the page's picks onto the open binder's rules, and offers nothing on a clash", () => {
    const amber = {...myCollection, binder: {scope: WHOLE_COLLECTION, ...rulesOf('ink=Amber')}};
    expect(saveOffer(amber, draftOf({opts: {rarities: ['Epic']}}), '')?.rules).toBe('ink=Amber&rarity=Epic');
    expect(saveOffer(amber, draftOf({inks: ['Steel']}), '')).toBeNull();
  });

  it("offers no copy of the open binder: its own pick at its own Sets, though a set picked in it makes another", () => {
    const amber = {...myCollection, binder: {scope: WHOLE_COLLECTION, ...rulesOf('ink=Amber')}};
    expect(saveOffer(amber, draftOf({inks: ['Amber']}), '')).toBeNull();
    expect(saveOffer({...amber, scope: '12'}, draftOf({inks: ['Amber']}), '')).toMatchObject({scope: '12', rules: 'ink=Amber'});
  });

  it('offers nothing for rules that hold no card, or more than the table holds', () => {
    expect(saveOffer(myCollection, draftOf({inks: ['Ruby']}), '')).toBeNull();
    // A search that still finds Amber cards, written longer than the table's 1,000 letters.
    const long = 'amber '.repeat(200);
    expect(saveOffer(myCollection, draftOf(), 'amber')).not.toBeNull();
    expect(saveOffer(myCollection, draftOf(), long)).toBeNull();
  });

  it('keeps the set the picker picked as its Sets', () => {
    expect(saveOffer({...myCollection, scope: '11'}, draftOf({inks: ['Steel']}), '')).toMatchObject({scope: '11', figures: {cards: 1}});
  });
});
