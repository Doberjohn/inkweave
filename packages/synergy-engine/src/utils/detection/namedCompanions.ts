import type {LorcanaCard} from '../../types';
import {normalizeCardText, SHIFT_ALIAS_PATTERN} from '../cardHelpers.js';

// ============================================
// NAMED COMPANION DETECTION
// ============================================

/**
 * A Shift reminder, whatever its cost: "(You may pay 5 ⬡ to play this on top of one of your
 * characters named Elsa.)", "(You may remove 2 ink drops to play this on top of ...)". Its
 * "named X" is a Shift target, which Shift Targets handles, so getNamedReferences strips it.
 * Keyed on the reminder's wording, not the keyword, so any cost shape is stripped.
 */
const SHIFT_REMINDER = /\([^)]*\bto play this on top of\b[^)]*\)/gi;

/**
 * A sentence end followed by an ALL-CAPS word: the title of the card's next ability, as in
 * "not named Mor'du. ROOTED BY FEAR". Case-sensitive on purpose: NAMED_PATTERN's 'i' flag
 * makes its [A-Z] match any letter, so it cannot tell this title from the "Smee" in
 * "Mr. Smee". A lone initial ("P. J. Pete") is not a title. getNamedReferences scans the
 * text between two titles on its own, so a name ends where the next ability begins.
 */
const ABILITY_TITLE_START = /\.\s+(?![A-Z]\.\s)(?=[^\sa-z]*[A-Z][^\sa-z]*(?:\s|$))/;

/**
 * Game-mechanic terminator pattern (as regex source string) that signals the
 * end of a card name. Names can contain lowercase articles ("the", "of"),
 * periods ("Mr."), hyphens ("Fix-It"), and exclamation marks ("Pull the
 * Lever!"), so we stop at words that clearly belong to game rules text.
 *
 * Also terminates on comma (handles "named Pete, you may..."), and on "and/or"
 * followed by a game verb or by a generic card description ("named Kevin or an
 * item card"), neither of which continues a name.
 */
const NAME_TERMINATOR_SOURCE = [
  // Game-mechanic verbs and prepositions
  "\\s+(?:in\\b|can\\b|can't\\b|may\\b|gets?\\b|gains?\\b|here\\b|for\\b|from\\b|at\\b|on\\b",
  '|you\\b|your\\b|their\\b|this\\b|that\\b|challenges?\\b|has\\b|have\\b|is\\b|are\\b',
  '|was\\b|were\\b|moves?\\b|costs?\\b)',
  // "and/or" followed by a verb (not a proper name continuation)
  '|\\s+(?:and|or)\\s+(?:reveal|put|return|play|exert|banish|deal|draw|give|pay|reduce|shuffle|the\\s+[a-z])',
  // "and/or" followed by a generic card description, not a second name ("or an item card")
  '|\\s+(?:and|or)\\s+(?:an?|another)\\s+(?:[a-z]+\\s+)?(?:card|character|item|location|action)s?\\b',
  // Comma boundary (e.g., "named Pete, you may")
  '|,',
].join('');

/** Words that should never be treated as card names (generic game text) */
const GENERIC_WORDS = new Set(['card', 'character', 'item', 'location', 'action']);

/** Fast check for "named" keyword — avoids regex compilation for cards without it */
const HAS_NAMED = /\bnamed\b/i;

/** Pre-compiled regex: captures everything after "named" until a terminator, sentence boundary, close-paren, or end */
const NAMED_PATTERN = new RegExp(
  `\\bnamed\\s+(.+?)(?=(?:\\.\\s(?![A-Z])|\\)|$)|${NAME_TERMINATOR_SOURCE})`,
  'gi',
);

/**
 * Extract all entity names referenced by "named X" patterns in a card's text.
 * Strips Shift text first (handled by Shift Targets rule).
 * Uses a terminator-based approach: captures everything after "named" until
 * hitting a game-mechanic word (in, can, may, etc.), sentence boundary, ability
 * title, or end of text.
 * Returns an array of unique referenced names, or empty if none found.
 */
export function getNamedReferences(card: LorcanaCard): string[] {
  if (!card.text || !HAS_NAMED.test(card.text)) return [];

  // Strip Shift reminders and Shift aliases (normalizeCardText already spells apostrophes as
  // card names do)
  const cleanText = normalizeCardText(card)
    .replace(SHIFT_REMINDER, '')
    .replace(SHIFT_ALIAS_PATTERN, '');

  // Reset lastIndex for global regex reuse
  NAMED_PATTERN.lastIndex = 0;

  // Scan the text between ability titles piece by piece, so a name never runs into a title
  const names = cleanText
    .split(ABILITY_TITLE_START)
    .flatMap((piece) => [...piece.matchAll(NAMED_PATTERN)])
    .flatMap((match) => namesInCapture(match[1]));

  return [...new Set(names)];
}

/** "named both Chip and Dale" names two cards. */
function splitBothPair(name: string): string[] | null {
  if (!name.toLowerCase().startsWith('both ')) return null;
  const bothMatch = name.match(/^both\s+(.+?)\s+and\s+(.+)$/i);
  return bothMatch ? [bothMatch[1].trim(), bothMatch[2].trim()] : null;
}

/** "X and Y" or "X or Y" names two cards when both parts start with uppercase. */
function splitCapitalizedPair(name: string): string[] | null {
  const conjMatch = name.match(/^(.+?)\s+(?:and|or)\s+([A-Z].+)$/);
  if (!conjMatch || !/^[A-Z]/.test(conjMatch[1])) return null;
  return [conjMatch[1].trim(), conjMatch[2].trim()];
}

/** The card name(s) in one "named X" capture, or none for a generic game term. */
function namesInCapture(capture: string): string[] {
  // Strip trailing punctuation (sentence-end periods, commas) but keep internal ones like "Mr."
  const name = capture.trim().replace(/[.,]+$/, '');
  // Skip generic game terms (e.g., "the named card, put it into your hand")
  if (!name || GENERIC_WORDS.has(name.toLowerCase())) return [];
  return splitBothPair(name) ?? splitCapitalizedPair(name) ?? [name];
}

/** Effect tier of a named reference; NAMED_EFFECT_SCORES maps each tier to its score. */
export type NamedEffectTier = 'game-winning' | 'strong' | 'moderate' | 'minor' | 'hostile';

/** Effect tiers in priority order: the first tier with a matching pattern wins; else 'minor'. */
const NAMED_EFFECT_TIERS: ReadonlyArray<readonly [NamedEffectTier, readonly RegExp[]]> = [
  // Hostile: a "banish" within 40 characters of "named" (the same clause), read as the card
  // banishing the named character. A passive "banished" does not count: "named Buzz Lightyear
  // was banished" is a condition the card waits for, not an attack.
  ['hostile', [/banish(?!ed).{0,40}named|named.{0,40}banish(?!ed)/]],
  // Game-winning: free play, draw multiple, deck search
  [
    'game-winning',
    [/play.*for free|for free|play.*without paying/, /draw \d+ card|draw cards/, /search your deck/],
  ],
  // Strong: cost reduction, keyword grants (Bodyguard, Challenger, Rush, Evasive, Singer). A
  // reduction reads "pay 1 ⬡ less"; "cost 3 or less" is a threshold (John Smith's Compass).
  [
    'strong',
    [
      /costs? \d+ less|cost reduction|pay \d+ .*less/,
      /gains? (?:bodyguard|challenger|rush|evasive|singer)/,
      /challenger \+\d/,
    ],
  ],
  // Moderate: stat boosts, lore, Resist, Support
  [
    'moderate',
    [
      /\+\d+\s*(?:strength|willpower|lore)/,
      /gains?\s+\d+ lore/,
      /resist \+\d/,
      /gains? support/,
      /can't be challenged/,
    ],
  ],
];

/**
 * Classify the effect of a named reference for scoring purposes.
 * Returns a tier based on the game effect described in the card text.
 */
export function classifyNamedEffect(card: LorcanaCard): NamedEffectTier {
  if (!card.text) return 'minor';
  const text = normalizeCardText(card).toLowerCase();
  const tier = NAMED_EFFECT_TIERS.find(([, patterns]) => patterns.some((p) => p.test(text)));
  return tier ? tier[0] : 'minor';
}

/** Map effect tier to numeric score */
export const NAMED_EFFECT_SCORES: Record<NamedEffectTier, number> = {
  'game-winning': 8,
  strong: 7,
  moderate: 6,
  minor: 5,
  hostile: 4,
};
