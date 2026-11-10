import {describe, expect, it} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {FilterDraft} from '../../../shared/hooks/useFilterParams';
import {WHOLE_COLLECTION} from '../binderCards';
import type {CollectionEntries} from '../collectionParser';
import type {OwnBindersAsk} from './binderChoices';
import type {Binder} from './binderRules';
import type {Held} from './binderShelf';
import {ownBindersOf} from './ownBinders';
import {SHELF_MAX} from './shelfWords';

const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({name: facts.id, fullName: facts.id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', setNumber: 1, ...facts}) as LorcanaCard;

const POOL = [
  cardOf({id: 'amber-common', setNumber: 3}),
  cardOf({id: 'amber-epic', rarity: 'Epic', setNumber: 210}),
  cardOf({id: 'steel-rare', ink: 'Steel', rarity: 'Rare', setNumber: 8}),
];
const ENTRIES: CollectionEntries = {'amber-epic': {normal: 1, foil: 0}};

const binderOf = (id: string, rules: string, place = 0): Binder => ({id, name: id, scope: WHOLE_COLLECTION, rules, pages: 4, cover: null, place});
const AMBER = binderOf('amber', 'ink=Amber');

const ASK: OwnBindersAsk = {uid: 'me', hasCollection: true, syncing: false, wanted: true, requested: null};
const held = (binders: Binder[]): Held => ({readerId: 'me', value: binders, myCollection: {pages: 4, cover: null}});
const EPIC: FilterDraft = {inks: [], types: [], costs: [], opts: {rarities: ['Epic']}};
const page = {draft: EPIC, query: '', scope: WHOLE_COLLECTION};

describe("ownBindersOf's offer", () => {
  it('offers My collection the page as a binder, once the shelf has loaded', () => {
    const {offerOf} = ownBindersOf(held([AMBER]), ASK, POOL, ENTRIES);
    expect(offerOf?.(page)?.rules).toBe('rarity=Epic');
  });

  it("joins the page onto the binder on show, over the whole pool, not the binder's own cards", () => {
    const {offerOf} = ownBindersOf(held([AMBER]), {...ASK, requested: 'amber'}, POOL, ENTRIES);
    expect(offerOf?.(page)).toMatchObject({rules: 'ink=Amber&rarity=Epic', figures: {cards: 1}});
  });

  it('offers nothing while the shelf loads, at 30 binders, or for a binder the shelf does not hold', () => {
    expect(ownBindersOf({readerId: 'me', value: 'loading'}, ASK, POOL, ENTRIES).offerOf).toBeNull();
    const thirty = Array.from({length: SHELF_MAX}, (_, place) => binderOf(`b${place}`, 'ink=Amber', place));
    expect(ownBindersOf(held(thirty), ASK, POOL, ENTRIES).offerOf).toBeNull();
    expect(ownBindersOf(held([AMBER]), {...ASK, requested: 'deleted'}, POOL, ENTRIES).offerOf).toBeNull();
  });
});
