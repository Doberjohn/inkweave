import type {PlaystyleId} from 'inkweave-synergy-engine';
import {hexToRgb, INK_COLORS} from './theme';

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

/** Compose an alpha color from a playstyle's `accentRgb` ("r, g, b") — the dynamic-accent sibling of hexRgba (#511). */
export const accentRgba = (accentRgb: string, a: number) => `rgba(${accentRgb}, ${a})`;

/**
 * Presentational metadata for registered playstyles. accentColor is the hero
 * card's ink colour (INK_COLORS[color].border); see the Hero cards table in
 * docs/superpowers/specs/2026-07-01-playstyles-gallery-rebrand-design.md.
 */
export const PLAYSTYLE_UI: Record<PlaystyleId, PlaystyleUiMeta> = {
  // Mechanics
  'lore-denial': makeUiMeta(INK_COLORS.Ruby.border, 'mechanic', '2847'), // Hero Work (Ruby)
  'location-control': makeUiMeta(INK_COLORS.Ruby.border, 'mechanic', '2586'), // Elsa - Ice Artisan (Ruby)
  discard: makeUiMeta(INK_COLORS.Amber.border, 'mechanic', '2208'), // Mowgli - Man Cub (Amber)
  'self-discard': makeUiMeta(INK_COLORS.Emerald.border, 'mechanic', '3071'), // Rapunzel & Flynn Rider - Unlikely Pair (Emerald-Steel)
  ramp: makeUiMeta(INK_COLORS.Sapphire.border, 'mechanic', '2344'), // Cinderella - Dream Come True (Sapphire)
  sacrifice: makeUiMeta(INK_COLORS.Ruby.border, 'mechanic', '2841'), // Sid Phillips - Toy Surgeon (Ruby)
  // DELIBERATE off-palette accent (2026-07-22 ruling): sky-blue distinguishes
  // Items from the three true-Sapphire playstyles above/below; it is the only
  // accent not drawn from INK_COLORS borders.
  items: makeUiMeta('#0ea5e9', 'mechanic', '2860'), // Gadget Hackwrench - Resourceful Mechanic (Sapphire)
  healing: makeUiMeta(INK_COLORS.Sapphire.border, 'mechanic', '2086'), // Grand Pabbie - Oldest and Wisest (Sapphire)
  exert: makeUiMeta(INK_COLORS.Amethyst.border, 'mechanic', '2244'), // Demona - Scourge of the Wyvern Clan (Amethyst)
  bounce: makeUiMeta(INK_COLORS.Amethyst.border, 'mechanic', '2500'), // Tigger - Bouncing All the Way (Amethyst)
  // Tribes
  toy: makeUiMeta(INK_COLORS.Amber.border, 'tribe', '2730'), // Woody - Jungle Guide (Amber)
  dwarfs: makeUiMeta(INK_COLORS.Amethyst.border, 'tribe', '2752'), // Snow White - Merry as the Morning (Amethyst)
  floodborn: makeUiMeta(INK_COLORS.Steel.border, 'tribe', '3168'), // The Vine - Towering Stalk (Steel)
  hunny: makeUiMeta(INK_COLORS.Amethyst.border, 'tribe', '1977'), // Winnie the Pooh - Hunny Wizard (Amethyst)
  'red-panda': makeUiMeta(INK_COLORS.Ruby.border, 'tribe', '3096'), // Meilin Lee - Popular Red Panda (Ruby)
  monster: makeUiMeta(INK_COLORS.Amber.border, 'tribe', '2995'), // Sulley - The New Boss (Amber)
  princess: makeUiMeta(INK_COLORS.Emerald.border, 'tribe', '2532'), // Mulan - Resourceful Recruit (Emerald)
  hero: makeUiMeta(INK_COLORS.Steel.border, 'tribe', '2655'), // Darkwing Duck - Cool Under Pressure (Steel)
  super: makeUiMeta(INK_COLORS.Amethyst.border, 'tribe', '2774'), // Frozone - Super Cool (Amethyst)
  royalty: makeUiMeta(INK_COLORS.Amethyst.border, 'tribe', '1979'), // Elsa - Spirit of Winter (Amethyst)
  detective: makeUiMeta(INK_COLORS.Sapphire.border, 'tribe', '2345'), // Judy Hopps - Uncovering Clues (Sapphire)
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
  makeComingSoon('Zombies', INK_COLORS.Amber.border),
  makeComingSoon('Villains', INK_COLORS.Sapphire.border),
  makeComingSoon('Madrigals', INK_COLORS.Amethyst.border),
];
