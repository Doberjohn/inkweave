// Public surface of the deck-builder state layer (#465).
export {DeckProvider, useDeck} from './DeckContext';
export {
  readDraft,
  writeDraft,
  clearDraft,
  hasMigratedDraft,
  markDraftMigrated,
  DRAFT_KEY,
} from './deckStorage';
// Cloud persistence (#464).
export {
  listDecks,
  listPublicDecks,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  upsertDeck,
  type RepoResult,
} from './deckRepository';
