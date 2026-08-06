// Pure, reducer-style deck transforms for the builder (#465). Each returns a NEW
// Deck; none touches React or storage. Kept beside DeckContext (the poolTileState
// idiom) so the provider stays thin wiring and the branchy edit logic is unit-
// tested in isolation. `getCardById` resolves cardId -> LorcanaCard for ink re-
// derivation; ids that no longer resolve (rotated out of Core) are skipped.

import {getInks} from 'inkweave-synergy-engine';
import type {Archetype, Deck, DeckCard, Ink, LorcanaCard} from '../types';
import {ALL_INKS} from '../../../shared/constants';

type CardResolver = (id: string) => LorcanaCard | undefined;

/**
 * A stable string standing for "what a save would write". Comparing two of these
 * answers whether the deck differs from its saved copy, which is how `isDirty` is
 * DERIVED rather than set by hand. Deriving matters because the flag now gates a
 * destructive confirm: a hand-set flag that a future mutation forgets to raise
 * would discard work silently, and one that stays raised after an edit is undone
 * trains people to click through the warning.
 *
 * Only the fields a save actually persists are included. Deliberately excluded:
 * `updatedAt` (changes on every keystroke, so it would make everything dirty
 * forever), `inks` (derived in render from `cards`), and `id` / `ownerId` /
 * `createdAt` / `schemaVersion` (identity, not content).
 *
 * Cards are sorted by id so that removing a card and adding it back reads as
 * unchanged; array order is an artifact of edit history, not of the deck.
 */
/**
 * Whether the deck differs from what the cloud last took.
 *
 * A deck that has never been saved (`savedFingerprint === null`) is unsaved only
 * once it holds a card: an empty new deck has nothing worth writing, and Save
 * should not invite anyone to create an empty row.
 *
 * Lives here rather than inline in the provider so it is unit-testable and so
 * DeckProvider stays under its complexity ceiling.
 */
export function isDeckUnsaved(deck: Deck, savedFingerprint: string | null): boolean {
  if (savedFingerprint === null) return deck.cards.length > 0;
  return deckFingerprint(deck) !== savedFingerprint;
}

export function deckFingerprint(deck: Deck): string {
  const cards = [...deck.cards]
    .sort((a, b) => a.cardId.localeCompare(b.cardId))
    .map((c) => `${c.cardId}:${c.quantity}:${c.isCore ? 1 : 0}`);
  return JSON.stringify({
    name: deck.name,
    gameplan: deck.gameplan ?? null,
    isPublic: deck.isPublic ?? false,
    cards,
  });
}

/**
 * Derive the deck's ink set from its cards. A dual-ink card contributes BOTH of
 * its inks (the engine's `getInks` returns 1 or 2). Ids that no longer resolve
 * (rotated out of Core) are skipped. The result must be DEDUPED and returned in
 * canonical {@link ALL_INKS}, the same derivation `deckStats` uses, so the
 * builder's ink chips agree with the stats bar.
 */
export function deriveInks(cards: DeckCard[], getCardById: CardResolver): Ink[] {
  const inks = new Set<Ink>();
  for (const {cardId} of cards) {
    const card = getCardById(cardId);
    if (!card) continue; // rotated out of Core, skip like deckStats
    for (const ink of getInks(card)) inks.add(ink);
  }
  return ALL_INKS.filter((ink) => inks.has(ink));
}

/** Order-sensitive ink equality (both lists are already in canonical ALL_INKS order). */
export function inksEqual(a: readonly Ink[], b: readonly Ink[]): boolean {
  return a.length === b.length && a.every((ink, i) => ink === b[i]);
}

/** Replace the deck's card list, re-deriving inks and stamping `updatedAt`. */
function withCards(deck: Deck, cards: DeckCard[], getCardById: CardResolver): Deck {
  return {...deck, cards, inks: deriveInks(cards, getCardById), updatedAt: Date.now()};
}

/** Add one copy of a card (new line, or +1 on the existing line). */
export function addCardToDeck(deck: Deck, cardId: string, getCardById: CardResolver): Deck {
  const existing = deck.cards.find((c) => c.cardId === cardId);
  const cards = existing
    ? deck.cards.map((c) => (c.cardId === cardId ? {...c, quantity: c.quantity + 1} : c))
    : [...deck.cards, {cardId, quantity: 1}];
  return withCards(deck, cards, getCardById);
}

/** Remove a card's line entirely. */
export function removeCardFromDeck(deck: Deck, cardId: string, getCardById: CardResolver): Deck {
  return withCards(deck, deck.cards.filter((c) => c.cardId !== cardId), getCardById);
}

/** Set an exact copy count; `<= 0` removes the line. */
export function setCardQuantity(
  deck: Deck,
  cardId: string,
  quantity: number,
  getCardById: CardResolver,
): Deck {
  if (quantity <= 0) {
    return withCards(deck, deck.cards.filter((c) => c.cardId !== cardId), getCardById);
  }
  const has = deck.cards.some((c) => c.cardId === cardId);
  const cards = has
    ? deck.cards.map((c) => (c.cardId === cardId ? {...c, quantity} : c))
    : [...deck.cards, {cardId, quantity}];
  return withCards(deck, cards, getCardById);
}

/** Flag/unflag a card as a "deck core" anchor for suggestions. */
export function markCardCore(deck: Deck, cardId: string, isCore: boolean): Deck {
  return {
    ...deck,
    cards: deck.cards.map((c) => (c.cardId === cardId ? {...c, isCore} : c)),
    updatedAt: Date.now(),
  };
}

/** Declare (or clear) the gameplan archetype; overrides auto-detection. */
export function setDeckGameplan(deck: Deck, gameplan: Archetype | undefined): Deck {
  return {...deck, gameplan, updatedAt: Date.now()};
}

/** Rename the deck. */
export function renameDeckName(deck: Deck, name: string): Deck {
  return {...deck, name, updatedAt: Date.now()};
}

/**
 * Who can see the deck. A property of the deck like its name, NOT a separate act
 * (owner ruling 2026-08-05).
 *
 * It used to be changed by its own write straight to the row, which meant two
 * writers for one column: this mutation plus the builder's Save. The builder held
 * whatever visibility the deck had when it loaded, so publishing and then saving
 * an edit wrote the stale value back and quietly un-published the deck. Going
 * through the draft, and letting Save be the only writer, makes that unreachable.
 */
export function setDeckVisibility(deck: Deck, isPublic: boolean): Deck {
  return {...deck, isPublic, updatedAt: Date.now()};
}

/** Empty the card list, keeping the deck's identity and name. */
export function clearDeckCards(deck: Deck): Deck {
  return {...deck, cards: [], inks: [], updatedAt: Date.now()};
}

/**
 * Swap the whole card list, keeping the deck's identity and name — the import path
 * (an import REPLACES the deck rather than merging into it).
 */
export function replaceDeckCards(deck: Deck, cards: DeckCard[], getCardById: CardResolver): Deck {
  return withCards(deck, cards, getCardById);
}
