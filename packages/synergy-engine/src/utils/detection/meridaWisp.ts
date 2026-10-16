import type {LorcanaCard} from '../../types';
import {isCharacter, normalizeCardText} from '../cardHelpers.js';

// ============================================
// MERIDA - WISP CONJURER (BECKON) DETECTION
// ============================================

/**
 * Single-anchor direct rule built around **Merida - Wisp Conjurer** (Amethyst, id 13050).
 * Her BECKON ability draws a card "whenever ANOTHER character of yours enters play exerted",
 * so she synergizes with cards that push YOUR characters into play exerted. Modeled on the
 * Spike Suit rule (one card defines the synergy; matched on ability text, not a card id, so a
 * reprint joins for free).
 *
 * Enabler tiers, scored by how much exerted-entry pressure the card generates:
 * - 'engine'     (8) — board-wide / repeatable: pushes OTHER of your characters into play
 *                      exerted. "...they enter play exerted" (Horned King, Simba) or the item
 *                      "the next character you play this turn enters play exerted"
 *                      (Powhatan's Staff). Fires BECKON many times per game.
 * - 'reanimator' (7) — replays ITSELF exerted from your discard ("if this card is in your
 *                      discard ... she/he enters play exerted" — Lilo, Stitch). One repeatable
 *                      exerted entry per loop.
 * - 'self'       (5) — a self-only body that "enters play exerted" once when played (the
 *                      Bodyguard reminder "This character may enter play exerted", plus a few
 *                      explicit bodies). Parallel density: fires BECKON exactly once.
 */
export type BeckonEnablerTier = 'engine' | 'reanimator' | 'self';

/** Fast pre-filter: every BECKON card mentions entering play exerted. */
const BECKON_HAS_EXERT = /enters? play exerted/i;

/**
 * Anchor: Merida's BECKON reward, matched on ability text so a reprint joins automatically.
 * The "another character of yours" wording is what excludes her own FOCUSED ENERGY self-exert
 * ("This character may enter play exerted") from triggering the draw.
 */
const BECKON_ANCHOR_PATTERN = /whenever another character of yours enters play exerted/i;

/**
 * Opposing-side exclusion: cards that make the OPPONENT's characters enter play exerted are
 * removal/tempo, not a BECKON enabler (BECKON fires only on YOUR characters). e.g. Jiminy
 * Cricket ("opposing characters with Rush enter play exerted").
 */
const BECKON_OPPOSING_PATTERN = /opposing[^.]{0,40}enters? play exerted/i;

/**
 * Engine: pushes OTHER of your characters into play exerted, repeatably.
 * - "...they enter play exerted" — playing characters from your discard / a revealed character
 *   (Horned King, Simba).
 * - "the next character you play this turn enters play exerted" — an ITEM (Powhatan's Staff)
 *   that shoves the next character in exerted; admitted even though it isn't a character
 *   (the Shift named-item exception: an item can still push a CHARACTER into exerted).
 */
const BECKON_ENGINE_PATTERN =
  /they enter play exerted|the next character you play[^.]{0,80}enters? play exerted/i;

/** Reanimator: this card replays ITSELF exerted from your discard (Lilo, Stitch). */
const BECKON_REANIMATOR_PATTERN =
  /(?:this card is in your discard|from your discard)[^.]{0,140}(?:he|she|it|they|this character) enters? play exerted/i;

/** Self-only body: "this character (may) enters play exerted" (incl. the Bodyguard reminder). */
const BECKON_SELF_PATTERN = /this character (?:may )?enters? play exerted/i;

/** True for the BECKON anchor (Merida - Wisp Conjurer or a same-text reprint). */
export function isBeckonAnchor(card: LorcanaCard): boolean {
  return card.text != null && BECKON_ANCHOR_PATTERN.test(normalizeCardText(card));
}

/**
 * A card is excluded from the BECKON enabler tiers when it is the anchor itself (Merida's own
 * FOCUSED ENERGY self-exert is "another character", so she can't self-pair) or when the exert
 * lands on an OPPOSING character (removal, not an enabler). Split out of getBeckonEnablerTier
 * so the tier classifier stays a flat reject → tier sequence.
 */
function isBeckonEnablerExcluded(card: LorcanaCard, t: string): boolean {
  return isBeckonAnchor(card) || BECKON_OPPOSING_PATTERN.test(t);
}

/**
 * Classify a card's BECKON enabler tier, or null if it doesn't push YOUR characters into play
 * exerted. Order is load-bearing:
 *   1. anchor self-check — Merida's own self-exert (FOCUSED ENERGY) never counts as an enabler
 *      ("another character"), so she can't self-pair.
 *   2. opposing exclusion — opponent-side exerts are removal, not an enabler.
 *   3. reanimator → engine → self.
 * The `self` branch is gated on isCharacter so an ITEM reading "this item enters play exerted"
 * (Sapphire Chromicon, MegaBot, Potato, ...) drops out — it's a character-only trigger. Powhatan's
 * Staff (an item) is still admitted, but via the engine branch, because it makes a CHARACTER exerted.
 */
export function getBeckonEnablerTier(card: LorcanaCard): BeckonEnablerTier | null {
  if (card.text == null) return null;
  const t = normalizeCardText(card);
  if (!BECKON_HAS_EXERT.test(t)) return null;
  if (isBeckonEnablerExcluded(card, t)) return null;
  if (BECKON_REANIMATOR_PATTERN.test(t)) return 'reanimator';
  if (BECKON_ENGINE_PATTERN.test(t)) return 'engine';
  if (BECKON_SELF_PATTERN.test(t) && isCharacter(card)) return 'self';
  return null;
}

/** True for any card that participates in the BECKON rule (the anchor or an enabler). */
export const isBeckonEnabler = (card: LorcanaCard): boolean => getBeckonEnablerTier(card) !== null;
