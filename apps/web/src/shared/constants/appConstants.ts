import type {CardTypeFilter} from 'inkweave-ui/lib/filterModel';

// App branding
export const APP_NAME = 'Inkweave';

// Known set codes
export type SetCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14';

// Set abbreviations (keyed by setCode)
export const SET_ABBREVIATIONS: Record<SetCode, string> = {
  '1': '1TFC',
  '2': '2ROF',
  '3': '3INK',
  '4': '4URS',
  '5': '5SSK',
  '6': '6AZS',
  '7': '7ARI',
  '8': '8JAF',
  '9': '9FAB',
  '10': '10WHI',
  '11': '11WSP',
  '12': '12WIL',
  '13': '13AVN',
  '14': '14HYP',
} as const;

// Set full names (keyed by setCode)
export const SET_NAMES: Record<SetCode, string> = {
  '1': 'The First Chapter',
  '2': 'Rise of the Floodborn',
  '3': 'Into the Inklands',
  '4': "Ursula's Return",
  '5': 'Shimmering Skies',
  '6': 'Azurite Sea',
  '7': "Archazia's Island",
  '8': 'The Reign of Jafar',
  '9': 'Fabled',
  '10': 'Whispers in the Well',
  '11': 'Winterspell',
  '12': 'The Wilds Unknown',
  '13': 'Attack of the Vine!',
  '14': 'Hyperia City',
} as const;

// Below this viewport width the inline cost-filter group (the widest inline
// toolbar control at ~482px) tucks into the Filters dialog so the toolbar stays
// one row alongside the 300px search box; ink + inkable icons are compact enough
// to remain. Math: Filters(86) + search(300) + full icon group(1106) + gaps +
// side padding needs ~1580px for one row; dropping cost frees ~493px → fits ~1075px.
export const INLINE_COST_FILTER_MIN_WIDTH = 1580;

// Card type filter options (includes "Song" pseudo-type for UI filtering)
export type {CardTypeFilter};
export const CARD_TYPE_FILTERS: CardTypeFilter[] = [
  'Character',
  'Action',
  'Song',
  'Item',
  'Location',
];

// Browse sort order
// ── Sort orders ──
// Labels are words, never arrows: an <option> can't hide part of its text, and screen
// readers would read "right arrow" in every name (#835).

export type BrowseSortOrder =
  | 'ink-cost'
  | 'newest'
  | 'name-asc'
  | 'name-desc'
  | 'cost-asc'
  | 'cost-desc';

export type SynergySortOrder =
  | 'ink-cost'
  | 'cost-asc'
  | 'cost-desc'
  | 'strength-desc'
  | 'strength-asc'
  | 'name-asc'
  | 'name-desc';

export const BROWSE_SORT_OPTIONS: {
  value: BrowseSortOrder;
  label: string;
  mobileLabel?: string;
}[] = [
  {value: 'ink-cost', label: 'Color, then Cost', mobileLabel: 'Color/Cost'},
  {value: 'newest', label: 'Newest first', mobileLabel: 'Newest'},
  {value: 'name-asc', label: 'Name A\u2013Z', mobileLabel: 'A\u2013Z'},
  {value: 'name-desc', label: 'Name Z\u2013A', mobileLabel: 'Z\u2013A'},
  {value: 'cost-asc', label: 'Cost: Low to High', mobileLabel: 'Low cost'},
  {value: 'cost-desc', label: 'Cost: High to Low', mobileLabel: 'High cost'},
];

export const SYNERGY_SORT_OPTIONS: {
  value: SynergySortOrder;
  label: string;
  mobileLabel?: string;
}[] = [
  {value: 'ink-cost', label: 'Color, then Cost', mobileLabel: 'Color/Cost'},
  {value: 'cost-asc', label: 'Cost: Low to High', mobileLabel: 'Low cost'},
  {value: 'cost-desc', label: 'Cost: High to Low', mobileLabel: 'High cost'},
  {value: 'strength-desc', label: 'Score: High to Low', mobileLabel: 'High score'},
  {value: 'strength-asc', label: 'Score: Low to High', mobileLabel: 'Low score'},
  {value: 'name-asc', label: 'Name A\u2013Z', mobileLabel: 'A\u2013Z'},
  {value: 'name-desc', label: 'Name Z\u2013A', mobileLabel: 'Z\u2013A'},
];
