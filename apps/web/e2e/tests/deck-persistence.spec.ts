import {test, expect} from '../fixtures';
import {clearStoredDecks} from '../helpers/storage';

test.describe('Deck Persistence', () => {
  // Skip on mobile - deck panel requires navigation
  test.beforeEach(async ({page, appPage}, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip();
    }
    // Clear localStorage before each test
    await page.goto('/');
    await clearStoredDecks(page);
    await page.reload();
    await appPage.waitForCardsLoaded();
  });

  test('should save and load a deck', async ({cardListPage, deckPanelPage}) => {
    // Build a deck
    await cardListPage.filterByInk('Amber');
    await cardListPage.addFirstCardToDeck();

    // Rename the deck
    await deckPanelPage.renameDeck('My Test Deck');

    // Save the deck
    await deckPanelPage.saveDeck();

    // Create new deck
    await deckPanelPage.newDeck();
    expect(await deckPanelPage.isDeckEmpty()).toBe(true);

    // Load saved deck
    await deckPanelPage.loadDeck('My Test Deck');

    // Verify deck loaded
    const count = await deckPanelPage.getCardCount();
    expect(count).toBe(1);
  });

  test('should export deck as JSON', async ({cardListPage, deckPanelPage}) => {
    // Build a deck
    await cardListPage.filterByInk('Sapphire');
    await cardListPage.addFirstCardToDeck();

    // Rename for recognizable filename
    await deckPanelPage.renameDeck('Export Test Deck');

    // Export the deck
    const filename = await deckPanelPage.exportDeck();
    expect(filename).toContain('.json');
    expect(filename).toContain('Export-Test-Deck');
  });

  test('should import deck from JSON', async ({deckPanelPage, page}) => {
    // Prepare a valid deck JSON
    const deckJson = JSON.stringify({
      id: 'test-import-1',
      name: 'Imported Deck',
      cards: [
        {
          card: {
            id: 'card-test-1',
            name: 'Test Card',
            fullName: 'Test Card - Imported',
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

    // Import the deck
    await deckPanelPage.importDeck(deckJson);

    // Verify import - deck name should update
    await expect(page.getByText('Imported Deck')).toBeVisible();
  });

  test('should persist current deck across page reload', async ({
    cardListPage,
    deckPanelPage,
    page,
    appPage,
  }) => {
    // Build a deck
    await cardListPage.filterByInk('Emerald');
    await cardListPage.addFirstCardToDeck();

    const countBefore = await deckPanelPage.getCardCount();
    expect(countBefore).toBe(1);

    // Reload the page
    await page.reload();
    await appPage.waitForCardsLoaded();

    // Deck should still be there
    const countAfter = await deckPanelPage.getCardCount();
    expect(countAfter).toBe(1);
  });

  test('should clear deck', async ({cardListPage, deckPanelPage}) => {
    // Build a deck
    await cardListPage.filterByInk('Steel');
    await cardListPage.addFirstCardToDeck();
    await cardListPage.addFirstCardToDeck();

    const countBefore = await deckPanelPage.getCardCount();
    expect(countBefore).toBeGreaterThan(0);

    // Clear the deck
    await deckPanelPage.clearDeck();

    // Deck should be empty
    expect(await deckPanelPage.isDeckEmpty()).toBe(true);
  });

  test('should rename deck', async ({deckPanelPage}) => {
    // Default name should be "New Deck"
    const initialName = await deckPanelPage.getDeckName();
    expect(initialName).toBe('New Deck');

    // Rename the deck
    await deckPanelPage.renameDeck('My Custom Deck Name');

    // Verify new name
    const newName = await deckPanelPage.getDeckName();
    expect(newName).toBe('My Custom Deck Name');
  });
});
