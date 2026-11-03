import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import type {BinderChoices, OpenBinder} from './binderChoices';
import type {Binder} from './binderRules';

/*
 * Binders of your own for the stories: a small pool whose covers have art in
 * `public/card-images-preview`, so each medal draws offline, and a shelf of four.
 */

const cardOf = (id: string, facts: Partial<LorcanaCard>) =>
  ({id, name: id, fullName: id, cost: 2, inkwell: true, type: 'Character', setNumber: 1, ...facts}) as LorcanaCard;

export const STORY_BINDER_POOL: LorcanaCard[] = [
  cardOf('amber-legend', {ink: 'Amber', rarity: 'Legendary', setCode: '14', setNumber: 85, imageUrl: '/card-images-preview/14085.avif'}),
  cardOf('amber-common', {ink: 'Amber', rarity: 'Common', setCode: '13', setNumber: 3}),
  cardOf('amber-rare', {ink: 'Amber', rarity: 'Rare', setCode: '12', setNumber: 40}),
  cardOf('steel-enchanted', {ink: 'Steel', rarity: 'Enchanted', setCode: '14', setNumber: 213, imageUrl: '/card-images-preview/14213.avif'}),
  cardOf('emerald-epic', {ink: 'Emerald', rarity: 'Epic', setCode: '12', setNumber: 14, imageUrl: '/card-images-preview/14014.avif'}),
  cardOf('emerald-common', {ink: 'Emerald', rarity: 'Common', setCode: '12', setNumber: 23}),
];

/** Every Amber card but one, the Enchanted, and the Set 12 Epic: so each binder reads a different percentage. */
const STORY_BINDER_ENTRIES: CollectionEntries = {
  'amber-legend': {normal: 1, foil: 0},
  'amber-common': {normal: 2, foil: 1},
  'steel-enchanted': {normal: 0, foil: 1},
  'emerald-epic': {normal: 1, foil: 0},
};

const binderOf = (binder: Omit<Binder, 'coverId' | 'place'>, place: number): Binder => ({...binder, coverId: null, place});

const STORY_AMBER = binderOf({id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber'}, 0);

const STORY_BINDERS: Binder[] = [
  STORY_AMBER,
  binderOf({id: 'b2', name: 'Enchanted chase', scope: 'all', rules: 'rarity=Enchanted'}, 1),
  binderOf({id: 'b3', name: 'The Wilds Unknown', scope: '12', rules: ''}, 2),
  // Thirty letters, the longest a binder's name runs, and rules that hold none of the pool's cards.
  binderOf({id: 'b4', name: 'Shimmering Sapphire Collection', scope: 'all', rules: 'ink=Sapphire'}, 3),
];

/** Amber on show, its Legendary on the cover. */
export const STORY_OPEN_AMBER: OpenBinder = {binder: STORY_AMBER, cover: STORY_BINDER_POOL[0], narrowed: true};

/** The longest name on show, with no card of yours to cover it. */
export const STORY_OPEN_LONG: OpenBinder = {binder: STORY_BINDERS[3], cover: null, narrowed: true};

/** The Binders tab's view of the shelf: My collection on show unless a story opens a binder. */
export function storyBinderChoices(over: Partial<BinderChoices> = {}): BinderChoices {
  return {
    open: null,
    atOwnScope: true,
    shelf: {status: 'ready', binders: STORY_BINDERS, retry: () => {}},
    pool: STORY_BINDER_POOL,
    entries: STORY_BINDER_ENTRIES,
    onOpen: () => {},
    ...over,
  };
}
