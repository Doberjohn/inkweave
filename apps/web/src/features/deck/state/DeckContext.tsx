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
import type {Archetype, Deck, DeckCard} from '../types';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {useSession} from '../../../shared/contexts/SessionContext';
import {
  clearDraft,
  hasMigratedDraft,
  markDraftMigrated,
  readDirty,
  readDraft,
  writeDirty,
  writeDraft,
} from './deckStorage';
import {upsertDeck} from './deckRepository';
import {
  addCardToDeck,
  clearDeckCards,
  replaceDeckCards,
  deriveInks,
  inksEqual,
  markCardCore,
  removeCardFromDeck,
  renameDeckName,
  setCardQuantity,
  setDeckGameplan,
} from './deckMutations';

/** Debounce window for persisting the draft — coalesces rapid quantity/rename edits. */
const DRAFT_WRITE_DEBOUNCE_MS = 400;

/** A brand-new empty draft. Unbound (`ownerId: null`) until a save claims it. */
function createEmptyDraft(isPublic = false): Deck {
  const now = Date.now();
  return {
    id: newDeckId(),
    name: 'New Deck',
    cards: [],
    inks: [],
    isPublic,
    ownerId: null,
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
  /** Replace every card — the import path; an import replaces, never merges. */
  replaceCards: (cards: DeckCard[]) => void;
  /** True when the draft has edits not yet pushed to the cloud. */
  isDirty: boolean;
  /** Bind the draft to its saved row and mark it clean. Call after a successful upsert. */
  markSaved: (saved: Deck) => void;
  /** Replace the draft with a fetched deck, bound and clean. */
  loadDeck: (deck: Deck) => void;
  /** Reset to an empty, unbound draft carrying the chosen visibility. */
  startNewDeck: (visibility: 'private' | 'public') => void;
}

const DeckContext = createContext<DeckContextValue | null>(null);

/**
 * First-sign-in draft->cloud migration (#464, #463 last mile). When a user signs
 * in, promote their pre-sign-in anonymous draft into `decks` exactly ONCE so the
 * work isn't lost. hasMigratedDraft/markDraftMigrated (localStorage, per-uid) make
 * it idempotent across reloads and re-sign-ins; `migratedUid` claims the uid the
 * moment it's handled so rapid edits during the in-flight upsert can't re-fire it.
 * Only a non-empty pre-sign-in draft migrates: an authed user opening a fresh
 * builder never litters `decks` with an empty ghost row. Reads the draft through
 * `latestDeck` (synced each render) so the effect depends only on the sign-in
 * moment, not every edit. Continuous sync + SaveDeckDialog + /decks list are
 * deferred to #473. Fire-and-forget: on failure the local draft still persists.
 */
function useFirstSignInMigration(uid: string | null, isLoading: boolean, latestDeck: {current: Deck}) {
  const claimedUid = useRef<string | null>(null);
  // Sign-out latch, owned here because this is where a sign-out is detected, and
  // RETURNED because the provider's two draft writers must honor it too. Owning it
  // here rather than taking it as an argument is not a style choice: the React
  // Compiler forbids mutating a hook argument, so a ref passed in could be read but
  // never set.
  const blockedAfterSignOutRef = useRef(false);
  useEffect(() => {
    if (!uid) {
      if (claimedUid.current !== null) {
        blockedAfterSignOutRef.current = true; // a real sign-out
        clearDraft(); // and their deck does not linger
        claimedUid.current = null;
      }
      return;
    }
    if (isLoading || blockedAfterSignOutRef.current) return; // wait for the card DB; never after a sign-out
    if (claimedUid.current === uid) return; // already handled this uid this session
    claimedUid.current = uid;
    if (hasMigratedDraft(uid)) return; // migrated in a prior session
    const snapshot = latestDeck.current;
    if (snapshot.cards.length === 0) return; // empty pre-sign-in draft: nothing to preserve
    void upsertDeck({...snapshot, ownerId: uid}, uid).then(({error}) => {
      if (error) return;
      markDraftMigrated(uid);
      writeDirty(false); // the draft IS in the cloud now; do not keep nagging
    });
  }, [uid, isLoading, latestDeck]);

  return blockedAfterSignOutRef;
}

export function DeckProvider({children}: {children: ReactNode}) {
  const {getCardById, isLoading} = useCardDataContext();
  const {user} = useSession();
  const [deck, setDeck] = useState<Deck>(loadOrCreateDraft);
  // Seeded from storage so a reload doesn't forget that the draft owes the cloud a save.
  const [isDirty, setIsDirty] = useState<boolean>(readDirty);

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

  // Once a sign-out is seen, this page instance must NEVER write the departed user's
  // deck back to storage. Both writers below honor it, and both have to: clearDraft()
  // on sign-out is undone by either the debounced persist (it re-fires whenever
  // getCardById's identity changes) or the teardown flush (pagehide and unmount).
  // Suppressing only one leaves the other handing the deck to the next person on a
  // shared browser. Declared here, above both writers, so neither can be added later
  // without seeing it.
  const blockedAfterSignOutRef = useFirstSignInMigration(user?.id ?? null, isLoading, latestDeck);

  // Persist (debounced). Recomputed from stable inputs so the deps stay referentially
  // stable (no per-render churn) yet it re-fires on an edit or once the DB resolves.
  useEffect(() => {
    if (blockedAfterSignOutRef.current) return; // never re-persist a departed user's deck
    const resolved = isLoading ? deck.inks : deriveInks(deck.cards, getCardById);
    const toPersist: Deck = inksEqual(resolved, deck.inks) ? deck : {...deck, inks: resolved};
    const handle = setTimeout(() => writeDraft(toPersist), DRAFT_WRITE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [deck, isLoading, getCardById, blockedAfterSignOutRef]);

  // Flush the pending draft on teardown so an edit made inside the debounce window is
  // never lost: on unmount (leaving the builder) and on pagehide (tab close / mobile
  // background). `writeDraft` is idempotent last-write-wins, so a redundant flush is cheap.
  useEffect(() => {
    const flush = () => {
      if (blockedAfterSignOutRef.current) return; // a sign-out already dropped it; do not resurrect
      writeDraft(latestDeck.current);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
    // The ref is stable, so this stays a mount-once effect; it is listed only to
    // satisfy exhaustive-deps, which cannot prove stability across a hook return.
  }, [blockedAfterSignOutRef]);

  // Mirror the flag to storage so it survives a reload. A write in an effect, NOT a
  // setState — the latter is banned here under the React Compiler.
  useEffect(() => {
    writeDirty(isDirty);
  }, [isDirty]);


  // Every mutation marks the draft dirty. Wrapped once here rather than at each
  // call site so a future mutation cannot silently skip it.
  const edit = (next: (d: Deck) => Deck) => {
    setDeck(next);
    setIsDirty(true);
  };

  const addCard = (cardId: string) => edit((d) => addCardToDeck(d, cardId, getCardById));

  const removeCard = (cardId: string) => edit((d) => removeCardFromDeck(d, cardId, getCardById));

  const setQuantity = (cardId: string, quantity: number) =>
    edit((d) => setCardQuantity(d, cardId, quantity, getCardById));

  const markCore = (cardId: string, isCore: boolean) => edit((d) => markCardCore(d, cardId, isCore));

  const setGameplan = (gameplan: Archetype | undefined) => edit((d) => setDeckGameplan(d, gameplan));

  const renameDeck = (name: string) => edit((d) => renameDeckName(d, name));

  const clearDeck = () => edit((d) => clearDeckCards(d));
  const replaceCards = (cards: DeckCard[]) => edit((d) => replaceDeckCards(d, cards, getCardById));

  // The three lifecycle ops all land a deck that matches the cloud, so each clears
  // the flag: `markSaved` binds the row the upsert just wrote, `loadDeck` adopts a
  // fetched one, and `startNewDeck` starts from nothing worth saving.
  const markSaved = (saved: Deck) => {
    setDeck(saved);
    setIsDirty(false);
  };

  const loadDeck = (incoming: Deck) => {
    setDeck(incoming);
    setIsDirty(false);
  };

  const startNewDeck = (visibility: 'private' | 'public') => {
    setDeck(createEmptyDraft(visibility === 'public'));
    setIsDirty(false);
  };

  const value: DeckContextValue = {
    deck: currentDeck,
    addCard,
    removeCard,
    setQuantity,
    markCore,
    setGameplan,
    renameDeck,
    clearDeck,
    replaceCards,
    isDirty,
    markSaved,
    loadDeck,
    startNewDeck,
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
