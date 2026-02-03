import { Page } from "@playwright/test";

const STORAGE_KEY_DECKS = "lorcana-synergy-finder-decks";
const STORAGE_KEY_CURRENT = "lorcana-synergy-finder-current-deck";

/**
 * Clear all stored deck data from localStorage
 */
export async function clearStoredDecks(page: Page): Promise<void> {
  await page.evaluate(
    ([decksKey, currentKey]) => {
      localStorage.removeItem(decksKey);
      localStorage.removeItem(currentKey);
    },
    [STORAGE_KEY_DECKS, STORAGE_KEY_CURRENT]
  );
}

/**
 * Seed localStorage with a saved deck
 */
export async function seedSavedDeck(
  page: Page,
  deck: {
    id: string;
    name: string;
    cards: Array<{
      card: {
        id: string;
        name: string;
        fullName: string;
        cost: number;
        ink: string;
        type: string;
      };
      quantity: number;
    }>;
  }
): Promise<void> {
  const fullDeck = {
    ...deck,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await page.evaluate(
    ([key, deckData]) => {
      const existingDecks = JSON.parse(localStorage.getItem(key) || "[]");
      existingDecks.push(deckData);
      localStorage.setItem(key, JSON.stringify(existingDecks));
    },
    [STORAGE_KEY_DECKS, fullDeck]
  );
}

/**
 * Set the current working deck in localStorage
 */
export async function setCurrentDeck(
  page: Page,
  deck: {
    id: string;
    name: string;
    cards: Array<{
      card: {
        id: string;
        name: string;
        fullName: string;
        cost: number;
        ink: string;
        type: string;
      };
      quantity: number;
    }>;
  }
): Promise<void> {
  const fullDeck = {
    ...deck,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await page.evaluate(
    ([key, deckData]) => {
      localStorage.setItem(key, JSON.stringify(deckData));
    },
    [STORAGE_KEY_CURRENT, fullDeck]
  );
}

/**
 * Get the current deck from localStorage
 */
export async function getCurrentDeck(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }, STORAGE_KEY_CURRENT);
}

/**
 * Get all saved decks from localStorage
 */
export async function getSavedDecks(page: Page): Promise<unknown[]> {
  return page.evaluate((key) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }, STORAGE_KEY_DECKS);
}
