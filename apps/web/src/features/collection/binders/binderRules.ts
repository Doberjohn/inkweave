import type {LorcanaCard} from 'inkweave-synergy-engine';
import {applyFilters, buildCombinedFilters} from '../../cards/applyFilters';
import {rarityLabel} from '../../cards/filterOptions';
import {binderSetOf} from '../../../shared/constants';
import {
  RULE_PARAMS,
  dropDualOnlyWhenNotOffered,
  readFilterParams,
  writeFilterParams,
  type FilterDraft,
  type FilterReads,
} from '../../../shared/hooks/useFilterParams';
import {WHOLE_COLLECTION, binderFilters, isPromoScope, scopeName, scopeSets} from '../binderCards';

/** A binder of the player's own, as its row holds it. */
export interface Binder {
  id: string;
  name: string;
  /** Its Sets: `WHOLE_COLLECTION`, `ALL_PROMO_SETS` or one set's code. */
  scope: string;
  /** The filter params, as the address writes them: "ink=Amber&rarity=Epic". */
  rules: string;
  coverId: string | null;
  place: number;
}

/**
 * Its rules as the page reads its filters (`readFilterParams`): `RULE_PARAMS` alone, never a set,
 * a sort or a view, and a value the app no longer knows dropped, so an old rule never fails. The
 * dual-ink switch goes where the page drops it, beside no ink or three or more, which the filter
 * ignores, so its kinds and its line never name it there.
 */
export function readRules(binder: Pick<Binder, 'rules'>): FilterReads {
  return readFilterParams(ruleParamsOf(new URLSearchParams(binder.rules)));
}

/** `RULE_PARAMS` alone, in their one order, with the dual-ink switch only where the filter heeds it. */
function ruleParamsOf(params: URLSearchParams): URLSearchParams {
  const rules = new URLSearchParams();
  for (const param of RULE_PARAMS) {
    const value = params.get(param);
    if (value !== null) rules.set(param, value);
  }
  dropDualOnlyWhenNotOffered(rules);
  return rules;
}

/**
 * Rules as the row stores them, written as Apply writes the filters (`writeFilterParams`) and
 * then kept to `RULE_PARAMS` in one fixed order, so the same rules always read the same: never
 * a set, a sort or a view. The search is kept trimmed, as the binder matches it.
 */
export function writeRules(draft: FilterDraft, query: string): string {
  const written = new URLSearchParams();
  writeFilterParams(written, draft);
  if (query.trim() !== '') written.set('q', query.trim());
  return ruleParamsOf(written).toString();
}

/**
 * The longest rules the table holds (`collection_binders_rules`). Every filter picked at once
 * writes about 930 characters, and holds no card, so only a long search could pass it.
 */
export const RULES_MAX = 1000;

/** A promo scope holds no rarity rule, as a binder of promos drops the page's (`binderFilters`). */
export const scopedDraft = (draft: FilterDraft, scope: string): FilterDraft =>
  isPromoScope(scope) ? {...draft, opts: {...draft.opts, rarities: undefined}} : draft;

/** Its rules as a filter draft, to edit them: `writeRules` gives back the same rules. */
export function draftOf(binder: Pick<Binder, 'rules'>): {draft: FilterDraft; query: string} {
  const {inkFilters, typeFilters, costFilters, filters, searchQuery} = readRules(binder);
  return {draft: {inks: inkFilters, types: typeFilters, costs: costFilters, opts: filters}, query: searchQuery};
}

/** Whether a reading holds any filter or a search. */
const holdsAny = ({searchQuery, inkFilters, typeFilters, costFilters, filters}: FilterReads) =>
  searchQuery.trim() !== '' ||
  inkFilters.length + typeFilters.length + costFilters.length > 0 ||
  Object.keys(filters).length > 0;

/** Whether its rules hold a filter or a search, beside its Sets. */
export const filtersCards = (binder: Pick<Binder, 'rules'>) => holdsAny(readRules(binder));

/**
 * The cards of `pool` it holds: its Sets' cards that its rules let through, matched as the binder
 * matches the page's filters (`binderFilters`: no set filter, and in a promo scope no rarity), so
 * a binder holds what the same filters hold with My collection open at its Sets.
 */
export function rulePool(pool: readonly LorcanaCard[], binder: Pick<Binder, 'scope' | 'rules'>): LorcanaCard[] {
  const inScope = scopeCards(pool, binder.scope);
  const rules = readRules(binder);
  if (!holdsAny(rules)) return inScope;
  const filters = binderFilters(rules.filters, isPromoScope(binder.scope));
  const combined = buildCombinedFilters(filters, rules.inkFilters, rules.typeFilters, rules.costFilters);
  return applyFilters(inScope, rules.searchQuery, combined);
}

/** The cards of a scope, in the pool's order: every card a binder can show, the promo sets', or one set's. */
function scopeCards(pool: readonly LorcanaCard[], scope: string): LorcanaCard[] {
  const inBinder = pool.filter((card) => card.setCode !== undefined);
  if (scope === WHOLE_COLLECTION) return inBinder;
  const sets = new Set(scopeSets(scope, [...new Set(inBinder.map((card) => binderSetOf(card.setCode ?? '')))]));
  return inBinder.filter((card) => sets.has(binderSetOf(card.setCode ?? '')));
}

/** Each kind of rule, in the filter panel's order, and whether a binder's reading holds it. */
const KINDS: readonly [kind: string, holds: (rules: FilterReads, scope: string) => boolean][] = [
  ['sets', (_, scope) => scope !== WHOLE_COLLECTION],
  ['ink', (rules) => rules.inkFilters.length > 0],
  ['dual', (rules) => rules.filters.inkMatch === 'dual'],
  ['inkwell', (rules) => rules.filters.inkwell !== undefined],
  ['cost', (rules) => rules.costFilters.length > 0],
  ['rarity', (rules) => (rules.filters.rarities?.length ?? 0) > 0],
  ['type', (rules) => rules.typeFilters.length > 0],
  ['keyword', (rules) => (rules.filters.keywords?.length ?? 0) > 0],
  ['classification', (rules) => (rules.filters.classifications?.length ?? 0) > 0],
  ['name', (rules) => rules.searchQuery.trim() !== ''],
];

/** Its kinds of rule in a fixed order, for analytics: "sets,ink,rarity", or "none". Never a value. */
export function ruleKinds(binder: Pick<Binder, 'scope' | 'rules'>): string {
  const rules = readRules(binder);
  const kinds = KINDS.filter(([, holds]) => holds(rules, binder.scope)).map(([kind]) => kind);
  return kinds.length > 0 ? kinds.join(',') : 'none';
}

/** Names as a sentence runs them: "Amber", "Amber and Steel", "3, 5 and 9+". */
export function inWords(names: readonly string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A cost as the filter's button reads it: 9 is "9+". */
const costWord = (cost: number) => (cost >= 9 ? `${cost}+` : String(cost));

/** The ink rule: "Amber ink", "Amber and Steel ink", or with the dual-ink switch "Amber and Steel dual-ink". */
function inkPart({inkFilters, filters}: FilterReads): string | undefined {
  if (inkFilters.length === 0) return undefined;
  return `${inWords(inkFilters)} ${filters.inkMatch === 'dual' ? 'dual-ink' : 'ink'}`;
}

/** The cost rule: "Cost 3", or "Costs 3, 5 and 9+". */
function costPart({costFilters}: FilterReads): string | undefined {
  if (costFilters.length === 0) return undefined;
  const costs = [...costFilters].sort((a, b) => a - b).map(costWord);
  return `${costs.length === 1 ? 'Cost' : 'Costs'} ${inWords(costs)}`;
}

/** A list rule by name, as its chips name it: "Epic", "Character and Item". */
const listPart = (names: readonly string[] | undefined) => (names?.length ? inWords(names) : undefined);

/**
 * The line under its name, each rule in the filter panel's order as its chips name it, then the
 * search, then its Sets unless every set: "Amber ink", "Epic", 'Name has "Stitch"', "Amber ink ·
 * Epic". A binder with no rule reads "Every card", as My collection does.
 */
export function ruleLine(binder: Pick<Binder, 'scope' | 'rules'>): string {
  const parts = ruleParts(binder);
  return parts.length > 0 ? parts.join(' · ') : 'Every card';
}

/** Each part of its line, in the line's order: the New binder window's chips. None for no rule. */
export function ruleParts(binder: Pick<Binder, 'scope' | 'rules'>): string[] {
  const rules = readRules(binder);
  const {filters, searchQuery} = rules;
  return [
    inkPart(rules),
    filters.inkwell && (filters.inkwell === 'inkable' ? 'Inkable' : 'Uninkable'),
    costPart(rules),
    listPart(filters.rarities?.map(rarityLabel)),
    listPart(rules.typeFilters),
    listPart(filters.keywords),
    listPart(filters.classifications),
    searchQuery.trim() && `Name has "${searchQuery.trim()}"`,
    binder.scope === WHOLE_COLLECTION ? undefined : scopeName(binder.scope),
  ].filter((part): part is string => typeof part === 'string' && part !== '');
}
