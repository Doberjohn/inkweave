import type {LorcanaCard} from '../types/card.js';
import type {
  LoreDenialRole,
  LocationRole,
  DiscardRole,
  SelfDiscardRole,
  RampRole,
  SacrificeRole,
  ToyRole,
  DwarfsRole,
  FloodbornRole,
  HunnyRole,
  RedPandaRole,
  ItemRole,
  HealRole,
  ExertRole,
  BounceRole,
  TribalRole,
} from './cardHelpers.js';
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
  // Self-Discard
  {id: 'enabler', category: 'structural', label: 'Discard then Draw', description: 'Discard your own cards from hand (loot, discard your hand, or as a cost)'},
  {id: 'reanimator', category: 'structural', label: 'Play from Discard', description: 'Play or return a card from your discard'},
  {id: 'state-payoff', category: 'structural', label: 'Discard Benefits', description: 'Get benefits for discarding a card or having an empty hand'},
  {id: 'zone-payoff', category: 'structural', label: 'Discard Count', description: 'Get benefits for the cards sitting in your discard'},
  {id: 'mill', category: 'structural', label: 'Mill', description: 'Put cards from the top of your deck into your discard'},
  // Items
  {id: 'item-engine', category: 'structural', label: 'Item Engine', description: 'Search, replay, or discount items to keep playing more'},
  {id: 'payoff-trigger', category: 'structural', label: 'Item Trigger', description: 'Triggers an effect whenever you play an item'},
  {id: 'payoff-static', category: 'structural', label: 'Item Payoff', description: 'Rewards having items in play or counts your items'},
  // Sacrifice
  {id: 'self-banish', category: 'structural', label: 'Self-Banish', description: 'Banish your own characters on demand'},
  {id: 'banish-trigger', category: 'structural', label: 'Banish Trigger', description: 'Get a benefit when your characters are banished'},
  // Healing
  {id: 'healer', category: 'structural', label: 'Healer', description: 'Remove damage from your characters'},
  {id: 'heal-payoff', category: 'structural', label: 'Heal Payoff', description: 'Get a benefit whenever you remove damage'},
  // Exert
  {id: 'exert-enabler', category: 'structural', label: 'Exert Opponent', description: 'Exert an opposing character to keep it from questing or challenging'},
  {id: 'exert-payoff', category: 'structural', label: 'Exert Payoff', description: 'Banish, lock, or scale off an already-exerted opposing character'},
  // Bounce
  {id: 'self-bounce', category: 'structural', label: 'Self-Bounce', description: 'Return your own character to hand to re-fire its enter-play ability'},
  {id: 'flexible', category: 'structural', label: 'Flexible Bounce', description: 'Return a chosen character, item, or location to its owner’s hand (either side)'},
  {id: 'opponent-bounce', category: 'structural', label: 'Opponent Bounce', description: 'Return an opponent’s card to their hand for tempo'},
  {id: 'return-payoff', category: 'structural', label: 'Return Payoff', description: 'Get a benefit whenever a card is returned to hand from play'},
  {id: 'rebuy-payoff', category: 'structural', label: 'Re-buy Target', description: 'A strong enter-play ability worth re-firing by bouncing this character'},
  // Floodborns
  {id: 'trigger', category: 'structural', label: 'Trigger', description: 'Get a repeating benefit when your Floodborn characters quest, play, or are banished'},
  // Tribal (Toy / Dwarfs)
  {id: 'search', category: 'structural', label: 'Search', description: 'Search your deck for cards'},
  {id: 'self-discount', category: 'structural', label: 'Self Discount', description: 'Pay less to play this under a condition'},
  {id: 'density', category: 'structural', label: 'Density', description: 'Get a benefit when you have tribe members in play'},
  {id: 'recruit', category: 'structural', label: 'Recruit', description: 'Play a tribe member for free'},
  {id: 'return', category: 'structural', label: 'Bounce', description: 'Return a character to your hand for value'},
  // Locations
  {id: 'at-payoff', category: 'structural', label: 'At Location', description: 'Get benefits when characters are at a location'},
  {id: 'play-trigger', category: 'structural', label: 'On Play', description: 'Trigger effects when you play a location'},
  {id: 'move-trigger', category: 'structural', label: 'On Move', description: 'Trigger effects when a character moves to a location'},
  {id: 'buff', category: 'structural', label: 'Buff', description: 'Give friendly characters or locations stat boosts and protection'},
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
 * The union of every structural role id any playstyle detector (`getXRoles`) can
 * emit. Composed from each rule's `*Role` type, so it widens automatically when a
 * rule's role union changes.
 */
type StructuralRoleId =
  | LoreDenialRole
  | LocationRole
  | DiscardRole
  | SelfDiscardRole
  | RampRole
  | SacrificeRole
  | ToyRole
  | DwarfsRole
  | FloodbornRole
  | HunnyRole
  | RedPandaRole
  | ItemRole
  | HealRole
  | ExertRole
  | BounceRole
  | TribalRole;

/**
 * Every structural role id, flagged `true` when it surfaces as a display tile (and
 * therefore MUST have a catalog label) or `false` when it is membership-only (`member`).
 *
 * This is a TOTAL `Record<StructuralRoleId, boolean>`: when a new playstyle's role
 * union introduces an id that isn't registered here, this object fails to compile —
 * the guardrail that stops a new rule from shipping mechanic tiles with no label. A
 * unit test (`mechanics.test.ts`) then asserts every `true` id resolves via
 * `mechanicLabel`. See MECHANICS_TAXONOMY.md.
 */
export const STRUCTURAL_ROLE_DISPLAY: Record<StructuralRoleId, boolean> = {
  burn: true,
  steal: true,
  targeted: true,
  random: true,
  standard: true,
  payoff: true,
  enabler: true,
  reanimator: true,
  'state-payoff': true,
  'zone-payoff': true,
  mill: true,
  'item-engine': true,
  'payoff-trigger': true,
  'payoff-static': true,
  'inkwell-ramp': true,
  'inkwell-trigger': true,
  'cost-reduction': true,
  'self-banish': true,
  'banish-trigger': true,
  healer: true,
  'heal-payoff': true,
  'exert-enabler': true,
  'exert-payoff': true,
  'self-bounce': true,
  flexible: true,
  'opponent-bounce': true,
  'return-payoff': true,
  'rebuy-payoff': true,
  'at-payoff': true,
  move: true,
  'play-trigger': true,
  'move-trigger': true,
  'in-play-check': true,
  boost: true,
  'location-ramp': true,
  search: true,
  'self-discount': true,
  density: true,
  recruit: true,
  return: true,
  trigger: true,
  buff: true,
  draw: true,
  member: false,
};

/**
 * Return the ids of every generic mechanic a card exhibits, in catalog order.
 * Deterministic and side-effect free — safe to call in the engine loop.
 */
export function getCardMechanics(card: LorcanaCard): string[] {
  if (card.text == null || card.text === '') return [];
  return MECHANICS.filter((m) => m.detect?.(card)).map((m) => m.id);
}
