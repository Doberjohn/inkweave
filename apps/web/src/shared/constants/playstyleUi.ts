import type {PlaystyleId} from 'inkweave-synergy-engine';
import {hexToRgb} from './theme';

export interface PlaystyleUiMeta {
  /** The hero card's ink colour (from INK_COLORS[color].border). */
  accentColor: string;
  /** Same ink colour as rgb components for rgba(), e.g. "239, 68, 68". */
  accentRgb: string;
  /** Gallery grouping: strategy mechanics vs creature-type tribes. */
  kind: 'mechanic' | 'tribe';
  /** Curated centre card of the gallery fan (a LorcanaCard id); its ink sets accentColor/accentRgb. */
  heroCardId: string;
}

function makeUiMeta(
  accentColor: string,
  kind: PlaystyleUiMeta['kind'],
  heroCardId: string,
): PlaystyleUiMeta {
  return {accentColor, accentRgb: hexToRgb(accentColor), kind, heroCardId};
}

/**
 * Presentational metadata for registered playstyles. accentColor is the hero
 * card's ink colour (INK_COLORS[color].border); see the Hero cards table in
 * docs/superpowers/specs/2026-07-01-playstyles-gallery-rebrand-design.md.
 */
export const PLAYSTYLE_UI: Record<PlaystyleId, PlaystyleUiMeta> = {
  // Mechanics
  'lore-denial': makeUiMeta('#ef4444', 'mechanic', '2847'), // Hero Work (Ruby)
  'location-control': makeUiMeta('#ef4444', 'mechanic', '2586'), // Elsa - Ice Artisan (Ruby)
  discard: makeUiMeta('#f59e0b', 'mechanic', '2208'), // Mowgli - Man Cub (Amber)
  'self-discard': makeUiMeta('#10b981', 'mechanic', '13100'), // Rapunzel & Flynn Rider - Unlikely Pair (Emerald-Steel)
  ramp: makeUiMeta('#3b82f6', 'mechanic', '2344'), // Cinderella - Dream Come True (Sapphire)
  sacrifice: makeUiMeta('#ef4444', 'mechanic', '2841'), // Sid Phillips - Toy Surgeon (Ruby)
  // Tribes
  toy: makeUiMeta('#f59e0b', 'tribe', '2730'), // Woody - Jungle Guide (Amber)
  dwarfs: makeUiMeta('#8b5cf6', 'tribe', '2752'), // Snow White - Merry as the Morning (Amethyst)
  floodborn: makeUiMeta('#6b7280', 'tribe', '13197'), // The Vine - Towering Stalk (Steel)
  hunny: makeUiMeta('#8b5cf6', 'tribe', '1977'), // Winnie the Pooh - Hunny Wizard (Amethyst)
  'red-panda': makeUiMeta('#ef4444', 'tribe', '13125'), // Meilin Lee - Popular Red Panda (Ruby)
};

export interface ComingSoonPlaystyle {
  name: string;
  accentColor: string;
  accentRgb: string;
}

function makeComingSoon(name: string, accentColor: string): ComingSoonPlaystyle {
  return {name, accentColor, accentRgb: hexToRgb(accentColor)};
}

/** Playstyles that are planned but not yet implemented in the engine. */
export const COMING_SOON_PLAYSTYLES: ComingSoonPlaystyle[] = [
  makeComingSoon('Bounce', '#8b5cf6'),
  makeComingSoon('Zombies', '#f59e0b'),
  makeComingSoon('Exert', '#8b5cf6'),
  makeComingSoon('Villains', '#3b82f6'),
  makeComingSoon('Princesses', '#f59e0b'),
  makeComingSoon('Madrigals', '#8b5cf6'),
  makeComingSoon('Supers', '#ef4444'),
];
