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
  'lore-denial': makeUiMeta('#ef4444', '/art/playstyles/lore-denial-cover.png'),
  'location-control': makeUiMeta('#71717a', '/art/playstyles/location-control-cover.png'),
};

export interface ComingSoonPlaystyle extends PlaystyleUiMeta {
  name: string;
  description: string;
}

function makeComingSoon(name: string, description: string, accentColor: string, coverArt: string): ComingSoonPlaystyle {
  return {name, description, ...makeUiMeta(accentColor, coverArt)};
}

/** Playstyles that are planned but not yet implemented in the engine. */
export const COMING_SOON_PLAYSTYLES: ComingSoonPlaystyle[] = [
  makeComingSoon(
    'Discard',
    'Force opponents to discard cards while benefiting from discard triggers and payoffs. Control the hand advantage to dominate the game.',
    '#10b981',
    '/art/playstyles/discard.png',
  ),
  makeComingSoon(
    'Bounce',
    'Return characters to hand to retrigger enter-the-battlefield effects. Tempo advantage through repeated value generation.',
    '#8b5cf6',
    '/art/playstyles/bounce.png',
  ),
  makeComingSoon(
    'Ramp',
    'Accelerate ink production to play high-cost threats ahead of curve. Ink ramp enablers paired with powerful late-game finishers.',
    '#3b82f6',
    '/art/playstyles/ramp.png',
  ),
  makeComingSoon(
    'Zombies',
    'Return characters from the discard pile back to your hand or play them for free. Outlast opponents by recycling your best threats over and over.',
    '#f59e0b',
    '/art/playstyles/zombies.png',
  ),
  makeComingSoon(
    'Exert',
    'Force opponent characters into exerted position through abilities and actions. Lock down threats by keeping them tapped and vulnerable.',
    '#8b5cf6',
    '/art/playstyles/exert.png',
  ),
];
