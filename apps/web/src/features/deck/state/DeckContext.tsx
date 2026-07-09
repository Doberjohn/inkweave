// Working-deck state for the builder (#465): a single active local draft with
// the mutation ops the UI drives, plus debounced localStorage persistence.
//
// Mounted UNDER `CardDataProvider` so it can resolve `cardId -> LorcanaCard`
// (needed to derive the deck's ink set, and later for live analysis). The state
// layer is deliberately PERMISSIVE: it never enforces the Core hard rules
// (<=4 copies / <=2 inks / >=60). `calculateDeckStats` is the single source of
// legality truth; the DeckPanel UI (#468) prevents illegal actions. Keeping the
// caps out of here avoids duplicating that logic in two places.

import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {getInks} from 'inkweave-synergy-engine';
import type {Archetype, Deck, DeckCard, Ink, LorcanaCard} from '../types';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {readDraft, writeDraft} from './deckStorage';

/** Debounce window for persisting the draft — coalesces rapid quantity/rename edits. */
const DRAFT_WRITE_DEBOUNCE_MS = 400;

/** Canonical Lorcana ink order, so a derived ink list reads consistently. */
const INK_ORDER: readonly Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

/**
 * Derive the deck's ink set from its cards. A dual-ink card contributes BOTH of
 * its inks (the engine's `getInks` returns 1 or 2). Ids that no longer resolve
 * (rotated out of Core) are skipped. The result must be DEDUPED and returned in
 * canonical {@link INK_ORDER} — the same derivation `deckStats` uses, so the
 * builder's ink chips agree with the stats bar.
 */
function deriveInks(
  cards: DeckCard[],
  getCardById: (id: string) => LorcanaCard | undefined,
): Ink[] {
  const inks = new Set<Ink>();
  for (const {cardId} of cards) {
    const card = getCardById(cardId);
    if (!card) continue; // rotated out of Core — skip, like deckStats
    for (const ink of getInks(card)) inks.add(ink);
  }
  return INK_ORDER.filter((ink) => inks.has(ink));
}

/** Order-sensitive ink equality (both lists are already in canonical INK_ORDER). */
function inksEqual(a: readonly Ink[], b: readonly Ink[]): boolean {
  return a.length === b.length && a.every((ink, i) => ink === b[i]);
}

/** A brand-new empty draft. */
function createEmptyDraft(): Deck {
  const now = Date.now();
  return {
    id: newDeckId(),
    name: 'New Deck',
    cards: [],
    inks: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}

/** Prefer the platform UUID; fall back to a timestamp-random id in exotic envs. */
function newDeckId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `deck-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Restore the persisted draft, or start a fresh one. Runs once on mount. */
function loadOrCreateDraft(): Deck {
  return readDraft() ?? createEmptyDraft();
}

/** Replace the deck's card list, re-deriving inks and stamping `updatedAt`. */
function withCards(
  deck: Deck,
  cards: DeckCard[],
  getCardById: (id: string) => LorcanaCard | undefined,
): Deck {
  return {...deck, cards, inks: deriveInks(cards, getCardById), updatedAt: Date.now()};
}

interface DeckContextValue {
  /** The current working draft (with derived `inks`). */
  deck: Deck;
  /** Add one copy of a card (new line, or +1 on the existing line). */
  addCard: (cardId: string) => void;
  /** Remove a card's line entirely. */
  removeCard: (cardId: string) => void;
  /** Set an exact copy count; `<= 0` removes the line. */
  setQuantity: (cardId: string, quantity: number) => void;
  /** Flag/unflag a card as a "deck core" anchor for suggestions. */
  markCore: (cardId: string, isCore: boolean) => void;
  /** Declare (or clear) the gameplan archetype; overrides auto-detection. */
  setGameplan: (gameplan: Archetype | undefined) => void;
  /** Rename the deck. */
  renameDeck: (name: string) => void;
  /** Empty the card list, keeping the deck's identity and name. */
  clearDeck: () => void;
}

const DeckContext = createContext<DeckContextValue | null>(null);

export function DeckProvider({children}: {children: ReactNode}) {
  const {getCardById, isLoading} = useCardDataContext();
  const [deck, setDeck] = useState<Deck>(loadOrCreateDraft);

  // Inks are DERIVED in render, never stored as authoritative state — so they
  // self-correct once the async card DB resolves (getCardById changes identity) and
  // after a set-graduation id-renumber, with NO setState-in-effect. While the DB is
  // still loading, keep the persisted inks (getCardById can't resolve anything yet) so
  // a restored draft isn't transiently blanked. The React Compiler memoizes this, so
  // `currentDeck` stays referentially stable across renders.
  const inks = isLoading ? deck.inks : deriveInks(deck.cards, getCardById);
  const currentDeck: Deck = inksEqual(inks, deck.inks) ? deck : {...deck, inks};

  // Latest deck for the teardown flush. Synced in an effect — never mutate a ref in render.
  const latestDeck = useRef(currentDeck);
  useEffect(() => {
    latestDeck.current = currentDeck;
  });

  // Persist (debounced). Recomputed from stable inputs so the deps stay referentially
  // stable (no per-render churn) yet it re-fires on an edit or once the DB resolves.
  useEffect(() => {
    const resolved = isLoading ? deck.inks : deriveInks(deck.cards, getCardById);
    const toPersist: Deck = inksEqual(resolved, deck.inks) ? deck : {...deck, inks: resolved};
    const handle = setTimeout(() => writeDraft(toPersist), DRAFT_WRITE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [deck, isLoading, getCardById]);

  // Flush the pending draft on teardown so an edit made inside the debounce window is
  // never lost: on unmount (leaving the builder) and on pagehide (tab close / mobile
  // background). `writeDraft` is idempotent last-write-wins, so a redundant flush is cheap.
  useEffect(() => {
    const flush = () => writeDraft(latestDeck.current);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const addCard = (cardId: string) =>
    setDeck((d) => {
      const existing = d.cards.find((c) => c.cardId === cardId);
      const cards = existing
        ? d.cards.map((c) => (c.cardId === cardId ? {...c, quantity: c.quantity + 1} : c))
        : [...d.cards, {cardId, quantity: 1}];
      return withCards(d, cards, getCardById);
    });

  const removeCard = (cardId: string) =>
    setDeck((d) => withCards(d, d.cards.filter((c) => c.cardId !== cardId), getCardById));

  const setQuantity = (cardId: string, quantity: number) =>
    setDeck((d) => {
      if (quantity <= 0) {
        return withCards(d, d.cards.filter((c) => c.cardId !== cardId), getCardById);
      }
      const has = d.cards.some((c) => c.cardId === cardId);
      const cards = has
        ? d.cards.map((c) => (c.cardId === cardId ? {...c, quantity} : c))
        : [...d.cards, {cardId, quantity}];
      return withCards(d, cards, getCardById);
    });

  const markCore = (cardId: string, isCore: boolean) =>
    setDeck((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.cardId === cardId ? {...c, isCore} : c)),
      updatedAt: Date.now(),
    }));

  const setGameplan = (gameplan: Archetype | undefined) =>
    setDeck((d) => ({...d, gameplan, updatedAt: Date.now()}));

  const renameDeck = (name: string) => setDeck((d) => ({...d, name, updatedAt: Date.now()}));

  const clearDeck = () =>
    setDeck((d) => ({...d, cards: [], inks: [], updatedAt: Date.now()}));

  const value: DeckContextValue = {
    deck: currentDeck,
    addCard,
    removeCard,
    setQuantity,
    markCore,
    setGameplan,
    renameDeck,
    clearDeck,
  };

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck(): DeckContextValue {
  const context = useContext(DeckContext);
  if (!context) {
    throw new Error('useDeck must be used within a DeckProvider');
  }
  return context;
}
