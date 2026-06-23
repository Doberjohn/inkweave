import type {LorcanaCard} from '../types/card.js';
import {
  normalizeCardText,
  getLoreDenialRoles,
  getDiscardRoles,
  getRampRoles,
  DRAW_PATTERN,
} from './cardHelpers.js';

/**
 * A generic, cross-playstyle game mechanic. These recur on cards across many
 * playstyles (card draw, lore burn, discard, ramp, …), so they live in ONE
 * catalog rather than being re-detected and re-labeled per playstyle.
 *
 * `detect` is the single source of truth for "does this card exhibit the
 * mechanic" — it either delegates to an existing role detector or runs a
 * canonical regex. The catalog drives the display tiles (RoleTileRow); scoring
 * continues to use each rule's own structural roles (see MECHANICS_TAXONOMY.md).
 */
export interface Mechanic {
  id: string;
  label: string;
  description: string;
  detect: (card: LorcanaCard) => boolean;
}

/** Lore boost — give a character +◊ (lore) for the turn, e.g. Sneezy - Startlingly Loud. */
const LORE_BUFF_PATTERN = /gets?\s*\+\d+\s*◊/i;

/** Stat boost — give +¤ (strength) or +⛉ (willpower). */
const STAT_BUFF_PATTERN = /gets?\s*\+\d+\s*[¤⛉]/i;

/**
 * Keyword grant — give a named keyword (Rush, Evasive, …). The explicit keyword
 * list (rather than a bare `gains \w+`) keeps "gain N lore" / "gains lore" out.
 */
const KEYWORD_GRANT_PATTERN =
  /gains?\s+(Rush|Evasive|Bodyguard|Ward|Resist|Challenger|Reckless|Support|Singer)\b/i;

/** Test a regex against a card's newline-normalized text. */
const matchesText = (card: LorcanaCard, re: RegExp): boolean =>
  card.text != null && re.test(normalizeCardText(card));

/**
 * The generic mechanics catalog — the single source of truth for cross-playstyle
 * mechanics. The first nine delegate to existing role detectors (no duplicated
 * regex); the last three are new gap-fillers validated against the live database.
 *
 * Adding a mechanic = one entry here; it auto-applies to every playstyle's tiles.
 */
export const MECHANICS: Mechanic[] = [
  {
    id: 'draw',
    label: 'Card Draw',
    description: 'Draw extra cards',
    detect: (c) => matchesText(c, DRAW_PATTERN),
  },
  {
    id: 'lore-burn',
    label: 'Lore Burn',
    description: 'Make your opponents lose lore',
    detect: (c) => getLoreDenialRoles(c).includes('burn'),
  },
  {
    id: 'lore-steal',
    label: 'Lore Steal',
    description: 'Opponents lose lore and you gain it',
    detect: (c) => getLoreDenialRoles(c).includes('steal'),
  },
  {
    id: 'discard-targeted',
    label: 'Targeted Discard',
    description: 'Choose which card type the opponent discards',
    detect: (c) => getDiscardRoles(c).includes('targeted'),
  },
  {
    id: 'discard-random',
    label: 'Random Discard',
    description: 'Force opponents to discard at random',
    detect: (c) => getDiscardRoles(c).includes('random'),
  },
  {
    id: 'discard-forced',
    label: 'Forced Discard',
    description: 'Force opponents to choose and discard',
    detect: (c) => getDiscardRoles(c).includes('standard'),
  },
  {
    id: 'inkwell-ramp',
    label: 'Ink Ramp',
    description: 'Put extra cards into your inkwell',
    detect: (c) => getRampRoles(c).includes('inkwell-ramp'),
  },
  {
    id: 'inkwell-trigger',
    label: 'Ink Trigger',
    description: 'Trigger an effect on inkwell events',
    detect: (c) => getRampRoles(c).includes('inkwell-trigger'),
  },
  {
    id: 'cost-reduction',
    label: 'Cost Reduction',
    description: 'Reduce the cost of other cards you play',
    detect: (c) => getRampRoles(c).includes('cost-reduction'),
  },
  {
    id: 'lore-buff',
    label: 'Lore Boost',
    description: 'Give a character +◊ for the turn',
    detect: (c) => matchesText(c, LORE_BUFF_PATTERN),
  },
  {
    id: 'stat-buff',
    label: 'Stat Boost',
    description: 'Give a character +¤ or +⛉',
    detect: (c) => matchesText(c, STAT_BUFF_PATTERN),
  },
  {
    id: 'keyword-grant',
    label: 'Keyword Grant',
    description: 'Grant a keyword like Rush or Evasive',
    detect: (c) => matchesText(c, KEYWORD_GRANT_PATTERN),
  },
];

/** Lookup a mechanic by id. */
export const MECHANIC_BY_ID: Record<string, Mechanic> = Object.fromEntries(
  MECHANICS.map((m) => [m.id, m]),
);

/**
 * Return the ids of every generic mechanic a card exhibits, in catalog order.
 * Deterministic and side-effect free — safe to call in the engine loop.
 */
export function getCardMechanics(card: LorcanaCard): string[] {
  if (card.text == null || card.text === '') return [];
  return MECHANICS.filter((m) => m.detect(card)).map((m) => m.id);
}
