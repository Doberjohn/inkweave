import { Page, Locator } from "@playwright/test";

export class DeckPanelPage {
  readonly page: Page;
  readonly deckNameButton: Locator;
  readonly cardCountBadge: Locator;
  readonly emptyState: Locator;
  readonly inkWarning: Locator;
  readonly actionButtons: {
    new: Locator;
    save: Locator;
    load: Locator;
    export: Locator;
    import: Locator;
    clear: Locator;
  };
  readonly savedDecksModal: Locator;
  readonly fileInput: Locator;

  constructor(page: Page) {
    this.page = page;
    // The deck name button has title "Click to rename"
    this.deckNameButton = page.getByTitle("Click to rename");
    // Card count badge shows X/60 - use first span that matches
    this.cardCountBadge = page.locator("span").filter({ hasText: /^\d+\/60$/ }).first();
    this.emptyState = page.getByText("No cards in deck");
    // Ink warning shows "X ink colors (2 recommended)"
    this.inkWarning = page.getByRole("alert").filter({ hasText: /ink colors/ });
    this.savedDecksModal = page.getByRole("dialog");
    this.fileInput = page.locator('input[type="file"]');

    this.actionButtons = {
      new: page.getByTitle("New deck"),
      save: page.getByTitle("Save deck"),
      load: page.getByTitle("Load saved deck"),
      export: page.getByTitle("Export as JSON"),
      import: page.getByTitle("Import from JSON"),
      clear: page.getByTitle("Clear all cards"),
    };
  }

  async getDeckName(): Promise<string> {
    const text = await this.deckNameButton.textContent();
    return text?.trim() ?? "New Deck";
  }

  async renameDeck(newName: string) {
    await this.deckNameButton.click();
    // Wait for input to appear and get focus
    await this.page.waitForTimeout(100);
    // The deck name input appears in the deck panel (not the search input)
    // It's autofocused, so we can use the focused element
    const input = this.page.locator("input:focus");
    await input.fill(newName);
    await input.press("Enter");
    await this.page.waitForTimeout(100);
  }

  async getCardCount(): Promise<number> {
    const text = await this.cardCountBadge.textContent();
    const match = text?.match(/(\d+)\/60/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get a deck card row by card name
   * Uses the aria-label on buttons to find the row
   */
  getDeckCardRow(cardName: string): Locator {
    // The row contains buttons with aria-labels referencing the card name
    return this.page
      .locator("div")
      .filter({
        has: this.page.getByLabel(new RegExp(`copy of ${cardName}`, "i")),
      })
      .first();
  }

  async incrementCard(cardName: string) {
    const addButton = this.page.getByLabel(
      new RegExp(`Add one copy of ${cardName}`, "i")
    );
    await addButton.click();
  }

  async decrementCard(cardName: string) {
    const removeButton = this.page.getByLabel(
      new RegExp(`Remove one copy of ${cardName}`, "i")
    );
    await removeButton.click();
  }

  async removeAllCopies(cardName: string) {
    const removeAllButton = this.page.getByLabel(
      new RegExp(`Remove all copies of ${cardName}`, "i")
    );
    await removeAllButton.click();
  }

  async saveDeck() {
    await this.actionButtons.save.click();
    await this.page.waitForTimeout(100);
  }

  async openLoadModal() {
    await this.actionButtons.load.click();
    await this.savedDecksModal.waitFor({ state: "visible" });
  }

  async loadDeck(deckName: string) {
    await this.openLoadModal();
    // Find the Load button in the row that contains the deck name
    // The deck name is in a nested div, so find the button that's near it
    const loadButton = this.savedDecksModal
      .locator("div")
      .filter({ hasText: deckName })
      .getByRole("button", { name: "Load" });
    await loadButton.click();
    await this.page.waitForTimeout(100);
  }

  async clearDeck() {
    // Set up dialog handler before clicking
    this.page.once("dialog", (dialog) => dialog.accept());
    await this.actionButtons.clear.click();
    await this.page.waitForTimeout(100);
  }

  async exportDeck(): Promise<string> {
    const downloadPromise = this.page.waitForEvent("download");
    await this.actionButtons.export.click();
    const download = await downloadPromise;
    return download.suggestedFilename();
  }

  async importDeck(deckJson: string) {
    // Create a buffer from the JSON string
    const buffer = Buffer.from(deckJson, "utf-8");

    await this.fileInput.setInputFiles({
      name: "deck.json",
      mimeType: "application/json",
      buffer: buffer,
    });
    await this.page.waitForTimeout(100);
  }

  async newDeck() {
    await this.actionButtons.new.click();
    await this.page.waitForTimeout(100);
  }

  async isDeckEmpty(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  async hasInkWarning(): Promise<boolean> {
    return await this.inkWarning.isVisible();
  }

  /**
   * Get names of cards currently in deck
   */
  async getDeckCardNames(): Promise<string[]> {
    const removeButtons = this.page.getByLabel(/Remove all copies of .* from deck/i);
    const count = await removeButtons.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const label = await removeButtons.nth(i).getAttribute("aria-label");
      const match = label?.match(/Remove all copies of (.*) from deck/i);
      if (match) {
        names.push(match[1]);
      }
    }
    return names;
  }
}
