import type {PlaystyleId} from 'inkweave-synergy-engine';
import {hexToRgb} from './theme';

export interface PlaystyleUiMeta {
  accentColor: string;
  /** CSS rgb components for rgba() usage, e.g. "239, 68, 68" */
  accentRgb: string;
  coverArt: string;
}

function makeUiMeta(accentColor: string, coverArt: string): PlaystyleUiMeta {
  return {accentColor, accentRgb: hexToRgb(accentColor), coverArt};
}

/** Presentational metadata for registered playstyles (active in the engine). */
export const PLAYSTYLE_UI: Record<PlaystyleId, PlaystyleUiMeta> = {
  'lore-denial': makeUiMeta('#ef4444', '/art/playstyles/lore-denial-cover.webp'),
  'location-control': makeUiMeta('#71717a', '/art/playstyles/location-control-cover.webp'),
  discard: makeUiMeta('#10b981', '/art/playstyles/discard.webp'),
  ramp: makeUiMeta('#3b82f6', '/art/playstyles/ramp.webp'),
  toy: makeUiMeta('#f59e0b', '/art/playstyles/toy.webp'),
  // Art asset sacrifice.webp (670x500 webp) is provided separately; drop it in apps/web/public/art/playstyles/.
  sacrifice: makeUiMeta('#10b981', '/art/playstyles/sacrifice.webp'),
  dwarfs: makeUiMeta('#8b5cf6', '/art/playstyles/dwarf.webp'),
};

export interface ComingSoonPlaystyle extends PlaystyleUiMeta {
  name: string;
  description: string;
}

function makeComingSoon(
  name: string,
  description: string,
  accentColor: string,
  coverArt: string,
): ComingSoonPlaystyle {
  return {name, description, ...makeUiMeta(accentColor, coverArt)};
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
