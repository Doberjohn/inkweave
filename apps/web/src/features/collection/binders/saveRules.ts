import type {LorcanaCard} from 'inkweave-synergy-engine';
import {inWords, rarityLabel} from '../../cards/filterOptions';
import type {FilterDraft} from '../../../shared/hooks/useFilterParams';
import {WHOLE_COLLECTION, scopeName} from '../binderCards';
import type {CollectionEntries} from '../collectionParser';
import type {SaveOffer} from './binderChoices';
import {figuresOf, type BinderFigures} from './binderCovers';
import {
  RULES_MAX,
  draftOf,
  readRules,
  ruleLine,
  ruleParts,
  rulePool,
  scopedDraft,
  writeRules,
  type Binder,
} from './binderRules';

/*
 * Save as a binder's rules: the page's filters joined onto the binder they were picked in, and
 * the name a new binder starts from.
 */

/**
 * The params a second pick of would widen what the page shows, each kind held as one: the ink
 * and its dual-ink switch together, since inside Amber a Steel filter shows Amber-Steel cards but
 * one rule of both inks reads as a deck's colours and holds every Amber and every Steel card.
 */
const ONE_PICK_KINDS: readonly (readonly string[])[] = [['ink', 'inkmatch'], ['q'], ['inkwell'], ['cost'], ['rarity'], ['type']];

/** The params each pick of narrows, so the page's join the binder's: a card must carry them all. */
const NARROWING = ['keyword', 'classification'];

/** A param's values as a set to compare, in any order; the search by its words, any case. */
function valuesOf(params: URLSearchParams, param: string): string {
  const raw = params.get(param) ?? '';
  if (param === 'q') return raw.trim().toLowerCase();
  return raw.split(',').filter(Boolean).sort().join(',');
}

const listOf = (raw: string | null) => (raw ?? '').split(',').filter(Boolean);

/** Whether the page's pick of a kind is the binder's own, so joining it changes nothing. */
const sameKind = (binder: URLSearchParams, page: URLSearchParams, kind: readonly string[]) =>
  kind.every((param) => valuesOf(binder, param) === valuesOf(page, param));

/** The page's pick of a one-pick kind joined on, or false when the binder set that kind otherwise. */
function joinKind(joined: URLSearchParams, page: URLSearchParams, kind: readonly string[]): boolean {
  if (!kind.some((param) => page.has(param))) return true;
  if (kind.some((param) => joined.has(param))) return sameKind(joined, page, kind);
  for (const param of kind) {
    const value = page.get(param);
    if (value !== null) joined.set(param, value);
  }
  return true;
}

/**
 * The page's filters and search added to a binder's rules, written as the row stores them
 * (`writeRules`), so the binder they make holds exactly the cards on screen. Null when the page
 * picks a kind the binder's rules already set to something else, since a second pick widens it:
 * another ink or the dual-ink switch onto an ink rule, a second rarity, type, cost, inkwell or
 * search. Keywords and classifications always join: each pick narrows. My collection (null) has
 * no rules, so its join is the page's own.
 */
export function joinRules(binder: Pick<Binder, 'rules'> | null, draft: FilterDraft, query: string): string | null {
  const page = new URLSearchParams(writeRules(draft, query));
  if (binder === null) return page.toString();
  const own = draftOf(binder);
  const joined = new URLSearchParams(writeRules(own.draft, own.query));
  if (!ONE_PICK_KINDS.every((kind) => joinKind(joined, page, kind))) return null;
  for (const param of NARROWING) joinNarrowing(joined, page, param);
  const back = draftOf({rules: joined.toString()});
  return writeRules(back.draft, back.query);
}

/** Adds the page's keywords or classifications to the binder's: each one narrows, so all of them join. */
function joinNarrowing(joined: URLSearchParams, page: URLSearchParams, param: string): void {
  const values = [...new Set([...listOf(joined.get(param)), ...listOf(page.get(param))])];
  if (values.length > 0) joined.set(param, values.join(','));
}

/** Where the page stands: the binder of your own on show (null for My collection), the set picked inside it, and what its rules run over. */
export interface OfferAt {
  binder: Pick<Binder, 'rules'> | null;
  scope: string;
  pool: readonly LorcanaCard[];
  entries: CollectionEntries;
}

/** The last offer's numbers, kept while the pool, the copies and the rules stay: the docked panel asks on every render. */
let lastFigures: {at: OfferAt; rules: string; figures: BinderFigures} | null = null;

/** Whether the kept numbers count the same cards: the same pool, copies, Sets and rules. */
const sameAsk = (kept: NonNullable<typeof lastFigures>, at: OfferAt, rules: string) =>
  kept.at.pool === at.pool && kept.at.entries === at.entries && kept.at.scope === at.scope && kept.rules === rules;

function figuresFor(at: OfferAt, rules: string): BinderFigures {
  const kept = lastFigures;
  if (kept !== null && sameAsk(kept, at, rules)) return kept.figures;
  const figures = figuresOf(rulePool(at.pool, {scope: at.scope, rules}), at.entries, at.scope);
  lastFigures = {at, rules, figures};
  return figures;
}

/**
 * Save as a binder's offer for the page's filters and search: the new binder's Sets (the set
 * picked) and rules (`joinRules`), its line and its numbers. Null where it offers none: no
 * filter or search on, a pick that can't join the binder's rules, rules longer than the table
 * holds, or no card. A promo scope's rarity stays out, as the window keeps it out.
 */
export function saveOffer(at: OfferAt, draft: FilterDraft, query: string): SaveOffer | null {
  const scoped = scopedDraft(draft, at.scope);
  if (writeRules(scoped, query) === '') return null;
  const rules = joinRules(at.binder, scoped, query);
  if (rules === null || rules.length > RULES_MAX) return null;
  const figures = figuresFor(at, rules);
  if (figures.cards === 0) return null;
  return {scope: at.scope, rules, line: ruleLine({scope: at.scope, rules}), figures};
}

/** The most letters a name holds (`binderName.ts`). */
const NAME_MAX = 30;

/** Where a name may be cut: before a space or a comma. */
const BREAK = /[\s,]/;

/** What a cut name may not end on: a comma, a space, or a dangling "and". */
const LOOSE_END = /(?:[\s,]+|\s+and)$/;

/** A name of up to 30 letters, cut before the word that would pass them, never inside one. */
function cutAtWord(name: string): string {
  const letters = [...name];
  if (letters.length <= NAME_MAX) return name;
  let end = NAME_MAX;
  while (end > 0 && !BREAK.test(letters[end])) end--;
  const cut = letters.slice(0, end > 0 ? end : NAME_MAX).join('');
  let trimmed = cut;
  while (LOOSE_END.test(trimmed)) trimmed = trimmed.replace(LOOSE_END, '');
  return trimmed || cut;
}

/**
 * A name for a new binder from its first rule: its inks ("Amber", "Amber and Steel"), else its
 * rarities ("Epic"), types, classifications ("Princess"), keywords, or search ("Stitch"), else
 * its Sets unless every set, else its first rule as its line reads it ("Cost 3"). Cut at a word
 * to 30 letters; the player can change it.
 */
export function suggestName(binder: Pick<Binder, 'scope' | 'rules'>): string {
  const {inkFilters, typeFilters, filters, searchQuery} = readRules(binder);
  const candidates = [
    inWords(inkFilters),
    inWords((filters.rarities ?? []).map(rarityLabel)),
    inWords(typeFilters),
    inWords(filters.classifications ?? []),
    inWords(filters.keywords ?? []),
    searchQuery.trim(),
    binder.scope === WHOLE_COLLECTION ? '' : scopeName(binder.scope),
    ruleParts(binder)[0] ?? '',
  ];
  return cutAtWord(candidates.find((words) => words !== '') ?? 'New binder');
}
