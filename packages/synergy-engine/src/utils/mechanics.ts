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
  /**
   * 'generic' mechanics recur across playstyles and carry a `detect` regex/role
   * check (they drive `getCardMechanics`). 'structural' mechanics are a single
   * playstyle's defining roles — detected by that rule's own `getXRoles`, so they
   * have no `detect` here; the catalog supplies only their canonical label/spec.
   * Defaults to 'generic' (detect-bearing) when omitted.
   */
  category?: 'generic' | 'structural';
  detect?: (card: LorcanaCard) => boolean;
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

/**
 * Structural mechanics — a single playstyle's defining roles. Detection stays in
 * the rule's own `getXRoles` (and feeds scoring); the catalog owns ONE canonical
 * label/description per id so every playstyle's tiles read identically. See
 * MECHANICS_TAXONOMY.md.
 */
export const STRUCTURAL_MECHANICS: Mechanic[] = [
  // Discard
  {id: 'payoff', category: 'structural', label: 'Payoff', description: 'Get benefits for having more cards in hand than opponents'},
  // Sacrifice
  {id: 'self-banish', category: 'structural', label: 'Self-Banish', description: 'Banish your own characters on demand'},
  {id: 'banish-trigger', category: 'structural', label: 'Banish Trigger', description: 'Get a benefit when your characters are banished'},
  // Tribal (Toy / Dwarfs)
  {id: 'search', category: 'structural', label: 'Search', description: 'Search your deck for cards'},
  {id: 'self-discount', category: 'structural', label: 'Self Discount', description: 'Pay less to play this under a condition'},
  {id: 'density', category: 'structural', label: 'Density', description: 'Get a benefit when you have tribe members in play'},
  {id: 'recruit', category: 'structural', label: 'Recruit', description: 'Play a tribe member for free'},
  {id: 'return', category: 'structural', label: 'Bounce', description: 'Return a character to your hand for value'},
  // Locations
  {id: 'at-payoff', category: 'structural', label: 'At Location', description: 'Get benefits when characters are at a location'},
  {id: 'play-trigger', category: 'structural', label: 'Trigger', description: 'Trigger effects when you play or move to a location'},
  {id: 'buff', category: 'structural', label: 'Buff', description: 'Give locations stat boosts and protection'},
  {id: 'location-ramp', category: 'structural', label: 'Location Ramp', description: 'Reduce the cost to play or move to locations'},
  {id: 'move', category: 'structural', label: 'Move', description: 'Move characters to locations'},
  {id: 'in-play-check', category: 'structural', label: 'While in Play', description: 'Get benefits when you have locations in play'},
  {id: 'boost', category: 'structural', label: 'Boost', description: 'Put cards under locations to boost their abilities'},
];

/** Lookup any mechanic (generic or structural) by id. */
export const MECHANIC_BY_ID: Record<string, Mechanic> = Object.fromEntries(
  [...MECHANICS, ...STRUCTURAL_MECHANICS].map((m) => [m.id, m]),
);

/**
 * Canonical display label for a mechanic id, resolving a structural role to its
 * generic catalog twin first (e.g. `burn`→`lore-burn`) so the SAME mechanic reads
 * identically in every playstyle. One label per mechanic, defined once here.
 */
export function mechanicLabel(id: string): string {
  const canonical = STRUCTURAL_ROLE_TO_MECHANIC[id] ?? id;
  return MECHANIC_BY_ID[canonical]?.label ?? id;
}

/** Canonical description for a mechanic id (alias-resolved, see `mechanicLabel`). */
export function mechanicDescription(id: string): string {
  const canonical = STRUCTURAL_ROLE_TO_MECHANIC[id] ?? id;
  return MECHANIC_BY_ID[canonical]?.description ?? '';
}

/**
 * Maps a playstyle's structural role id to the catalog mechanic it duplicates.
 * The display layer uses this to show ONE tile when a card carries both (e.g.
 * Lore Denial's structural `burn` and the catalog's `lore-burn`) — the structural
 * tile wins (keeping its home-context label), and the aliased catalog mechanic is
 * suppressed for that card. Structural roles with no catalog twin (member, search,
 * density, banish-trigger, location roles, …) are absent here and surface as their
 * own tiles. See MECHANICS_TAXONOMY.md §3.
 */
export const STRUCTURAL_ROLE_TO_MECHANIC: Record<string, string> = {
  burn: 'lore-burn',
  steal: 'lore-steal',
  targeted: 'discard-targeted',
  random: 'discard-random',
  standard: 'discard-forced',
  draw: 'draw',
  'inkwell-ramp': 'inkwell-ramp',
  'inkwell-trigger': 'inkwell-trigger',
  'cost-reduction': 'cost-reduction',
};

/**
 * Return the ids of every generic mechanic a card exhibits, in catalog order.
 * Deterministic and side-effect free — safe to call in the engine loop.
 */
export function getCardMechanics(card: LorcanaCard): string[] {
  if (card.text == null || card.text === '') return [];
  return MECHANICS.filter((m) => m.detect?.(card)).map((m) => m.id);
}
