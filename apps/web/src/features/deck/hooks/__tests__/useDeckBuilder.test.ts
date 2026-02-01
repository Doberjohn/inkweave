import {renderHook, act} from '@testing-library/react';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {useDeckBuilder} from '../useDeckBuilder';
import {createCard} from '../../../../shared/test-utils/factories';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock alert
vi.stubGlobal('alert', vi.fn());

describe('useDeckBuilder', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should create an empty deck on first render', () => {
      const {result} = renderHook(() => useDeckBuilder());

      expect(result.current.deck.name).toBe('New Deck');
      expect(result.current.deck.cards).toEqual([]);
      expect(result.current.deck.id).toBeDefined();
    });

    it('should restore deck from localStorage if available', () => {
      const savedDeck = {
        id: 'saved-deck-1',
        name: 'Saved Deck',
        cards: [{card: createCard({id: 'card-1'}), quantity: 2}],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorageMock.setItem(
        'lorcana-synergy-finder-current-deck',
        JSON.stringify(savedDeck),
      );

      const {result} = renderHook(() => useDeckBuilder());

      expect(result.current.deck.id).toBe('saved-deck-1');
      expect(result.current.deck.name).toBe('Saved Deck');
      expect(result.current.deck.cards).toHaveLength(1);
    });
  });

  describe('addCard', () => {
    it('should add a new card to the deck', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1', name: 'Test Card'});

      act(() => {
        const added = result.current.addCard(card);
        expect(added).toBe(true);
      });

      expect(result.current.deck.cards).toHaveLength(1);
      expect(result.current.deck.cards[0].card.id).toBe('card-1');
      expect(result.current.deck.cards[0].quantity).toBe(1);
    });

    it('should increment quantity when adding existing card', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
        result.current.addCard(card);
      });

      expect(result.current.deck.cards).toHaveLength(1);
      expect(result.current.deck.cards[0].quantity).toBe(2);
    });

    it('should return false when card is at max copies (4)', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
        result.current.addCard(card);
        result.current.addCard(card);
        result.current.addCard(card);
      });

      expect(result.current.deck.cards[0].quantity).toBe(4);

      act(() => {
        const added = result.current.addCard(card);
        expect(added).toBe(false);
      });

      expect(result.current.deck.cards[0].quantity).toBe(4);
    });

    it('should return false when deck is full (60 cards)', () => {
      const {result} = renderHook(() => useDeckBuilder());

      // Add 15 different cards with 4 copies each = 60 cards
      act(() => {
        for (let i = 0; i < 15; i++) {
          const card = createCard({id: `card-${i}`});
          for (let j = 0; j < 4; j++) {
            result.current.addCard(card);
          }
        }
      });

      expect(result.current.deckStats.totalCards).toBe(60);

      // Try to add a new card
      const newCard = createCard({id: 'card-new'});
      act(() => {
        const added = result.current.addCard(newCard);
        expect(added).toBe(false);
      });

      expect(result.current.deckStats.totalCards).toBe(60);
    });
  });

  describe('removeCard', () => {
    it('should decrement quantity when removing card', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
        result.current.addCard(card);
      });

      expect(result.current.deck.cards[0].quantity).toBe(2);

      act(() => {
        result.current.removeCard('card-1');
      });

      expect(result.current.deck.cards[0].quantity).toBe(1);
    });

    it('should remove card entirely when quantity reaches 0', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
      });

      expect(result.current.deck.cards).toHaveLength(1);

      act(() => {
        result.current.removeCard('card-1');
      });

      expect(result.current.deck.cards).toHaveLength(0);
    });

    it('should do nothing when removing non-existent card', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
      });

      act(() => {
        result.current.removeCard('non-existent');
      });

      expect(result.current.deck.cards).toHaveLength(1);
    });
  });

  describe('removeAllCopies', () => {
    it('should remove all copies of a card', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
        result.current.addCard(card);
        result.current.addCard(card);
      });

      expect(result.current.deck.cards[0].quantity).toBe(3);

      act(() => {
        result.current.removeAllCopies('card-1');
      });

      expect(result.current.deck.cards).toHaveLength(0);
    });
  });

  describe('setQuantity', () => {
    it('should set exact quantity for a card', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
      });

      act(() => {
        result.current.setQuantity('card-1', 3);
      });

      expect(result.current.deck.cards[0].quantity).toBe(3);
    });

    it('should remove card when setting quantity to 0', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
        result.current.addCard(card);
      });

      act(() => {
        result.current.setQuantity('card-1', 0);
      });

      expect(result.current.deck.cards).toHaveLength(0);
    });

    it('should ignore invalid quantities (negative or > 4)', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
      });

      act(() => {
        result.current.setQuantity('card-1', -1);
      });

      expect(result.current.deck.cards[0].quantity).toBe(1);

      act(() => {
        result.current.setQuantity('card-1', 5);
      });

      expect(result.current.deck.cards[0].quantity).toBe(1);
    });
  });

  describe('getCardQuantity', () => {
    it('should return quantity of card in deck', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.addCard(card);
        result.current.addCard(card);
      });

      expect(result.current.getCardQuantity('card-1')).toBe(2);
    });

    it('should return 0 for card not in deck', () => {
      const {result} = renderHook(() => useDeckBuilder());

      expect(result.current.getCardQuantity('non-existent')).toBe(0);
    });
  });

  describe('clearDeck', () => {
    it('should remove all cards from deck', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.addCard(createCard({id: 'card-1'}));
        result.current.addCard(createCard({id: 'card-2'}));
      });

      expect(result.current.deck.cards).toHaveLength(2);

      act(() => {
        result.current.clearDeck();
      });

      expect(result.current.deck.cards).toHaveLength(0);
    });
  });

  describe('renameDeck', () => {
    it('should rename the deck', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.renameDeck('My Awesome Deck');
      });

      expect(result.current.deck.name).toBe('My Awesome Deck');
    });

    it('should use default name for empty string', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.renameDeck('');
      });

      expect(result.current.deck.name).toBe('Untitled Deck');
    });

    it('should trim whitespace from name', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.renameDeck('  My Deck  ');
      });

      expect(result.current.deck.name).toBe('My Deck');
    });
  });

  describe('newDeck', () => {
    it('should create a new empty deck', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const originalId = result.current.deck.id;

      act(() => {
        result.current.addCard(createCard({id: 'card-1'}));
        result.current.renameDeck('Test Deck');
      });

      act(() => {
        result.current.newDeck();
      });

      expect(result.current.deck.id).not.toBe(originalId);
      expect(result.current.deck.name).toBe('New Deck');
      expect(result.current.deck.cards).toHaveLength(0);
    });
  });

  describe('saveDeck / loadDeck / deleteSavedDeck / getSavedDecks', () => {
    it('should save and load a deck', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1'});

      act(() => {
        result.current.renameDeck('Saved Deck');
        result.current.addCard(card);
      });

      const deckId = result.current.deck.id;

      act(() => {
        const saved = result.current.saveDeck();
        expect(saved).toBe(true);
      });

      // Create new deck
      act(() => {
        result.current.newDeck();
      });

      expect(result.current.deck.id).not.toBe(deckId);

      // Load saved deck
      act(() => {
        const loaded = result.current.loadDeck(deckId);
        expect(loaded).toBe(true);
      });

      expect(result.current.deck.name).toBe('Saved Deck');
      expect(result.current.deck.cards).toHaveLength(1);
    });

    it('should return false when loading non-existent deck', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        const loaded = result.current.loadDeck('non-existent');
        expect(loaded).toBe(false);
      });
    });

    it('should get all saved decks', () => {
      const {result} = renderHook(() => useDeckBuilder());

      // Save first deck
      act(() => {
        result.current.renameDeck('First Deck');
      });

      act(() => {
        result.current.saveDeck();
      });

      const firstDeckId = result.current.deck.id;

      // Create new deck
      act(() => {
        result.current.newDeck();
      });

      // Ensure second deck has different ID
      expect(result.current.deck.id).not.toBe(firstDeckId);

      // Rename and save second deck
      act(() => {
        result.current.renameDeck('Second Deck');
      });

      act(() => {
        result.current.saveDeck();
      });

      const savedDecks = result.current.getSavedDecks();
      expect(savedDecks).toHaveLength(2);
      // Check both decks are present (order may vary based on timing)
      const deckNames = savedDecks.map((d) => d.name);
      expect(deckNames).toContain('First Deck');
      expect(deckNames).toContain('Second Deck');
    });

    it('should delete a saved deck', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.renameDeck('To Delete');
        result.current.saveDeck();
      });

      const deckId = result.current.deck.id;
      expect(result.current.getSavedDecks()).toHaveLength(1);

      act(() => {
        result.current.deleteSavedDeck(deckId);
      });

      expect(result.current.getSavedDecks()).toHaveLength(0);
    });
  });

  describe('exportDeck / importDeck', () => {
    it('should export deck as JSON', () => {
      const {result} = renderHook(() => useDeckBuilder());
      const card = createCard({id: 'card-1', name: 'Test Card'});

      act(() => {
        result.current.renameDeck('Export Test');
        result.current.addCard(card);
      });

      const exported = result.current.exportDeck();
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('Export Test');
      expect(parsed.cards).toHaveLength(1);
      expect(parsed.cards[0].card.name).toBe('Test Card');
    });

    it('should import valid deck JSON', () => {
      const {result} = renderHook(() => useDeckBuilder());

      const deckJson = JSON.stringify({
        id: 'imported-1',
        name: 'Imported Deck',
        cards: [
          {
            card: {
              id: 'card-1',
              name: 'Test Card',
              fullName: 'Test Card - Version',
              cost: 3,
              ink: 'Amber',
              inkwell: true,
              type: 'Character',
            },
            quantity: 2,
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      act(() => {
        const imported = result.current.importDeck(deckJson);
        expect(imported).toBe(true);
      });

      expect(result.current.deck.name).toBe('Imported Deck');
      expect(result.current.deck.cards).toHaveLength(1);
      expect(result.current.deck.cards[0].quantity).toBe(2);
    });

    it('should return false for invalid JSON', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        const imported = result.current.importDeck('not valid json');
        expect(imported).toBe(false);
      });
    });

    it('should return false for missing required fields', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        const imported = result.current.importDeck(JSON.stringify({name: 'No ID'}));
        expect(imported).toBe(false);
      });
    });

    it('should cap quantity at 4 per card', () => {
      const {result} = renderHook(() => useDeckBuilder());

      const deckJson = JSON.stringify({
        id: 'imported-1',
        name: 'Imported Deck',
        cards: [
          {
            card: {
              id: 'card-1',
              name: 'Test Card',
              cost: 3,
              ink: 'Amber',
              type: 'Character',
            },
            quantity: 10, // Exceeds max
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      act(() => {
        result.current.importDeck(deckJson);
      });

      expect(result.current.deck.cards[0].quantity).toBe(4);
    });

    it('should cap total cards at 60', () => {
      const {result} = renderHook(() => useDeckBuilder());

      const cards = [];
      for (let i = 0; i < 20; i++) {
        cards.push({
          card: {
            id: `card-${i}`,
            name: `Card ${i}`,
            cost: 3,
            ink: 'Amber',
            type: 'Character',
          },
          quantity: 4, // 20 * 4 = 80, exceeds 60
        });
      }

      const deckJson = JSON.stringify({
        id: 'imported-1',
        name: 'Imported Deck',
        cards,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      act(() => {
        result.current.importDeck(deckJson);
      });

      expect(result.current.deckStats.totalCards).toBe(60);
    });
  });

  describe('deckStats', () => {
    it('should calculate total cards correctly', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.addCard(createCard({id: 'card-1'}));
        result.current.addCard(createCard({id: 'card-1'}));
        result.current.addCard(createCard({id: 'card-2'}));
      });

      expect(result.current.deckStats.totalCards).toBe(3);
      expect(result.current.deckStats.uniqueCards).toBe(2);
    });

    it('should calculate ink distribution correctly', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.addCard(createCard({id: 'card-1', ink: 'Amber'}));
        result.current.addCard(createCard({id: 'card-1', ink: 'Amber'}));
        result.current.addCard(createCard({id: 'card-2', ink: 'Ruby'}));
      });

      expect(result.current.deckStats.inkDistribution.Amber).toBe(2);
      expect(result.current.deckStats.inkDistribution.Ruby).toBe(1);
      expect(result.current.deckStats.inkCount).toBe(2);
    });

    it('should calculate cost curve correctly', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.addCard(createCard({id: 'card-1', cost: 2}));
        result.current.addCard(createCard({id: 'card-2', cost: 2}));
        result.current.addCard(createCard({id: 'card-3', cost: 5}));
      });

      expect(result.current.deckStats.costCurve[2]).toBe(2);
      expect(result.current.deckStats.costCurve[5]).toBe(1);
    });

    it('should calculate type distribution correctly', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.addCard(createCard({id: 'card-1', type: 'Character'}));
        result.current.addCard(createCard({id: 'card-2', type: 'Character'}));
        result.current.addCard(createCard({id: 'card-3', type: 'Action'}));
      });

      expect(result.current.deckStats.typeDistribution.Character).toBe(2);
      expect(result.current.deckStats.typeDistribution.Action).toBe(1);
    });

    it('should validate deck with 60 cards and 2 inks', () => {
      const {result} = renderHook(() => useDeckBuilder());

      // Add 15 cards with 4 copies each (60 total), using 2 inks
      act(() => {
        for (let i = 0; i < 8; i++) {
          const card = createCard({id: `amber-${i}`, ink: 'Amber'});
          for (let j = 0; j < 4; j++) {
            result.current.addCard(card);
          }
        }
        for (let i = 0; i < 7; i++) {
          const card = createCard({id: `ruby-${i}`, ink: 'Ruby'});
          for (let j = 0; j < 4; j++) {
            result.current.addCard(card);
          }
        }
      });

      expect(result.current.deckStats.totalCards).toBe(60);
      expect(result.current.deckStats.inkCount).toBe(2);
      expect(result.current.deckStats.isValid).toBe(true);
      expect(result.current.deckStats.validationErrors).toHaveLength(0);
    });

    it('should report validation errors for 3+ inks', () => {
      const {result} = renderHook(() => useDeckBuilder());

      act(() => {
        result.current.addCard(createCard({id: 'card-1', ink: 'Amber'}));
        result.current.addCard(createCard({id: 'card-2', ink: 'Ruby'}));
        result.current.addCard(createCard({id: 'card-3', ink: 'Sapphire'}));
      });

      expect(result.current.deckStats.inkCount).toBe(3);
      expect(result.current.deckStats.validationErrors).toContain(
        'Deck has 3 inks (max 2 recommended)',
      );
    });
  });
});
