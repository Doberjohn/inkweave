import type {PlaystyleId} from 'inkweave-synergy-engine';
import {hexToRgb} from './theme';

export interface PlaystyleUiMeta {
  /** The hero card's ink colour (from INK_COLORS[color].border). */
  accentColor: string;
  /** Same ink colour as rgb components for rgba(), e.g. "239, 68, 68". */
  accentRgb: string;
  /** Detail-page Ken Burns background; falls back to an accent gradient if the asset is missing. */
  coverArt: string;
  /** Gallery grouping: strategy mechanics vs creature-type tribes. */
  kind: 'mechanic' | 'tribe';
  /** Curated centre card of the gallery fan (a LorcanaCard id); its ink sets accentColor/accentRgb. */
  heroCardId: string;
}

function makeUiMeta(
  accentColor: string,
  coverArt: string,
  kind: PlaystyleUiMeta['kind'],
  heroCardId: string,
): PlaystyleUiMeta {
  return {accentColor, accentRgb: hexToRgb(accentColor), coverArt, kind, heroCardId};
}

/**
 * Presentational metadata for registered playstyles. accentColor is the hero
 * card's ink colour (INK_COLORS[color].border); see the Hero cards table in
 * docs/superpowers/specs/2026-07-01-playstyles-gallery-rebrand-design.md.
 */
export const PLAYSTYLE_UI: Record<PlaystyleId, PlaystyleUiMeta> = {
  // Mechanics
  'lore-denial': makeUiMeta('#ef4444', '/art/playstyles/lore-denial-cover.webp', 'mechanic', '2847'), // Hero Work (Ruby)
  'location-control': makeUiMeta('#ef4444', '/art/playstyles/location-control-cover.webp', 'mechanic', '2586'), // Elsa - Ice Artisan (Ruby)
  discard: makeUiMeta('#f59e0b', '/art/playstyles/discard.webp', 'mechanic', '2208'), // Mowgli - Man Cub (Amber)
  ramp: makeUiMeta('#3b82f6', '/art/playstyles/ramp.webp', 'mechanic', '2344'), // Cinderella - Dream Come True (Sapphire)
  sacrifice: makeUiMeta('#ef4444', '/art/playstyles/sacrifice.webp', 'mechanic', '2841'), // Sid Phillips - Toy Surgeon (Ruby)
  // Tribes
  toy: makeUiMeta('#f59e0b', '/art/playstyles/toy.webp', 'tribe', '2730'), // Woody - Jungle Guide (Amber)
  dwarfs: makeUiMeta('#8b5cf6', '/art/playstyles/dwarf.webp', 'tribe', '2752'), // Snow White - Merry as the Morning (Amethyst)
  // Set 13 tribes. Cover art assets (floodborn/hunny/red-panda .webp) are pending;
  // the detail hero falls back to an accent gradient until they are dropped in apps/web/public/art/playstyles/.
  floodborn: makeUiMeta('#6b7280', '/art/playstyles/floodborn.webp', 'tribe', '13197'), // The Vine - Towering Stalk (Steel)
  hunny: makeUiMeta('#8b5cf6', '/art/playstyles/hunny.webp', 'tribe', '1977'), // Winnie the Pooh - Hunny Wizard (Amethyst)
  'red-panda': makeUiMeta('#ef4444', '/art/playstyles/red-panda.webp', 'tribe', '13125'), // Meilin Lee - Popular Red Panda (Ruby)
};

export interface ComingSoonPlaystyle {
  name: string;
  description: string;
  accentColor: string;
  accentRgb: string;
  coverArt: string;
}

function makeComingSoon(
  name: string,
  description: string,
  accentColor: string,
  coverArt: string,
): ComingSoonPlaystyle {
  return {name, description, accentColor, accentRgb: hexToRgb(accentColor), coverArt};
}

/** Playstyles that are planned but not yet implemented in the engine. */
export const COMING_SOON_PLAYSTYLES: ComingSoonPlaystyle[] = [
  makeComingSoon(
    'Bounce',
    'Return characters to hand to retrigger enter-the-battlefield effects. Tempo advantage through repeated value generation.',
    '#8b5cf6',
    '/art/playstyles/bounce.webp',
  ),
  makeComingSoon(
    'Zombies',
    'Return characters from the discard pile back to your hand or play them for free. Outlast opponents by recycling your best threats over and over.',
    '#f59e0b',
    '/art/playstyles/zombies.webp',
  ),
  makeComingSoon(
    'Exert',
    'Force opponent characters into exerted position through abilities and actions. Lock down threats by keeping them tapped and vulnerable.',
    '#8b5cf6',
    '/art/playstyles/exert.webp',
  ),
  makeComingSoon(
    'Villains',
    'Villain characters and the cards that reward running them. Named-companion plays bring more Villains onto the board, stat-scaling abilities reward filling it, and several Villain-only effects punish opponent plays. The team grows stronger with every Villain you add.',
    '#3b82f6',
    '/art/playstyles/villain.webp',
  ),
  makeComingSoon(
    'Princesses',
    'Princess characters and the cards that reward running them. Princesses scale with team size, gain stat boosts when other Princesses are around, and unlock Princess-only effects that turn a full lineup into consistent lore. Each Princess you add makes the others stronger.',
    '#f59e0b',
    '/art/playstyles/princess.webp',
  ),
  makeComingSoon(
    'Madrigals',
    "Madrigal characters and the cards that reward running them. Each family member brings a different ability, and Madrigal-specific effects link them into a chain of triggers each turn. A full Madrigal lineup turns the family's variety into consistent extra value.",
    '#8b5cf6',
    '/art/playstyles/madrigal.webp',
  ),
  makeComingSoon(
    'Supers',
    'Super characters and the cards that reward running them. Each Super gains stat boosts when other Supers are around, search effects pull more onto the board, and team-only abilities reward fielding the whole family at once. A full Super team quests fast and challenges aggressively.',
    '#ef4444',
    '/art/playstyles/super.webp',
  ),
];
