import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {getUniqueClassifications, getUniqueKeywords} from '../../cards/loader';
import {useDraftFilters} from '../../../shared/hooks/useDraftFilters';
import {WHOLE_COLLECTION, binderContents, binderRarities, binderSets, isPromoScope} from '../binderCards';
import type {CollectionEntries} from '../collectionParser';
import {isHeld} from '../collectionStats';
import {faceOf, type BinderFace} from './binderCovers';
import {clampBinderName, isValidBinderName, trimBinderName} from './binderName';
import type {BinderInput} from './binderRepository';
import {RULES_MAX, draftOf, ruleLine, ruleParts, rulePool, scopedDraft, writeRules, type Binder} from './binderRules';

/** The pockets on a binder's first page, as the window previews them. */
const FIRST_PAGE = 12;

/** What the window starts from: the binder Edit rules changes, or a new binder's name, Sets and rules. */
export interface DraftStart {
  binder: Binder | null;
  name: string;
  scope: string;
  rules: string;
}

/** A new binder's name, Sets and rules, as Save as a binder hands them to the window. */
export type NewStart = Omit<DraftStart, 'binder'>;

const EMPTY_START: NewStart = {name: '', scope: WHOLE_COLLECTION, rules: ''};

/**
 * A start for Edit rules (a binder), or for a new binder (null): the `seed` Save as a binder
 * hands over, else no name, every set and no rule.
 */
export const startOf = (binder: Binder | null, seed: NewStart = EMPTY_START): DraftStart =>
  binder === null
    ? {binder, ...seed}
    : {binder, name: binder.name, scope: binder.scope, rules: binder.rules};

/** One pocket of the first page: its card, and whether you have it, else it shows grey. */
interface PreviewPocket {
  card: LorcanaCard;
  held: boolean;
}

/** What a change to a binder comes to, for `binder_changed`: its Sets or rules, else its name alone. */
export type ChangeKind = 'rules' | 'name';

/**
 * The Rarity options at a Sets: the binder's (`binderRarities`), none for promos alone. A rarity
 * picked under other Sets stays offered, in rarity order, so the player sees why the count fell
 * and can take it off.
 */
function raritiesAt(pool: readonly LorcanaCard[], scope: string, picked: readonly string[]): string[] {
  if (isPromoScope(scope)) return [];
  const offered = new Set(binderRarities(rulePool(pool, {scope, rules: ''})));
  return binderRarities(pool).filter((rarity) => offered.has(rarity) || picked.includes(rarity));
}

/** The first page as the binder opens it: its Sets in collector order, newest set first. */
function firstPage(cards: LorcanaCard[], entries: CollectionEntries, scope: string): PreviewPocket[] {
  return binderContents(cards, scope, 'newest', binderSets(cards))
    .slice(0, FIRST_PAGE)
    .map((card) => ({card, held: isHeld(card, entries, 'complete')}));
}

/** What the draft binder holds and shows, from its Sets and written rules. */
function previewOf(pool: readonly LorcanaCard[], entries: CollectionEntries, ask: {scope: string; rules: string; coverId: string | null}) {
  const cards = rulePool(pool, ask);
  const face: BinderFace = faceOf(cards, entries, ask);
  return {...face, chips: ruleParts(ask), line: ruleLine(ask), firstPage: firstPage(cards, entries, ask.scope)};
}

/**
 * The preview, a hook of its own: in the draft's body the compiler memoizes it with the name's
 * checks, so each letter typed would run the rules over the whole pool again. `'use memo'` opts
 * it in, since it calls no hook.
 */
function usePreview(source: {pool: readonly LorcanaCard[]; entries: CollectionEntries}, ask: {scope: string; rules: string; coverId: string | null}) {
  'use memo';
  const {scope, rules, coverId} = ask;
  return previewOf(source.pool, source.entries, {scope, rules, coverId});
}

/** What Save changes would change, or null for nothing. */
function changeOf(binder: Binder, input: BinderInput): ChangeKind | null {
  const ruled = draftOf(binder);
  if (input.scope !== binder.scope || input.rules !== writeRules(ruled.draft, ruled.query)) return 'rules';
  return input.name !== binder.name ? 'name' : null;
}

/**
 * The New binder window's state: the name, the Sets, the filters as a draft, and Name has,
 * and from them the binder they would make: its rules written as the row stores them
 * (`writeRules`), its cards (`rulePool`), its cover and numbers as the shelf counts them
 * (`faceOf`), its chips and its first page. The window mounts it afresh for each opening.
 *
 * It saves only a binder the table takes, with a card: a valid name, at least one card, and
 * when editing a change.
 */
export function useBinderDraft({start, pool, entries}: {start: DraftStart; pool: readonly LorcanaCard[]; entries: CollectionEntries}) {
  const begun = draftOf(start);
  const [name, setName] = useState(start.name);
  const [scope, setScope] = useState(start.scope);
  const [query, setQuery] = useState(begun.query);
  const filters = useDraftFilters({
    isOpen: true,
    inkFilters: begun.draft.inks,
    typeFilters: begun.draft.types,
    costFilters: begun.draft.costs,
    filters: begun.draft.opts,
  });
  const draft = {inks: filters.draftInks, types: filters.draftTypes, costs: filters.draftCosts, opts: filters.draftFilters};
  const rules = writeRules(scopedDraft(draft, scope), query);
  const coverId = start.binder?.coverId ?? null;
  const preview = usePreview({pool, entries}, {scope, rules, coverId});
  const input: BinderInput = {name: trimBinderName(name), scope, rules, coverId};
  const change = start.binder === null ? null : changeOf(start.binder, input);
  const holdsCards = preview.figures.cards > 0;
  const rulesTooLong = rules.length > RULES_MAX;
  return {
    name,
    setName: (next: string) => setName(clampBinderName(next)),
    scope,
    setScope,
    query,
    setQuery,
    filters,
    options: {
      sets: binderSets(pool),
      keywords: getUniqueKeywords([...pool]),
      classifications: getUniqueClassifications([...pool]),
      rarities: raritiesAt(pool, scope, filters.draftFilters.rarities ?? []),
    },
    preview,
    holdsCards,
    rulesTooLong,
    input,
    change,
    canSave:
      isValidBinderName(name) && holdsCards && !rulesTooLong && (start.binder === null || change !== null),
  };
}

export type BinderDraft = ReturnType<typeof useBinderDraft>;
