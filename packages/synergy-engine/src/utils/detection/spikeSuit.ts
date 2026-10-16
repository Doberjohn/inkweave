import type {LorcanaCard} from '../../types';
import {getKeywordValue, normalizeCardText, SENTENCE_BREAK} from '../cardHelpers.js';

// ============================================
// SPIKE SUIT DETECTION (Dale - Ready for His Shot)
// ============================================

/** Reminder text, like Challenger's "(While challenging, this character gets +N ¤.)". */
const REMINDER_TEXT_PATTERN = /\([^)]*\)/g;
/** A character's boost to its own strength: "this character gets +N ¤", "he gets +N ¤". */
const SELF_STRENGTH_BOOST_PATTERN = /\b(?:this character|he|she) gets \+(\d+) ¤/i;
/**
 * A self boost that is off when the character challenges: one that lasts a turn after a trigger
 * or a payment, or one that needs a location or damage.
 */
const OFF_IN_CHALLENGE_PATTERN = /\bthis turn\b|\bat a location\b|\bhas damage\b/i;

/**
 * The strength a character challenges with: its printed strength, its Challenger bonus ("While
 * challenging, this character gets +N ¤", read from the keyword), and each boost its own text
 * gives it that is on whenever it challenges (always, "during your turn", "while this character
 * has no damage", "while there's a card under this character"). A "for each" boost counts once.
 * Reminder text is skipped, so Challenger's reminder isn't counted twice.
 */
export function strengthInChallenge(card: LorcanaCard): number {
  return normalizeCardText(card)
    .replace(REMINDER_TEXT_PATTERN, '')
    .split(SENTENCE_BREAK)
    .filter((sentence) => !OFF_IN_CHALLENGE_PATTERN.test(sentence))
    .reduce(
      (strength, sentence) =>
        strength + Number(sentence.match(SELF_STRENGTH_BOOST_PATTERN)?.[1] ?? 0),
      (card.strength ?? 0) + (getKeywordValue(card, 'Challenger') ?? 0),
    );
}

/**
 * "This character can't challenge": Percy - Pupsicle's ICE BATH, and Adventurous's reminder
 * ("This character can't challenge and must quest each turn if able"), so reminder text is read
 * too. A conditional "can't quest or challenge unless …" doesn't match.
 */
const CANT_CHALLENGE_PATTERN = /\bthis character can't challenge\b/i;

/** The character never challenges, so it fights only when an opponent challenges it. */
export function cantChallenge(card: LorcanaCard): boolean {
  return CANT_CHALLENGE_PATTERN.test(normalizeCardText(card));
}
