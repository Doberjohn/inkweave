import type {CardType, Ink} from 'inkweave-synergy-engine';
import {rarityConfigOf} from './rarity';

/** A card type the filters offer: the engine's types plus Song, which the filters treat as one. */
export type CardTypeFilter = CardType | 'Song';

/**
 * The picks FilterContent sets beside the toolbar's inks, types and costs. The app's
 * `CardFilterOptions` extends it with the fields only its own filtering reads, and FilterContent
 * keeps those as it finds them.
 */
export interface FilterPicks {
  /** Every picked keyword. */
  keywords?: string[];
  /** Every picked classification. */
  classifications?: string[];
  /**
   * Picked sets, ANY of them (owner, 2026-10-08: the set logos replaced a single-pick dropdown).
   * A card belongs to one set, so several widen the result, as types do.
   */
  setCodes?: string[];
  /**
   * Picked rarities, ANY of them (owner, 2026-10-08). A card has one rarity, so several widen
   * the result, as types do.
   */
  rarities?: string[];
  inkwell?: 'inkable' | 'uninkable';
  /**
   * `dual`: the DUAL-INK CARDS switch (owner, 2026-10-08), narrowing the result to dual-ink
   * cards: one ink's, or exactly one pair's. Offered only where `offersDualInk` says so.
   */
  inkMatch?: 'dual';
}

/** The values each filter button group shows: ink, cost, card type and inkwell. */
export interface FilterButtonOptions {
  inks: readonly Ink[];
  costs: readonly number[];
  types: readonly CardTypeFilter[];
  inkwell: readonly NonNullable<FilterPicks['inkwell']>[];
}

/** A set as the Set section shows it: picked by code, named, and ordered by number. */
export interface FilterSet {
  code: string;
  name: string;
  number: number;
}

/**
 * A shortcut under the rarities that picks one kind of them (owner, 2026-10-15), as picking them
 * one by one would.
 */
export interface ArtPreset {
  value: string;
  label: string;
  /** The chip's tooltip, naming what it picks. */
  title: string;
  /** The offered rarities it picks. */
  rarities: readonly string[];
}

/** The app's words and rules that FilterContent shows, passed as its `vocabulary`. */
export interface FilterVocabulary {
  /** The button values a page shows when it doesn't narrow them (`buttonOptions`). */
  allButtons: FilterButtonOptions;
  /** A set's logo, or undefined where it has none, which shows its name instead. */
  setLogo: (code: string) => string | undefined;
  /** What the filters call a rarity: the app's says Promo for Special (#805). */
  rarityLabel: (rarity: string) => string;
  /** The art presets for the offered rarities, each with the rarities it picks. */
  artPresets: (offered: readonly string[]) => readonly ArtPreset[];
  /** Whether a selection of this many inks offers the Dual-ink cards switch. */
  offersDualInk: (inkCount: number) => boolean;
}

/** Whether the picks are exactly these rarities, in any order. */
export function picksExactly(picked: readonly string[], rarities: readonly string[]): boolean {
  return picked.length === rarities.length && rarities.every((rarity) => picked.includes(rarity));
}

/**
 * Whether every preset picks something of the offered rarities, the only time the presets mean
 * anything: a pool without printings has no Alt art cards to pick.
 */
export const offersEveryKind = (presets: readonly ArtPreset[]) =>
  presets.length > 0 && presets.every((preset) => preset.rarities.length > 0);

/** The list with `value` added, or removed if it was there: a toggle chip pressed. */
export const toggledIn = <T,>(values: readonly T[], value: T): T[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

/** A pick is empty, and left out rather than kept, when it is unset, a blank string or an empty list. */
const isEmptyPick = (value: unknown) => value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** The picks with one of them set, or left out when it is empty, so an empty pick never reaches a link. */
export function withOption<K extends keyof FilterPicks>(filters: FilterPicks, key: K, value: FilterPicks[K]): FilterPicks {
  const next = {...filters};
  if (isEmptyPick(value)) delete next[key];
  else next[key] = value;
  return next;
}

/**
 * Which line a rarity's chip sits on: the five card rarities, Common to Legendary, on the top
 * line, and the printings below, Epic, Enchanted, Iconic and Promo (owner, 2026-10-17). It was
 * four to a line, Legendary leading the special printings (2026-10-08), until the promo symbol
 * made that line five. Undefined for a pool without printings (the card page's synergy
 * filters), which is one line either way.
 */
export function rarityLines(rarities: readonly string[]): ((rarity: string) => string) | undefined {
  if (rarities.every((rarity) => rarityConfigOf(rarity))) return undefined;
  return (rarity) => (rarityConfigOf(rarity) ? 'cards' : 'printings');
}
