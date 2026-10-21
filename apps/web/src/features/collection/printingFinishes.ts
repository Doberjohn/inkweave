import type {PrintingFinishes} from 'inkweave-synergy-engine';
import {isChaseRarity} from '../cards/loader';
import type {Finish} from './collectionParser';

/**
 * Which versions a printing comes in (#880): the one rule the binder's pockets, the card
 * window's copies and the collection stats share, and admin re-exports through its bridge.
 *
 * A printing's card data names them (`finishes`) where its rarity would get them wrong: a set
 * printing from LorcanaJSON's `foilTypes` (the 13 alt foils), a promo from the owner's promo
 * catalog, `scripts/data/promo-printings.json`. It also holds the owner's corrections, Both
 * included, which admin's Card studio writes. Without the field a printing follows its rarity:
 * Enchanted, Epic and Iconic come in foil alone (owner, 2026-10-19), and every other rarity,
 * promos included, in both (owner, 2026-10-18). Preview cards have no field until their set is
 * official (owner, 2026-10-21), so they follow it too.
 */

/** Both versions, in the order a copies stripe shows them: normal, then foil. */
const BOTH: readonly Finish[] = ['normal', 'foil'];
const FOIL_ONLY: readonly Finish[] = ['foil'];

/** What a printing's versions are read from: a card, one of its `variants`, or a promo. */
export interface FinishFacts {
  rarity?: string;
  finishes?: PrintingFinishes;
}

/** The versions `printing` comes in, in the stripe's order: its data's, else its rarity's. */
export function finishesOf(printing: FinishFacts): readonly Finish[] {
  return printing.finishes ?? (isChaseRarity(printing.rarity) ? FOIL_ONLY : BOTH);
}
