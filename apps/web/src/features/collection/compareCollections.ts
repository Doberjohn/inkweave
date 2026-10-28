import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {BinderShow} from './binderCards';
import type {CompareCounts} from './BinderShows';
import type {CollectionEntries} from './collectionParser';
import {holdsWhatTheyLack, isHeld, type Axis} from './collectionStats';

/** A friend's binder beside the reader's own collection (#1045): what You need and They need compare. */
export interface Compare {
  mine: CollectionEntries;
  theirs: CollectionEntries;
}

/** You need: they hold it in a finish you lack. */
const youNeed = (card: LorcanaCard, {mine, theirs}: Compare, axis: Axis) =>
  holdsWhatTheyLack(card, {giver: theirs, taker: mine}, axis);

/** They need: you hold it in a finish they lack. */
const theyNeed = (card: LorcanaCard, {mine, theirs}: Compare, axis: Axis) =>
  holdsWhatTheyLack(card, {giver: mine, taker: theirs}, axis);

/**
 * The binder's view as a test of each card, or null for All. Owned and Missing ask whether the
 * binder's collection (`shown`, a friend's in their binder) holds the card toward the headline
 * (`isHeld`). You need and They need ask whether one of the two collections holds it in a finish
 * the other lacks, and are All without both.
 */
export function inViewOf(
  show: BinderShow,
  axis: Axis,
  {shown, compare}: {shown: CollectionEntries; compare: Compare | null},
): ((card: LorcanaCard) => boolean) | null {
  if (show === 'owned') return (card) => isHeld(card, shown, axis);
  if (show === 'missing') return (card) => !isHeld(card, shown, axis);
  if (compare === null || show === 'all') return null;
  return show === 'you-need' ? (card) => youNeed(card, compare, axis) : (card) => theyNeed(card, compare, axis);
}

/** How many of `cards` You need and They need each hold. */
export function countCompare(cards: readonly LorcanaCard[], compare: Compare, axis: Axis): CompareCounts {
  let you = 0;
  let they = 0;
  for (const card of cards) {
    if (youNeed(card, compare, axis)) you += 1;
    if (theyNeed(card, compare, axis)) they += 1;
  }
  return {youNeed: you, theyNeed: they};
}
