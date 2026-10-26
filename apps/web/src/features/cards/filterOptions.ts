import {
  picksExactly,
  type ArtPreset,
  type FilterButtonOptions,
  type FilterVocabulary,
} from 'inkweave-ui/lib/filterModel';
import {
  ALL_INKS,
  CARD_TYPE_FILTERS,
  COST_BUTTONS,
  SET_LOGOS,
  type CardTypeFilter,
} from '../../shared/constants';
import {
  PROMO_RARITY,
  RARITIES_BY_ART,
  anyCardMatches,
  offersDualOnly,
  type ArtKind,
  type CardFilterOptions,
  type SetInfo,
} from './loader';
import type {Ink, LorcanaCard} from './types';

export type {FilterButtonOptions};

/**
 * The art presets, in the panel's order (owner, 2026-10-15): shortcuts that pick one
 * kind's rarities (`RARITIES_BY_ART`), as picking them one by one would. Each preset's
 * label, which the toolbar's chip for it repeats, and its tooltip, which names what it picks
 * of the rarities the page offers.
 */
export const ART_OPTIONS: readonly {value: ArtKind; label: string; title: (picks: readonly string[]) => string}[] = [
  {value: 'standard', label: 'Standard cards', title: () => 'Pick the five standard rarities'},
  {value: 'alt', label: 'Alt art cards', title: (picks) => `Pick ${inWords(picks.map(rarityLabel))}`},
];

/** Names as a sentence runs them: "Epic, Enchanted and Iconic". */
function inWords(names: readonly string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * What the filters call a rarity: its own name, but Promo for Special, the rarity
 * LorcanaJSON gives every promo printing (#805). The Rarity section's chip and summary
 * and the toolbar's chip all say it.
 */
export function rarityLabel(rarity: string): string {
  return rarity === PROMO_RARITY ? 'Promo' : rarity;
}

/**
 * The offered rarities of one kind, in the offered order: what its preset picks. Where no
 * Special is offered, the Alt art kind is the three chase rarities.
 */
export const raritiesOfKind = (offered: readonly string[], kind: ArtKind) =>
  offered.filter((rarity) => RARITIES_BY_ART[kind].includes(rarity));

/**
 * The art preset the picked rarities amount to, if they are exactly one kind's: of the
 * `offered` rarities when the page says which, as its preset picks them, else all of it.
 */
export function artPresetOf(picked: readonly string[], offered?: readonly string[]) {
  return ART_OPTIONS.find(({value}) => {
    const kind = offered ? raritiesOfKind(offered, value) : RARITIES_BY_ART[value];
    return kind.length > 0 && picksExactly(picked, kind);
  });
}

/** The lists behind the filter dialog's Keyword, Classification, Rarity and Set sections. */
export interface FilterSelectOptions {
  keywords: string[];
  classifications: string[];
  rarities: string[];
  sets: SetInfo[];
}

/** Every filter option a page offers: the button groups plus the dropdowns. */
export interface FilterOptions extends FilterSelectOptions {
  buttons: FilterButtonOptions;
}

/** The filters a page has applied: the toolbar's toggles plus the dialog's other fields. */
export interface AppliedFilters {
  inks: Ink[];
  types: CardTypeFilter[];
  costs: number[];
  filters: CardFilterOptions;
}

export const ALL_FILTER_BUTTONS: FilterButtonOptions = {
  inks: ALL_INKS,
  costs: COST_BUTTONS,
  types: CARD_TYPE_FILTERS,
  inkwell: ['inkable', 'uninkable'],
};

/** Each art preset with what it picks of the offered rarities, and its tooltip saying so. */
export const artPresetsFor = (offered: readonly string[]): ArtPreset[] =>
  ART_OPTIONS.map(({value, label, title}) => {
    const rarities = raritiesOfKind(offered, value);
    return {value, label, title: title(rarities), rarities};
  });

/** The app's words and rules for inkweave-ui's FilterContent (#981). */
export const FILTER_VOCABULARY: FilterVocabulary = {
  allButtons: ALL_FILTER_BUTTONS,
  setLogo: (code) => SET_LOGOS[code],
  rarityLabel,
  artPresets: artPresetsFor,
  offersDualInk: offersDualOnly,
};

// A value stays when it matches a card in the pool, or when it is already applied, so an
// active filter (from a shared link, say) never disappears from the control that clears it.
function keepOffered<T>(
  values: readonly T[],
  applied: readonly T[],
  matches: (value: T) => boolean,
): T[] {
  return values.filter((value) => applied.includes(value) || matches(value));
}

function listOf<T>(value: T | undefined): T[] {
  return value === undefined ? [] : [value];
}

/**
 * Narrows the filter options to the values a fixed card pool (a playstyle's cards) can
 * match, so no option on its own empties the grid. `all` holds the site-wide dropdown
 * lists the pool narrows. The toolbar dims the button values left out rather than drop
 * them, so it keeps one size. An empty pool means its cards are still loading: every
 * option stays on until they arrive.
 */
export function getPoolFilterOptions(
  cards: LorcanaCard[],
  applied: AppliedFilters,
  all: FilterSelectOptions,
): FilterOptions {
  if (cards.length === 0) return {...all, buttons: ALL_FILTER_BUTTONS};
  const matches = (options: CardFilterOptions) => anyCardMatches(cards, options);
  const {filters} = applied;
  const {inks, costs, types, inkwell} = ALL_FILTER_BUTTONS;
  return {
    buttons: {
      inks: keepOffered(inks, applied.inks, (ink) => matches({ink: [ink]})),
      costs: keepOffered(costs, applied.costs, (cost) => matches({costs: [cost]})),
      types: keepOffered(types, applied.types, (type) => matches({type: [type]})),
      inkwell: keepOffered(inkwell, listOf(filters.inkwell), (value) => matches({inkwell: value})),
    },
    keywords: keepOffered(all.keywords, filters.keywords ?? [], (keyword) =>
      matches({keywords: [keyword]}),
    ),
    classifications: keepOffered(all.classifications, filters.classifications ?? [], (c) =>
      matches({classifications: [c]}),
    ),
    rarities: keepOffered(all.rarities, filters.rarities ?? [], (rarity) => matches({rarities: [rarity]})),
    sets: all.sets.filter((set) => filters.setCodes?.includes(set.code) || matches({setCodes: [set.code]})),
  };
}
