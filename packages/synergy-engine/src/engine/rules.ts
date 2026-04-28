import type {LorcanaCard, PlaystyleId, SynergyMatch, SynergyRule} from '../types';
import {
  classifyNamedEffect,
  getBaseName,
  getDiscardRoles,
  getKeywordValue,
  getLocationRoles,
  getNamedReferences,
  getRampRoles,
  getShiftType,
  hasClassification,
  hasKeyword,
  isBoostBeneficiaryLocation,
  isCharacter,
  isDeckRamp,
  isDiscardCard,
  isLocation,
  isLocationSupportCard,
  isRampCard,
  isRepeatingTrigger,
  costReductionTargetsOverlap,
  isSong,
  isToyCard,
  getToyRoles,
  isLoreDenialCard,
  getLoreDenialRoles,
  LOCATION_PATTERNS,
  NAMED_EFFECT_SCORES,
  normalizeCardText,
  type DiscardRole,
  type LocationRole,
  type LoreDenialRole,
  type RampRole,
  type ShiftType,
  type ToyRole,
} from '../utils';

// ============================================
// CONDITIONAL SHIFT MATCHERS
// ============================================

/**
 * A condition matcher: extracts a condition from the Shift card's text and
 * checks if the base card's text can satisfy it.
 *
 * Each matcher has:
 * - `condition`: regex to extract the condition from the Shift card's text
 * - `satisfiedBy`: regex to check if the base card's text can enable that condition
 */
interface ShiftConditionMatcher {
  condition: RegExp;
  satisfiedBy: RegExp;
}

const SHIFT_CONDITION_MATCHERS: ShiftConditionMatcher[] = [
  {
    // "a card left a player's discard this turn"
    // Satisfied by cards that move/put/return/play/banish/shuffle cards from discard
    condition: /card left a player's discard/i,
    satisfiedBy:
      /(?:put|return|move|play|banish|shuffle).*(?:card|cards|character|characters).*from.*discard|from.*discard.*(?:on|to|into|back)|(?:card|character) from.*(?:your|chosen|a|their) (?:player's )?discard/i,
  },
];

/** Check if a base card can satisfy the conditional Shift requirement of a Shift card */
function baseActivatesShiftCondition(shiftCard: LorcanaCard, baseCard: LorcanaCard): boolean {
  if (!shiftCard.text || !baseCard.text) return false;
  const shiftText = shiftCard.text.replace(/\n/g, ' ');
  const baseText = baseCard.text.replace(/\n/g, ' ');

  return SHIFT_CONDITION_MATCHERS.some(
    (matcher) => matcher.condition.test(shiftText) && matcher.satisfiedBy.test(baseText),
  );
}

/**
 * Calculate Shift synergy score and explanation based on curve alignment,
 * inkwell flexibility, free Shift tiers, and condition activation.
 *
 * Uses the Shift keyword cost (not the card's hard-cast cost) to determine how
 * naturally the base curves into the shift play. Inkable cards (base and/or shift)
 * get a bump because they provide fallback utility when drawn off-curve.
 *
 * See SCORING_DESIGN.md "Rule 1: Shift Targets" for the full score table.
 */
function calculateShiftSynergy(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
): {score: number; reason: string} {
  const shiftType = getShiftType(shiftCard);
  const shiftCost = shiftType?.cost ?? shiftCard.cost;

  // Compute base score and reason from curve math
  const base = calculateShiftBaseScore(shiftCard, baseCard, shiftCost);

  // +1 bonus if the base card activates a conditional Shift condition
  const activates = baseActivatesShiftCondition(shiftCard, baseCard);
  if (activates) {
    return {
      score: Math.min(base.score + 1, 10),
      reason: `${base.reason} ${baseCard.fullName} is both a Shift target and enables the free Shift condition.`,
    };
  }

  return base;
}

function calculateShiftBaseScore(
  shiftCard: LorcanaCard,
  baseCard: LorcanaCard,
  shiftCost: number,
): {score: number; reason: string} {
  // Free Shift — scoring based on base cost
  if (shiftCost === 0) {
    if (baseCard.cost <= 3)
      return {
        score: 9,
        reason: `Free Shift: Play ${baseCard.fullName} early, then shift into ${shiftCard.fullName} for 0 ink.`,
      };
    if (baseCard.cost <= 5)
      return {
        score: 7,
        reason: `Free Shift: Shift ${baseCard.fullName} into ${shiftCard.fullName} for 0 ink, but the base takes longer to set up.`,
      };
    return {
      score: 5,
      reason: `Free Shift but expensive base — Hard to get ${baseCard.fullName} into play first.`,
    };
  }

  const curveGap = shiftCost - baseCard.cost;

  // Best case: gap=1 with both inkable — perfect curve AND full flexibility
  if (curveGap === 1 && baseCard.inkwell && shiftCard.inkwell)
    return {
      score: 9,
      reason: `Perfect curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. Both cards are inkable as fallback.`,
    };

  // Great curve: gap=1, one card inkable — still perfect tempo, slightly less flexible
  if (curveGap === 1 && (baseCard.inkwell || shiftCard.inkwell))
    return {
      score: 8,
      reason: `Perfect curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. One card is inkable as fallback.`,
    };

  // On curve but neither inkable — perfect tempo, no fallback flexibility
  if (curveGap === 1)
    return {
      score: 7,
      reason: `On curve: Play ${baseCard.fullName} on turn ${baseCard.cost}, Shift next turn. Neither card is inkable — Less flexible if drawn off-curve.`,
    };

  // 2-turn gap — still smooth but slightly slower
  if (curveGap === 2)
    return {
      score: 7,
      reason: `Smooth curve: ${baseCard.fullName} flows naturally into Shift within a couple of turns.`,
    };

  // Same cost (no ink savings) or wide 3-turn gap
  if (curveGap === 0)
    return {
      score: 5,
      reason: `Same cost — No ink savings from Shifting, but skips the drying phase.`,
    };
  if (curveGap === 3)
    return {
      score: 5,
      reason: `Wide 3-turn gap — Playable but slow to set up.`,
    };

  // Poor alignment: 4+ turn gap or negative (shift costs less than base)
  return {
    score: 3,
    reason: `The cost gap makes it hard to set up ${baseCard.fullName} in time to shift ${shiftCard.fullName} onto it.`,
  };
}

/**
 * Check if a target card is a valid Shift target for the given Shift variant.
 * - standard: same base name
 * - classification: target has the required classification
 * - universal: any character
 */
function isValidShiftTarget(
  shiftType: ShiftType,
  shiftCard: LorcanaCard,
  target: LorcanaCard,
): boolean {
  switch (shiftType.kind) {
    case 'standard':
      return getBaseName(target) === getBaseName(shiftCard);
    case 'classification':
      return hasClassification(target, shiftType.classification);
    case 'universal':
      return true;
  }
}

// ============================================
// LOCATION SYNERGY HELPERS
// ============================================

/** Score mapping for each location role when matched against a Location card */
const LOCATION_ROLE_SCORE: Record<LocationRole, number> = {
  'at-payoff': 7,
  'play-trigger': 7,
  buff: 7,
  'location-ramp': 7,
  move: 5,
  'in-play-check': 5,
  search: 5,
  boost: 5,
};

/** Human-readable labels for each location role */
const ROLE_LABELS: Record<LocationRole, string> = {
  'at-payoff': 'at location payoff',
  'play-trigger': 'play trigger',
  buff: 'location buff',
  'location-ramp': 'location ramp',
  move: 'move to location',
  'in-play-check': 'location check',
  search: 'location search',
  boost: 'location boost',
};

/** Short chip labels for each location role (used in UI) */
export const LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string> = {
  'at-payoff': 'Payoff',
  'play-trigger': 'Trigger',
  buff: 'Buff',
  'location-ramp': 'Ramp',
  move: 'Move',
  'in-play-check': 'Check',
  search: 'Search',
  boost: 'Boost',
};

/** Educational descriptions explaining what each location role means, templated with card name and location name */
export const LOCATION_ROLE_DESCRIPTIONS: Record<LocationRole, (cardName: string, locationName: string) => string> = {
  'at-payoff': (name, loc) => `${name} gets bonuses when characters are at ${loc}`,
  'play-trigger': (name, loc) => `${name} activates effects whenever you play ${loc}`,
  buff: (name, loc) => `${name} strengthens ${loc} with resist, protection, or stat boosts`,
  'location-ramp': (name, loc) => `${name} reduces the cost of playing or moving characters to ${loc}`,
  move: (name, loc) => `${name} moves characters to ${loc} to create an advantage`,
  'in-play-check': (name, loc) => `${name} gains benefits when you have ${loc} in play`,
  search: (name, loc) => `${name} searches your deck or discard for ${loc}`,
  boost: (name, loc) => `${name} can power up ${loc} through the Boost keyword`,
};

/**
 * Complementary role pairs — roles that mechanically interact.
 * Each key lists roles that it directly enables or benefits from.
 * Only pairs with at least one complementary interaction get cross-synergy.
 */
const COMPLEMENTARY_ROLES: Partial<Record<LocationRole, LocationRole[]>> = {
  // Enablers: these roles help get locations into play or onto the board
  search: ['at-payoff', 'play-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  'location-ramp': ['at-payoff', 'play-trigger', 'buff', 'move', 'in-play-check', 'boost'],
  // Positioning: move enables payoffs and benefits from buffs
  move: ['at-payoff', 'buff'],
  // Consumers: these need locations/positioning that enablers provide
  'at-payoff': ['move', 'search', 'location-ramp', 'buff'],
  'play-trigger': ['search', 'location-ramp'],
  buff: ['move', 'search', 'location-ramp', 'at-payoff', 'in-play-check'],
  'in-play-check': ['search', 'location-ramp'],
  boost: ['search', 'location-ramp'],
};

/** Roles that represent high-value location strategy pieces */
const HIGH_VALUE_ROLES: Set<LocationRole> = new Set([
  'at-payoff',
  'play-trigger',
  'buff',
  'location-ramp',
]);

/** Check if any role in `from` has a complementary relationship with any role in `to`. */
function hasComplementaryRole(from: LocationRole[], to: LocationRole[]): boolean {
  return from.some((role) => {
    const complements = COMPLEMENTARY_ROLES[role];
    return complements != null && to.some((r) => complements.includes(r));
  });
}

/**
 * Determine cross-synergy score between two location-support cards.
 * Only cards with complementary roles get cross-synergy — same-role or
 * unrelated-role pairs return null (no synergy).
 * Complementary high-value pairs score 5, others score 3.
 */
export function getCrossSynergyScore(
  rolesA: LocationRole[],
  rolesB: LocationRole[],
): number | null {
  if (rolesA.length === 0 || rolesB.length === 0) return null;

  // Check both directions: A complements B, or B complements A
  if (!hasComplementaryRole(rolesA, rolesB) && !hasComplementaryRole(rolesB, rolesA)) return null;

  const aHighValue = rolesA.some((r) => HIGH_VALUE_ROLES.has(r));
  const bHighValue = rolesB.some((r) => HIGH_VALUE_ROLES.has(r));

  if (aHighValue && bHighValue) return 5;
  return 3;
}

/** Build synergies for a location-support card: find Locations + cross-synergies */
function findLocationSupportSynergies(
  card: LorcanaCard,
  allCards: LorcanaCard[],
  role: LocationRole,
): SynergyMatch[] {
  const matches: SynergyMatch[] = [];
  const cardRoles = getLocationRoles(card);

  for (const other of allCards) {
    if (other.id === card.id) continue;

    if (isLocation(other)) {
      // Boost role only synergizes with locations that actually use cards beneath them
      if (role === 'boost' && !isBoostBeneficiaryLocation(other)) continue;
      // Location-support card ↔ Location = direct synergy
      matches.push({
        card: other,
        score: LOCATION_ROLE_SCORE[role],
        explanation: `${card.name} has ${ROLE_LABELS[role]} — Works with locations`,
        bidirectional: true,
      });
    } else if (isLocationSupportCard(other)) {
      // Cross-synergy with other location-support cards
      const otherRoles = getLocationRoles(other);
      const score = getCrossSynergyScore(cardRoles, otherRoles);
      if (score !== null) {
        const otherLabel = otherRoles.map((r) => ROLE_LABELS[r]).join(' + ');
        matches.push({
          card: other,
          score,
          explanation: `${card.name} (${ROLE_LABELS[role]}) and ${other.name} (${otherLabel}) — Complementary location strategy`,
          bidirectional: true,
        });
      }
    }
  }

  return matches;
}

/** Build synergies for a Location card: find support cards with a specific role */
function findLocationCardSynergiesForRole(
  card: LorcanaCard,
  allCards: LorcanaCard[],
  role: LocationRole,
): SynergyMatch[] {
  const matches: SynergyMatch[] = [];

  for (const other of allCards) {
    if (other.id === card.id) continue;
    if (isLocation(other)) continue; // Locations don't synergize with each other

    const roles = getLocationRoles(other);
    if (!roles.includes(role)) continue;

    matches.push({
      card: other,
      score: LOCATION_ROLE_SCORE[role],
      explanation: `${other.name} has ${ROLE_LABELS[role]}`,
      bidirectional: true,
    });
  }

  return matches;
}

/** Create a single location rule for a specific pattern */
function createLocationRule(
  id: string,
  name: string,
  role: LocationRole,
  pattern: RegExp,
  excludePattern?: RegExp,
): SynergyRule {
  return {
    id: `location-${id}`,
    name,
    category: 'playstyle',
    playstyleId: 'location-control',
    description: `Location synergy: ${name}`,

    matches: (card) => {
      if (isLocation(card)) {
        // Boost role pairs supports with locations that actually use cards beneath them.
        // Generic locations are not valid boost targets.
        if (role === 'boost') return isBoostBeneficiaryLocation(card);
        return true;
      }
      if (!card.text) return false;
      const normalizedText = normalizeCardText(card);
      // Exclude anti-location cards (banish/remove locations)
      if (LOCATION_PATTERNS['anti-location'].test(normalizedText)) return false;
      if (excludePattern && excludePattern.test(normalizedText)) return false;
      return pattern.test(normalizedText);
    },

    findSynergies: (card, allCards) => {
      if (isLocation(card)) {
        return findLocationCardSynergiesForRole(card, allCards, role);
      }
      return findLocationSupportSynergies(card, allCards, role);
    },
  };
}

/** Create all 8 location synergy rules (order matters for deduplication) */
function createLocationRules(): SynergyRule[] {
  return [
    createLocationRule(
      'at-payoff',
      'At Location Payoff',
      'at-payoff',
      LOCATION_PATTERNS['at-payoff'],
    ),
    createLocationRule(
      'play-trigger',
      'Location Play Trigger',
      'play-trigger',
      LOCATION_PATTERNS['play-trigger'],
    ),
    createLocationRule('buff', 'Location Buff', 'buff', LOCATION_PATTERNS.buff),
    createLocationRule(
      'location-ramp',
      'Location Ramp',
      'location-ramp',
      LOCATION_PATTERNS['location-ramp'],
    ),
    createLocationRule(
      'move',
      'Move to Location',
      'move',
      LOCATION_PATTERNS.move,
      LOCATION_PATTERNS['move-exclude'],
    ),
    createLocationRule(
      'in-play-check',
      'Location In-Play Check',
      'in-play-check',
      LOCATION_PATTERNS['in-play-check'],
    ),
    createLocationRule('search', 'Location Search', 'search', LOCATION_PATTERNS.search),
    createLocationRule('boost', 'Location Boost', 'boost', LOCATION_PATTERNS.boost),
  ];
}

// ============================================
// DISCARD ROLE UI LABELS
// ============================================

/** Short chip labels for each discard role (used in UI) */
export const DISCARD_ROLE_CHIP_LABELS: Record<DiscardRole, string> = {
  targeted: 'Targeted',
  random: 'Random',
  standard: 'Standard',
  payoff: 'Payoff',
};

/** Educational descriptions explaining what each discard role means */
export const DISCARD_ROLE_DESCRIPTIONS: Record<DiscardRole, string> = {
  targeted: 'Choose which card opponents discard',
  random: 'Force opponents to discard at random',
  standard: 'Force opponents to choose and discard',
  payoff: 'Get benefits for having more cards than your opponent',
};

/** Standalone educational descriptions for location roles (no card name needed) */
export const LOCATION_ROLE_TOOLTIP: Record<LocationRole, string> = {
  'at-payoff': 'Get benefits when characters are at a location',
  'play-trigger': 'Trigger effects when you play or move to a location',
  buff: 'Give locations stat boosts and protection',
  'location-ramp': 'Reduce the cost of playing or moving to locations',
  move: 'Move characters to locations',
  'in-play-check': 'Get benefits when you have locations in play',
  search: 'Search your deck or discard for locations',
  boost: 'Put cards under locations to boost their abilities',
};

// ============================================
// SYNERGY RULES
// ============================================

export const synergyRules: SynergyRule[] = [
  // --------------------------------------------
  // SHIFT TARGETS
  // --------------------------------------------
  {
    id: 'shift-targets',
    name: 'Shift Targets',
    category: 'direct',
    description: 'Characters with Shift and their valid targets',

    // Matches all characters: Shift cards find targets (forward), base characters find Shift cards (reverse)
    matches: (card) => isCharacter(card),

    findSynergies: (card, allCards) => {
      const shiftType = getShiftType(card);

      if (shiftType) {
        // Forward: Shift card finds valid targets based on variant
        return allCards
          .filter((other) => {
            if (other.id === card.id) return false;
            if (!isCharacter(other)) return false;
            return isValidShiftTarget(shiftType, card, other);
          })
          .map((target): SynergyMatch => {
            const {score, reason} = calculateShiftSynergy(card, target);
            return {
              card: target,
              score,
              explanation: reason,
              bidirectional: true,
            };
          });
      }

      // Reverse: non-Shift character finds Shift cards that can target it
      return allCards
        .filter((other) => {
          if (other.id === card.id) return false;
          if (!isCharacter(other)) return false;
          const otherShift = getShiftType(other);
          if (!otherShift) return false;
          return isValidShiftTarget(otherShift, other, card);
        })
        .map((shiftCard): SynergyMatch => {
          const {score, reason} = calculateShiftSynergy(shiftCard, card);
          return {
            card: shiftCard,
            score,
            explanation: reason,
            bidirectional: true,
          };
        });
    },
  },

  // --------------------------------------------
  // NAMED COMPANIONS
  // --------------------------------------------
  {
    id: 'named-companions',
    name: 'Named Companions',
    category: 'direct',
    description: 'Cards that reference specific named characters, items, locations, or actions',

    matches: (card) => {
      // Forward: card references other named entities
      if (getNamedReferences(card).length > 0) return true;
      // Reverse: any card could be a target of a named reference (handled in findSynergies)
      return false;
    },

    findSynergies: (card, allCards) => {
      const refs = getNamedReferences(card);
      if (refs.length === 0) return [];

      const effectTier = classifyNamedEffect(card);
      const score = NAMED_EFFECT_SCORES[effectTier];
      const matches: SynergyMatch[] = [];

      for (const refName of refs) {
        // Find all cards whose base name matches the referenced name
        const targets = allCards.filter((other) => other.id !== card.id && other.name === refName);

        for (const target of targets) {
          matches.push({
            card: target,
            score,
            explanation: `${card.fullName} benefits from having ${refName} — ${effectTier} synergy when companion is in play`,
            bidirectional: true,
          });
        }
      }

      return matches;
    },
  },

  // --------------------------------------------
  // LORE LOSS
  // --------------------------------------------
  {
    id: 'lore-loss',
    name: 'Lore Loss',
    category: 'playstyle',
    playstyleId: 'lore-denial',
    description: 'Cards that make the opponent lose lore reinforce the same denial strategy',

    matches: isLoreDenialCard,

    findSynergies: (card, allCards) => {
      const cardRoles = getLoreDenialRoles(card);
      if (cardRoles.length === 0) return [];
      const cardRole = cardRoles[0]; // burn and steal are mutually exclusive — exactly one role per card

      const matches: SynergyMatch[] = [];
      for (const other of allCards) {
        if (other.id === card.id) continue;
        const otherRoles = getLoreDenialRoles(other);
        if (otherRoles.length === 0) continue;
        const otherRole = otherRoles[0];

        const {score, explanation} = scoreLoreDenialPair(cardRole, otherRole, card, other);
        matches.push({card: other, score, explanation, bidirectional: true});
      }
      return matches;
    },
  },

  // --------------------------------------------
  // LOCATION SYNERGIES
  // --------------------------------------------
  ...createLocationRules(),

  // --------------------------------------------
  // DISCARD CONTROL
  // --------------------------------------------
  {
    id: 'discard',
    name: 'Discard',
    category: 'playstyle',
    playstyleId: 'discard',
    description:
      'Cards that force opponents to discard synergize with each other and with hand-size payoffs',

    matches: isDiscardCard,

    findSynergies: (card, allCards) => {
      const cardRoles = getDiscardRoles(card);
      if (cardRoles.length === 0) return [];

      const DISRUPTION: DiscardRole[] = ['targeted', 'random', 'standard'];
      const hasDisruption = (roles: DiscardRole[]) => roles.some((r) => DISRUPTION.includes(r));

      const matches: SynergyMatch[] = [];

      for (const other of allCards) {
        if (other.id === card.id) continue;

        const otherRoles = getDiscardRoles(other);
        if (otherRoles.length === 0) continue;

        const hasDisruptionPayoff =
          (hasDisruption(cardRoles) && otherRoles.includes('payoff')) ||
          (cardRoles.includes('payoff') && hasDisruption(otherRoles));

        if (hasDisruptionPayoff) {
          const disruption = hasDisruption(cardRoles) ? card : other;
          const payoff = cardRoles.includes('payoff') ? card : other;
          matches.push({
            card: other,
            score: 8,
            explanation: `${disruption.fullName} depletes the opponent's hand, powering up ${payoff.fullName}'s hand-size advantage`,
            bidirectional: true,
          });
        } else {
          const bothPayoff = cardRoles.includes('payoff') && otherRoles.includes('payoff');
          matches.push({
            card: other,
            score: 7,
            explanation: bothPayoff
              ? `Both ${card.fullName} and ${other.fullName} reward hand-size advantage over opponents`
              : `Both ${card.fullName} and ${other.fullName} disrupt the opponent's hand`,
            bidirectional: true,
          });
        }
      }

      return matches;
    },
  },

  // --------------------------------------------
  // SINGER + SONGS
  // --------------------------------------------
  {
    id: 'singer-songs',
    name: 'Singer + Songs',
    category: 'direct',
    description: 'Characters with Singer can exert to sing Song cards for free',

    matches: (card) => hasKeyword(card, 'Singer') || isSong(card),

    findSynergies: (card, allCards) => {
      if (hasKeyword(card, 'Singer')) {
        // Forward: Singer finds compatible Songs
        const singerValue = getKeywordValue(card, 'Singer') ?? card.cost;

        return allCards
          .filter((other) => other.id !== card.id && isSong(other) && other.cost <= singerValue)
          .map((song): SynergyMatch => {
            const diff = singerValue - song.cost;
            const score = diff === 0 ? 8 : diff === 1 ? 7 : diff === 2 ? 6 : 5;

            return {
              card: song,
              score,
              explanation: `${card.fullName} (Singer ${singerValue}) can sing ${song.fullName} (cost ${song.cost}) for free`,
              bidirectional: true,
            };
          });
      }

      // Reverse: Song finds Singers that can sing it
      return allCards
        .filter((other) => {
          if (other.id === card.id) return false;
          if (!hasKeyword(other, 'Singer')) return false;
          const singerValue = getKeywordValue(other, 'Singer') ?? other.cost;
          return card.cost <= singerValue;
        })
        .map((singer): SynergyMatch => {
          const singerValue = getKeywordValue(singer, 'Singer') ?? singer.cost;
          const diff = singerValue - card.cost;
          const score = diff === 0 ? 8 : diff === 1 ? 7 : diff === 2 ? 6 : 5;

          return {
            card: singer,
            score,
            explanation: `${singer.fullName} (Singer ${singerValue}) can sing ${card.fullName} (cost ${card.cost}) for free`,
            bidirectional: true,
          };
        });
    },
  },

  // --------------------------------------------
  // INK RAMP (playstyle: ramp)
  // --------------------------------------------
  {
    id: 'ramp',
    name: 'Ramp',
    category: 'playstyle',
    playstyleId: 'ramp',
    description:
      'Inkwell ramp, inkwell triggers, and cost reduction cards accelerate your ink economy',

    matches: isRampCard,

    findSynergies: (card, allCards) => {
      const cardRoles = getRampRoles(card);
      if (cardRoles.length === 0) return [];

      const matches: SynergyMatch[] = [];

      for (const other of allCards) {
        if (other.id === card.id) continue;

        const otherRoles = getRampRoles(other);
        if (otherRoles.length === 0) continue;

        const score = getRampPairScore(card, cardRoles, other, otherRoles);
        if (score === 0) continue; // Skip non-overlapping cost↔cost pairs

        const explanation = getRampExplanation(card, cardRoles, other, otherRoles);

        matches.push({
          card: other,
          score,
          explanation,
          bidirectional: true,
        });
      }

      return matches;
    },
  },

  // --------------------------------------------
  // TOY TRIBAL
  // --------------------------------------------
  {
    id: 'toy',
    name: 'Toy',
    category: 'playstyle',
    playstyleId: 'toy',
    description:
      'Toy characters and Toy-payoff cards reinforce a tight tribal strategy with search effects, cost reduction, and banish recursion',

    matches: isToyCard,

    findSynergies: (card, allCards) => {
      const cardRoles = getToyRoles(card);
      if (cardRoles.length === 0) return [];

      const matches: SynergyMatch[] = [];

      for (const other of allCards) {
        if (other.id === card.id) continue;
        const otherRoles = getToyRoles(other);
        if (otherRoles.length === 0) continue;

        const {score, explanation} = scoreToyPair(card, cardRoles, other, otherRoles);
        matches.push({card: other, score, explanation, bidirectional: true});
      }

      return matches;
    },
  },
];

// ============================================
// RAMP ROLE LABELS & DESCRIPTIONS
// ============================================

/** Short chip labels for each ramp role (used in UI) */
export const RAMP_ROLE_CHIP_LABELS: Record<RampRole, string> = {
  'inkwell-ramp': 'Ramp',
  'inkwell-trigger': 'Trigger',
  'cost-reduction': 'Discount',
};

/** Educational descriptions explaining what each ramp role means */
export const RAMP_ROLE_DESCRIPTIONS: Record<RampRole, string> = {
  'inkwell-ramp': 'Put extra cards into your inkwell',
  'inkwell-trigger': 'Trigger an effect when a card is put into your inkwell',
  'cost-reduction': 'Reduce the cost of other cards you play',
};

/** Short chip labels for each lore-denial role (used in UI) */
export const LORE_DENIAL_ROLE_CHIP_LABELS: Record<LoreDenialRole, string> = {
  burn: 'Burn',
  steal: 'Steal',
};

/** Educational descriptions explaining what each lore-denial role means */
export const LORE_DENIAL_ROLE_DESCRIPTIONS: Record<LoreDenialRole, string> = {
  burn: 'Make your opponents lose lore',
  steal: 'Steal lore from your opponents to gain your own',
};

/**
 * Short chip labels for each Toy role.
 * Cross-playstyle mechanics get explicit Toy-context labels (Strategy B):
 * source playstyles keep their short labels (e.g., "Burn" on Lore Denial page),
 * but Toys disambiguates with the noun (e.g., "Lore Burn" on Toys page) since the
 * playstyle name no longer provides context. Descriptions stay shared.
 * 'Ramp' and 'Discount' are universal enough to read clearly in any playstyle.
 */
export const TOY_ROLE_CHIP_LABELS: Record<ToyRole, string> = {
  member: 'Member',
  search: 'Search',
  draw: 'Card Draw',
  'banish-trigger': 'Banish Trigger',
  'self-discount': 'Self Discount',
  burn: 'Lore Burn',
  steal: 'Lore Steal',
  targeted: 'Targeted Discard',
  random: 'Random Discard',
  standard: 'Forced Discard',
  'inkwell-ramp': 'Ramp',
  'inkwell-trigger': 'Ink Trigger',
  'cost-reduction': 'Cost Reduction',
};

/** Educational descriptions for each Toy role — composed from source playstyles where applicable */
export const TOY_ROLE_DESCRIPTIONS: Record<ToyRole, string> = {
  member: 'Toy character — counts toward tribal density',
  search: 'Search your deck for Toy characters',
  draw: 'Draw extra cards',
  'banish-trigger': 'Trigger an effect when a Toy character is banished',
  'self-discount': 'Pay less to play a character under some condition',
  burn: LORE_DENIAL_ROLE_DESCRIPTIONS.burn,
  steal: LORE_DENIAL_ROLE_DESCRIPTIONS.steal,
  targeted: DISCARD_ROLE_DESCRIPTIONS.targeted,
  random: DISCARD_ROLE_DESCRIPTIONS.random,
  standard: DISCARD_ROLE_DESCRIPTIONS.standard,
  'inkwell-ramp': RAMP_ROLE_DESCRIPTIONS['inkwell-ramp'],
  'inkwell-trigger': RAMP_ROLE_DESCRIPTIONS['inkwell-trigger'],
  'cost-reduction': RAMP_ROLE_DESCRIPTIONS['cost-reduction'],
};

// ============================================
// LORE DENIAL SCORING
// ============================================

/**
 * Score a Lore Denial pair based on the role mix.
 *
 * Convention: 5 = neutral baseline (same strategy, no compounding interaction).
 * Bumps above 5 reflect mechanical efficiency: steal swings the lore race in
 * both directions per point (opponent down + you up), burn only one direction.
 *
 * Matrix:
 *   - burn ↔ burn   = 5 (parallel pressure, no compounding)
 *   - burn ↔ steal  = 6 (complementary — pressure + race-close)
 *   - steal ↔ steal = 7 (double swing engine — every trigger advances both axes)
 */
function scoreLoreDenialPair(
  roleA: LoreDenialRole,
  roleB: LoreDenialRole,
  cardA: LorcanaCard,
  cardB: LorcanaCard,
): {score: number; explanation: string} {
  if (roleA === 'steal' && roleB === 'steal') {
    return {
      score: 7,
      explanation: `Both ${cardA.fullName} and ${cardB.fullName} steal lore — every trigger swings the race in your favor twice`,
    };
  }
  if (roleA === 'burn' && roleB === 'burn') {
    return {
      score: 5,
      explanation: `Both ${cardA.fullName} and ${cardB.fullName} make the opponent lose lore — stacking denial pressure`,
    };
  }
  // Mixed pair — pick the burn-side and steal-side cards regardless of order
  const burn = roleA === 'burn' ? cardA : cardB;
  const steal = roleA === 'steal' ? cardA : cardB;
  return {
    score: 6,
    explanation: `${burn.fullName} pushes the opponent down while ${steal.fullName} pulls you up — pressing both ends of the lore race`,
  };
}

// ============================================
// RAMP SCORING
// ============================================

/**
 * Score a ramp pair based on their roles and sub-patterns.
 *
 * Scoring priority (highest to lowest):
 * - Deck ramp ↔ Repeating trigger: 9 (direct mechanic chain, scales with ramp)
 * - Deck ramp ↔ Once/turn trigger: 8 (strong but capped)
 * - Self-sacrifice ↔ Repeating trigger: 8 (fires trigger but costs a card)
 * - Self-sacrifice ↔ Once/turn trigger: 7 (card cost + capped)
 * - Ramp ↔ Ramp: 7 (density)
 * - Ramp ↔ Cost reduction: 7 (parallel acceleration)
 * - Trigger ↔ Trigger: 7 (density — multiple triggers compound)
 * - Cost reduction ↔ Cost reduction: 6 (stacking discounts)
 * - Trigger ↔ Cost reduction: 5 (weak indirect link)
 */
function getRampPairScore(
  cardA: LorcanaCard,
  rolesA: RampRole[],
  cardB: LorcanaCard,
  rolesB: RampRole[],
): number {
  const aHasRamp = rolesA.includes('inkwell-ramp');
  const bHasRamp = rolesB.includes('inkwell-ramp');
  const aHasTrigger = rolesA.includes('inkwell-trigger');
  const bHasTrigger = rolesB.includes('inkwell-trigger');
  const aHasCost = rolesA.includes('cost-reduction');
  const bHasCost = rolesB.includes('cost-reduction');

  // Ramp ↔ Trigger (highest — direct mechanic chain)
  if ((aHasRamp && bHasTrigger) || (aHasTrigger && bHasRamp)) {
    const rampCard = aHasRamp ? cardA : cardB;
    const triggerCard = aHasTrigger ? cardA : cardB;
    const deckRampBonus = isDeckRamp(rampCard);
    const repeatingBonus = isRepeatingTrigger(triggerCard);

    if (deckRampBonus && repeatingBonus) return 9;
    if (deckRampBonus || repeatingBonus) return 8;
    return 7;
  }

  // Ramp ↔ Ramp (density)
  if (aHasRamp && bHasRamp) return 7;

  // Ramp ↔ Cost reduction (parallel acceleration)
  if ((aHasRamp && bHasCost) || (aHasCost && bHasRamp)) return 7;

  // Trigger ↔ Trigger (density)
  if (aHasTrigger && bHasTrigger) return 7;

  // Cost reduction ↔ Cost reduction (stacking — only if they discount the same card type)
  if (aHasCost && bHasCost) {
    return costReductionTargetsOverlap(cardA, cardB) ? 6 : 0;
  }

  // Trigger ↔ Cost reduction (weak indirect)
  if ((aHasTrigger && bHasCost) || (aHasCost && bHasTrigger)) return 5;

  // Fallback (shouldn't reach here if roles are correct)
  return 6;
}

/**
 * Generate a human-readable explanation for a ramp synergy pair.
 */
function getRampExplanation(
  cardA: LorcanaCard,
  rolesA: RampRole[],
  cardB: LorcanaCard,
  rolesB: RampRole[],
): string {
  const aHasRamp = rolesA.includes('inkwell-ramp');
  const bHasRamp = rolesB.includes('inkwell-ramp');
  const aHasTrigger = rolesA.includes('inkwell-trigger');
  const bHasTrigger = rolesB.includes('inkwell-trigger');
  const aHasCost = rolesA.includes('cost-reduction');
  const bHasCost = rolesB.includes('cost-reduction');

  // Ramp ↔ Trigger
  if ((aHasRamp && bHasTrigger) || (aHasTrigger && bHasRamp)) {
    const ramp = aHasRamp ? cardA : cardB;
    const trigger = aHasTrigger ? cardA : cardB;
    return `${ramp.fullName} adds ink to your inkwell, triggering ${trigger.fullName}'s inkwell effect`;
  }

  // Ramp ↔ Ramp
  if (aHasRamp && bHasRamp) {
    return `Both ${cardA.fullName} and ${cardB.fullName} accelerate your ink, getting you ahead faster`;
  }

  // Ramp ↔ Cost reduction
  if ((aHasRamp && bHasCost) || (aHasCost && bHasRamp)) {
    const ramp = aHasRamp ? cardA : cardB;
    const cost = aHasCost ? cardA : cardB;
    return `${ramp.fullName} adds extra ink while ${cost.fullName} discounts your plays`;
  }

  // Trigger ↔ Trigger
  if (aHasTrigger && bHasTrigger) {
    return `Both ${cardA.fullName} and ${cardB.fullName} effects activate on inkwell events`;
  }

  // Cost reduction ↔ Cost reduction
  if (aHasCost && bHasCost) {
    return `Both ${cardA.fullName} and ${cardB.fullName} reduce costs — stacking discounts lets you play cards faster`;
  }

  // Trigger ↔ Cost reduction
  if ((aHasTrigger && bHasCost) || (aHasCost && bHasTrigger)) {
    return `${cardA.fullName} and ${cardB.fullName} both support an accelerated game plan`;
  }

  return `${cardA.fullName} and ${cardB.fullName} reinforce the ramp strategy`;
}

// ============================================
// TOY TRIBAL SCORING
// ============================================

/**
 * Tribal payoff roles — these specifically reward Toy density (vs. generic
 * mechanics inherited via composition like draw, burn, ramp, etc., which
 * happen to appear on Toy cards but don't compound with tribal mass).
 */
const TOY_TRIBAL_ROLES: readonly ToyRole[] = ['search', 'banish-trigger', 'self-discount'];

const hasTribalRole = (roles: ToyRole[]): boolean =>
  roles.some((r) => TOY_TRIBAL_ROLES.includes(r));

/**
 * Score a Toy pair using a role-driven matrix.
 *
 * Convention: 5 = same-deck baseline, 7+ = mechanical compounding around tribal density.
 *
 * Matrix (highest precedence first):
 *   - search ↔ banish-trigger  = 8 (peak chain — load board, pay off on banish)
 *   - Member ↔ search          = 8 (search converts deck slot to tribal member)
 *   - Tribal ↔ Tribal (other)  = 7 (multiple density rewards compound)
 *   - Member ↔ Tribal          = 7 (member feeds the tribal payoff)
 *   - Otherwise                = 5 (Member↔Member, Member↔generic, Generic↔generic;
 *                                   generic mechanic synergies are owned by their own rules)
 */
function scoreToyPair(
  card: LorcanaCard,
  cardRoles: ToyRole[],
  other: LorcanaCard,
  otherRoles: ToyRole[],
): {score: number; explanation: string} {
  const aMember = cardRoles.includes('member');
  const bMember = otherRoles.includes('member');
  const aHasSearch = cardRoles.includes('search');
  const bHasSearch = otherRoles.includes('search');
  const aHasBanish = cardRoles.includes('banish-trigger');
  const bHasBanish = otherRoles.includes('banish-trigger');
  const aTribal = hasTribalRole(cardRoles);
  const bTribal = hasTribalRole(otherRoles);

  // 8 — search ↔ banish-trigger (peak tribal chain)
  if ((aHasSearch && bHasBanish) || (aHasBanish && bHasSearch)) {
    const searcher = aHasSearch ? card : other;
    const trigger = aHasBanish ? card : other;
    return {
      score: 8,
      explanation: `${searcher.fullName} loads a Toy onto the board, then ${trigger.fullName} pays off when it's banished — peak tribal chain`,
    };
  }

  // 8 — Member ↔ search (search fetches a tribal member from the deck)
  if ((aMember && bHasSearch) || (aHasSearch && bMember)) {
    const searcher = aHasSearch ? card : other;
    const memberCard = aHasSearch ? other : card;
    return {
      score: 8,
      explanation: `${searcher.fullName} can fetch ${memberCard.fullName} from the deck — direct tribal access`,
    };
  }

  // 7 — Tribal ↔ Tribal (other combinations: both reward Toy density)
  if (aTribal && bTribal) {
    return {
      score: 7,
      explanation: `${card.fullName} and ${other.fullName} both reward Toy density — tribal payoffs compound`,
    };
  }

  // 7 — Member ↔ Tribal (member feeds the tribal payoff)
  if ((aMember && bTribal) || (aTribal && bMember)) {
    const tribalCard = aTribal ? card : other;
    const memberCard = aTribal ? other : card;
    return {
      score: 7,
      explanation: `${memberCard.fullName} contributes to the Toy density that ${tribalCard.fullName} rewards`,
    };
  }

  // 5 — same-deck baseline (Member↔Member, Member↔generic, Generic↔generic).
  // Generic-mechanic synergies (draw↔draw, burn↔steal) are owned by their own rules;
  // Toys gives them only the deck-share floor to avoid double-counting.
  return {
    score: 5,
    explanation: `${card.fullName} and ${other.fullName} share the Toys deck — density baseline`,
  };
}

// Get all rules
export const getAllRules = (): SynergyRule[] => synergyRules;

// Get rules by category
export const getRulesByCategory = (category: SynergyRule['category']): SynergyRule[] => {
  return synergyRules.filter((rule) => rule.category === category);
};

// Get rules by playstyle
export const getRulesByPlaystyle = (playstyleId: PlaystyleId): SynergyRule[] => {
  return synergyRules.filter(
    (rule) => rule.category === 'playstyle' && rule.playstyleId === playstyleId,
  );
};

// Get a specific rule by ID
export const getRuleById = (id: string): SynergyRule | undefined => {
  return synergyRules.find((rule) => rule.id === id);
};
