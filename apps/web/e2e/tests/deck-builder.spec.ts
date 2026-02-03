import { test, expect } from "../fixtures";
import { clearStoredDecks } from "../helpers/storage";

test.describe("Deck Builder", () => {
  // Skip on mobile - deck panel requires navigation
  test.beforeEach(async ({ page, appPage }, testInfo) => {
    if (testInfo.project.name === "mobile-chrome") {
      test.skip();
    }
    // Clear localStorage before each test
    await page.goto("/");
    await clearStoredDecks(page);
    await page.reload();
    await appPage.waitForCardsLoaded();
  });

  test("should add card to deck", async ({ cardListPage, deckPanelPage }) => {
    // Verify deck is empty initially
    expect(await deckPanelPage.isDeckEmpty()).toBe(true);

    // Find and add a card
    await cardListPage.filterByInk("Amber");
    await cardListPage.addFirstCardToDeck();

    // Verify card appears in deck
    const count = await deckPanelPage.getCardCount();
    expect(count).toBe(1);
    expect(await deckPanelPage.isDeckEmpty()).toBe(false);
  });

  test("should remove card from deck", async ({
    cardListPage,
    deckPanelPage,
  }) => {
    // Add a card first
    await cardListPage.filterByInk("Amber");
    await cardListPage.addFirstCardToDeck();

    // Verify card was added
    let count = await deckPanelPage.getCardCount();
    expect(count).toBe(1);

    // Get the card name that was added
    const cardNames = await deckPanelPage.getDeckCardNames();
    expect(cardNames.length).toBe(1);
    const cardName = cardNames[0];

    // Remove the card
    await deckPanelPage.decrementCard(cardName);

    // Verify deck is empty
    count = await deckPanelPage.getCardCount();
    expect(count).toBe(0);
  });

  test("should increment card quantity in deck", async ({
    cardListPage,
    deckPanelPage,
  }) => {
    // Add a card
    await cardListPage.filterByInk("Sapphire");
    await cardListPage.addFirstCardToDeck();

    // Initial count should be 1
    let count = await deckPanelPage.getCardCount();
    expect(count).toBe(1);

    // Get the card name that was added
    const cardNames = await deckPanelPage.getDeckCardNames();
    const cardName = cardNames[0];

    // Increment the card twice
    await deckPanelPage.incrementCard(cardName);
    await deckPanelPage.incrementCard(cardName);

    // Should now have 3 copies
    count = await deckPanelPage.getCardCount();
    expect(count).toBe(3);
  });

  test("should not exceed 4 copies of a card", async ({
    cardListPage,
    deckPanelPage,
    page,
  }) => {
    await cardListPage.filterByInk("Emerald");
    await cardListPage.filterByType("Character");

    // Add the first card to get its name
    await cardListPage.addFirstCardToDeck();
    let count = await deckPanelPage.getCardCount();
    expect(count).toBe(1);

    // Get the card name that was added
    const cardNames = await deckPanelPage.getDeckCardNames();
    const cardName = cardNames[0];

    // Try to increment to 4 copies using deck panel buttons
    await deckPanelPage.incrementCard(cardName);
    await deckPanelPage.incrementCard(cardName);
    await deckPanelPage.incrementCard(cardName);

    // Should now have 4 copies (max allowed)
    count = await deckPanelPage.getCardCount();
    expect(count).toBe(4);

    // Verify the increment button is hidden at max copies
    const addButton = page.getByLabel(
      new RegExp(`Add one copy of ${cardName}`, "i")
    );
    await expect(addButton).toBeHidden();
  });

  test("should show deck card count badge", async ({
    cardListPage,
    deckPanelPage,
  }) => {
    // Initially should show 0/60
    await expect(deckPanelPage.cardCountBadge).toContainText("0/60");

    // Add a card
    await cardListPage.filterByInk("Ruby");
    await cardListPage.addFirstCardToDeck();

    // Badge should update
    const count = await deckPanelPage.getCardCount();
    expect(count).toBe(1);
    await expect(deckPanelPage.cardCountBadge).toContainText("1/60");
  });

  test("should warn about 3+ ink colors", async ({
    cardListPage,
    deckPanelPage,
    page,
  }) => {
    // Add a card of each ink color (first Amber, then Sapphire, then Ruby)
    await cardListPage.filterByInk("Amber");
    await cardListPage.addFirstCardToDeck();
    await page.waitForTimeout(100);

    await cardListPage.filterByInk("Sapphire");
    await cardListPage.addFirstCardToDeck();
    await page.waitForTimeout(100);

    await cardListPage.filterByInk("Ruby");
    await cardListPage.addFirstCardToDeck();
    await page.waitForTimeout(100);

    // Should show ink warning
    const hasWarning = await deckPanelPage.hasInkWarning();
    expect(hasWarning).toBe(true);
    await expect(deckPanelPage.inkWarning).toContainText("3 ink colors");
  });
});
