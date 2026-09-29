import type {LorcanaCard} from '../types';
import {getInkDropGain, normalizeCardText} from './cardHelpers.js';

// ============================================
// INK DROPS DETECTION (Set 14: bank a drop now, remove it later to pay 1 ⬡)
// ============================================

/**
 * Ink Drops roles (payoff-anchored, see engine/inkDropScoring.ts):
 *  - 'drop-maker': gets ink drops ("get 1 ink drop", "each player gets 1 ink drop").
 *  - 'drop-payoff' uses them, in one of four ways: a bonus for removing a drop to play the
 *    card, a trigger on removing one, a bonus while you hold one, or a cost paid with drops.
 *  - 'drop-shared': the gain also (or only) feeds an opponent. Display-only: it tells players
 *    the downside but never changes a pair score.
 *
 * Lives outside cardHelpers.ts (the first role detector to do so) to keep that file out of
 * the CodeScene gate; bounceScoring.ts is the scoring-side precedent for the split.
 */
export type InkDropRole = 'drop-maker' | 'drop-payoff' | 'drop-shared';

/**
 * Raw-text pre-filter, checked BEFORE normalizeCardText: `matches` runs for every card, and
 * getRoles for every partner of a drop card, but almost no card mentions ink drops.
 */
const INK_DROP_TEXT = /ink\s+drops?/i;

/** The gain also feeds an opponent: "each player gets", "you and another chosen player each get", "They get". */
const SHARED =
  /\beach player gets?\s+\d+\s+ink\s+drops?\b|\beach get\s+\d+\s+ink\s+drops?\b|\bthey get\s+\d+\s+ink\s+drops?\b/i;
/** Spend rider: a bonus when you removed a drop to play this card (Jousting Match, Madam Mim). */
const SPEND_RIDER = /\bif you removed (?:an|\d+(?: or more)?) ink drops? to play\b/i;
/** Remove trigger: fires whenever you remove a drop, for any payment (Madam Mim's BAUBLE GAME). */
const REMOVE_TRIGGER = /\bwhenever you remove (?:an|one or more|\d+) ink drops?\b/i;
/** Hold payoff: a static bonus while you have a drop (Sir Kay, Wasabi - Called into Battle). */
const HOLD = /\b(?:while|if) you have (?:an|\d+ or more) ink drops?\b|\bfor each ink drop you have\b/i;
/**
 * Drop sink: a cost paid by removing drops, or a replacement for getting one (Baymax - Amped Up).
 * Anchored on "Shift remove" / "if you would get" so the "(You may remove an ink drop to pay 1 ⬡.)"
 * reminder, printed on most makers, never reads as a payoff.
 */
const DROP_SINK = /\bshift remove \d+ ink drops?\b|\bif you would get an ink drop\b/i;
/** A gain inside a repeatable trigger ("whenever …", "at the end of your turn", a ⟳ ability). */
const REPEATING_GAIN =
  /(?:\bwhenever\b|\bat the end of your turn\b|⟳)[^()]{0,120}?\bgets?\s+\d+\s+ink\s+drops?\b/i;
/**
 * A gain behind an ink-cost activation: Yama's "6 ⬡ — Whenever …" or the "⟳, 1 ⬡ — Get 1 ink drop"
 * that Bobby Zimuruski grants. The ink paid in offsets the drop, so it is not a repeating supply.
 */
const PAID_ACTIVATION_GAIN = /\d+\s*⬡\s*[—–-][^()]{0,120}?\bgets?\s+\d+\s+ink\s+drops?\b/i;
/** The opponent decides whether you get the drop (This Is Business, Shere Khan's ONE-SIDED DEAL, Go Go Tomago). */
const OPPONENT_GATED =
  /\bchosen opponent chooses one\b|\bfor each opponent who doesn't\b|\bwhenever this character is challenged\b/i;
/** One option of a modal ability, kept as its own section in preview data ("• Get 1 ink drop."). */
const MODAL_OPTION = /^\s*•/;

/** Normalized text of a card that mentions ink drops, or null (cheap raw-text pre-filter first). */
function inkDropText(card: LorcanaCard): string | null {
  if (card.text == null || !INK_DROP_TEXT.test(card.text)) return null;
  return normalizeCardText(card);
}

/** Test a pattern against a drop card's normalized text; false for any card without drop text. */
function dropTextMatches(card: LorcanaCard, pattern: RegExp): boolean {
  const t = inkDropText(card);
  return t !== null && pattern.test(t);
}

/** Spend rider: removing a drop to play this card switches on a bonus. */
export const isDropSpendRider = (card: LorcanaCard): boolean => dropTextMatches(card, SPEND_RIDER);

/** Remove trigger: every drop you remove, for any payment, fires this card. */
export const isDropRemoveTrigger = (card: LorcanaCard): boolean =>
  dropTextMatches(card, REMOVE_TRIGGER);

/** Hold payoff: a static bonus while you have a drop. */
export const isDropHoldPayoff = (card: LorcanaCard): boolean => dropTextMatches(card, HOLD);

/** Drop sink: pays a cost with drops, or converts drops you would get into something else. */
export const isDropSink = (card: LorcanaCard): boolean => dropTextMatches(card, DROP_SINK);

/**
 * Each ability block's normalized text; the whole text when a card carries no sections. Preview
 * data (the reveal form) splits every "•" option of a modal ability into its own section, so an
 * option is read with the line that offers it: Kit Cloudkicker - Sure Shot's "Whenever this
 * character quests, choose one:" still reaches its "• Get 1 ink drop." allCards.json keeps the
 * options inside the ability's section, where this changes nothing.
 */
function abilityTexts(card: LorcanaCard): string[] {
  const sections = card.textSections?.length ? card.textSections : [card.text ?? ''];
  const blocks: string[] = [];
  let offeringLine = '';
  for (const section of sections) {
    if (MODAL_OPTION.test(section)) {
      blocks.push(`${offeringLine} ${section}`);
    } else {
      offeringLine = section;
      blocks.push(section);
    }
  }
  return blocks.map((text) => normalizeCardText({...card, text}));
}

/**
 * A maker whose drops keep coming (a trigger or a free ⟳ ability), not one behind an ink-cost
 * activation. Judged one ability at a time, so a trigger in one ability never pairs with a
 * one-shot gain in another ("Whenever this character quests, draw a card." next to "When you
 * play this character, get 1 ink drop.").
 */
export function isRepeatingDropMaker(card: LorcanaCard): boolean {
  if (inkDropText(card) === null) return false;
  return abilityTexts(card).some((t) => REPEATING_GAIN.test(t) && !PAID_ACTIVATION_GAIN.test(t));
}

/** The opponent decides whether this card's drop reaches you. */
export const isOpponentGatedDrop = (card: LorcanaCard): boolean =>
  dropTextMatches(card, OPPONENT_GATED);

/** Payoff: any of the four ways a card uses ink drops. */
function isDropPayoffText(t: string): boolean {
  return SPEND_RIDER.test(t) || REMOVE_TRIGGER.test(t) || HOLD.test(t) || DROP_SINK.test(t);
}

/**
 * Determine the ink-drop role(s) a card fulfills. Maker and payoff are independent gates, so a
 * card could be both (none in the live database are); the scorer then reads it as a maker
 * against payoffs and as a payoff against makers.
 */
export function getInkDropRoles(card: LorcanaCard): InkDropRole[] {
  const t = inkDropText(card);
  if (t === null) return [];

  const roles: InkDropRole[] = [];
  if (getInkDropGain(card) > 0) roles.push('drop-maker');
  if (isDropPayoffText(t)) roles.push('drop-payoff');
  if (SHARED.test(t)) roles.push('drop-shared');
  return roles;
}

/** Check if a card participates in the Ink Drops playstyle (any role). */
export const isInkDropCard = (card: LorcanaCard): boolean => getInkDropRoles(card).length > 0;
