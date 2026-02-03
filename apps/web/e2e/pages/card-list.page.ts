import { Page, Locator } from "@playwright/test";

export class CardListPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly moreFiltersToggle: Locator;
  readonly clearFiltersButton: Locator;
  readonly cardCountText: Locator;
  readonly cardList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder("Search cards...");
    this.moreFiltersToggle = page.getByRole("button", {
      name: /More filters/,
    });
    this.clearFiltersButton = page.getByRole("button", {
      name: "Clear all filters",
    });
    this.cardCountText = page.getByText(/\d+ of \d+ cards/);
    this.cardList = page.locator('[style*="flex-direction: column"]').first();
  }

  getInkFilterButton(ink: string): Locator {
    if (ink.toLowerCase() === "all") {
      // First "All" button is for ink filter
      return this.page.getByRole("button", { name: "All" }).first();
    }
    return this.page.getByRole("button", { name: ink, exact: true });
  }

  getTypeFilterButton(type: string): Locator {
    if (type.toLowerCase() === "all") {
      // Second "All" button is for type filter
      return this.page.getByRole("button", { name: "All" }).nth(1);
    }
    return this.page.getByRole("button", { name: type, exact: true });
  }

  async searchFor(query: string) {
    await this.searchInput.fill(query);
    // Wait for filtering to complete
    await this.page.waitForTimeout(150);
  }

  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(150);
  }

  async filterByInk(ink: string) {
    await this.getInkFilterButton(ink).click();
    await this.page.waitForTimeout(100);
  }

  async filterByType(type: string) {
    await this.getTypeFilterButton(type).click();
    await this.page.waitForTimeout(100);
  }

  async expandMoreFilters() {
    const isExpanded = await this.page
      .getByText(/More filters/)
      .locator("span")
      .first()
      .evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.transform.includes("90");
      })
      .catch(() => false);

    if (!isExpanded) {
      await this.moreFiltersToggle.click();
      await this.page.waitForTimeout(100);
    }
  }

  async filterByKeyword(keyword: string) {
    await this.expandMoreFilters();
    const keywordSelect = this.page
      .locator("select")
      .filter({ hasText: /Any keyword/ });
    await keywordSelect.selectOption(keyword);
    await this.page.waitForTimeout(100);
  }

  async filterBySet(setName: string) {
    await this.expandMoreFilters();
    const setSelect = this.page.locator("select").filter({ hasText: /Any set/ });
    await setSelect.selectOption({ label: setName });
    await this.page.waitForTimeout(100);
  }

  async clearAllFilters() {
    const clearBtn = this.clearFiltersButton;
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Get a card tile by card name (partial match)
   * Card tiles are buttons with aria-pressed attribute
   */
  getCardTile(cardName: string): Locator {
    return this.page
      .locator("button[aria-pressed]")
      .filter({ hasText: new RegExp(cardName, "i") })
      .first();
  }

  /**
   * Get all visible card tiles
   */
  getAllCardTiles(): Locator {
    return this.page.locator("button[aria-pressed]");
  }

  async selectCard(cardName: string) {
    const card = this.getCardTile(cardName);
    await card.click();
    await this.page.waitForTimeout(100);
  }

  /**
   * Add a card to deck using the add button
   * The add button has aria-label containing "Add {cardName} to deck"
   */
  async addCardToDeck(cardName: string) {
    // Find the add button by its aria-label
    const addButton = this.page.getByLabel(
      new RegExp(`Add.*${cardName}.*to deck`, "i")
    );
    await addButton.first().click();
  }

  /**
   * Add first visible card to deck
   */
  async addFirstCardToDeck() {
    const addButton = this.page.getByLabel(/Add .* to deck/i).first();
    await addButton.click();
  }

  async getDisplayedCardCount(): Promise<{ shown: number; total: number }> {
    const text = await this.cardCountText.textContent();
    const match = text?.match(/(\d+) of (\d+)/);
    if (match) {
      return { shown: parseInt(match[1], 10), total: parseInt(match[2], 10) };
    }
    return { shown: 0, total: 0 };
  }

  async isCardVisible(cardName: string): Promise<boolean> {
    const card = this.getCardTile(cardName);
    return await card.isVisible().catch(() => false);
  }

  /**
   * Get count of visible card tiles
   */
  async getVisibleCardCount(): Promise<number> {
    return await this.getAllCardTiles().count();
  }
}
