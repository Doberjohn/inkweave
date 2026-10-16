import type {LorcanaCard} from '../../types';
import {normalizeCardText} from '../cardHelpers.js';

// ============================================
// ITEM MATTERS ("Items" playstyle)
// ============================================

/**
 * Item Matters roles (the Set 9-13 Inventor / artifacts axis). PAYOFF-ANCHORED like
 * Floodborn: item members synergize with payoffs, never with each other, so the
 * rule's `findSynergies` skips member↔member to avoid ~3,000 density pairs across the
 * 82-item pool.
 *
 * - `member` — any Item card (the thing that gets played).
 * - `payoff-trigger` — a repeating "whenever you play an item" reward.
 * - `payoff-static` — a conditional/count reward ("for each item", "while/if you have an item in play").
 * - `item-engine` — tutor/search items, return items from discard, or discount OTHER items.
 *
 * EXCLUDES item removal ("banish chosen item") — anti-item control on the opposite
 * axis, which never matches the play/return/for-each patterns below. Role ids are
 * item-specific ("item-engine") to avoid colliding with other rules' catalog labels.
 */
export type ItemRole = 'member' | 'item-engine' | 'payoff-trigger' | 'payoff-static';

const ITEM_PLAY_TRIGGER = /whenever you play an item/i;
/**
 * A count or check of your items in play. A count of item cards in your discard ("For each item
 * card in your discard", Stegmutt - Clumsy Dinosaur; "for each item card put into your discard
 * this way", Quackerjack - Loony Toymaker) is skipped: no item you play reaches it.
 */
const ITEM_STATIC_PAYOFF =
  /for each (?:of your )?items?\b(?! cards? (?:put )?in(?:to)? your discard)|(?:while|if) you have (?:an?|\d+ or more) items?\b(?!\s+named)(?: in play)?|each item you have in play|\bready chosen item\b/i;
/** Search/tutor/free-play an item from deck, hand, or discard. */
const ITEM_SEARCH =
  /reveal[^.]{0,40}\bitem card|\bplay (?:a|an|that|chosen)[^.]{0,30}\bitem\b[^.]{0,30}(?:for free|from your (?:hand|discard))/i;
/**
 * Return an item card from your discard to your hand. Moving item cards from your discard to the
 * bottom of your deck (Stegmutt - Clumsy Dinosaur's cost) brings none back.
 */
const ITEM_RECURSION =
  /\bitem card[^.]{0,30}from your discard to your hand|from your discard[^.]{0,15}\bitem card/i;
/** Discount an item you play (gated below so self-discount "this item" doesn't count). */
const ITEM_COST_REDUCTION = /pay \d+[^.]{0,5}(?:less|fewer)[^.]{0,28}\bitems?\b/i;
const SELF_ITEM_DISCOUNT = /(?:less|fewer)[^.]{0,12}to play this item/i;
const HAS_ITEM_KEYWORD = /\bitem/i;

/**
 * An item engine tutors/searches items, returns items from discard, or discounts OTHER
 * items. The cost-reduction branch is gated so a self-discount ("this item") stays a plain
 * member. Split out of getItemRoles so the role builder reads as a flat sequence of pushes.
 */
function isItemEngine(text: string): boolean {
  return (
    ITEM_SEARCH.test(text) ||
    ITEM_RECURSION.test(text) ||
    (ITEM_COST_REDUCTION.test(text) && !SELF_ITEM_DISCOUNT.test(text))
  );
}

/** Determine the Item-Matters role(s) a card fulfills. A card can be multi-role. */
export function getItemRoles(card: LorcanaCard): ItemRole[] {
  const roles: ItemRole[] = [];
  if (card.type === 'Item') roles.push('member');

  if (card.text == null) return roles;
  const text = normalizeCardText(card);
  if (!HAS_ITEM_KEYWORD.test(text)) return roles;

  if (ITEM_PLAY_TRIGGER.test(text)) roles.push('payoff-trigger');
  if (ITEM_STATIC_PAYOFF.test(text)) roles.push('payoff-static');
  if (isItemEngine(text)) roles.push('item-engine');

  return roles;
}

export const isItemCard = (card: LorcanaCard): boolean => getItemRoles(card).length > 0;

/** "Ready chosen item.", the payoff Edna Mode - Super Suit Designer and Castle of the Horned King share. */
const ITEM_READY_PAYOFF = /\bready chosen item\b/i;

/**
 * True iff readying an item is the card's only item payoff (Edna Mode - Super Suit Designer,
 * Castle of the Horned King - Bastion of Evil). Such a payoff helps only an item it can ready and
 * use again (hasExertAbility).
 */
export function readiesItemsOnly(card: LorcanaCard): boolean {
  const text = normalizeCardText(card);
  if (!ITEM_READY_PAYOFF.test(text) || ITEM_PLAY_TRIGGER.test(text)) return false;
  return !ITEM_STATIC_PAYOFF.test(text.replace(ITEM_READY_PAYOFF, ''));
}

/** True iff the card has an exert ability: a ⟳ in its text, the cost of an activated ability. */
export const hasExertAbility = (card: LorcanaCard): boolean => (card.text ?? '').includes('⟳');
