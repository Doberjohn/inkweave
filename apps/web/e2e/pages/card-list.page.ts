import {Page, Locator} from '@playwright/test';

export class CardListPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly moreFiltersToggle: Locator;
  readonly clearFiltersButton: Locator;
  readonly cardCountText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Search cards...');
    this.moreFiltersToggle = page.getByRole('button', {
      name: /More filters/,
    });
    this.clearFiltersButton = page.getByRole('button', {
      name: 'Clear all filters',
    });
    this.cardCountText = page.getByText(/\d+ of \d+ cards/);
  }

  getInkFilterButton(ink: string): Locator {
    return this.page.getByRole('button', {name: ink, exact: true});
  }

  getTypeFilterButton(type: string): Locator {
    return this.page.getByRole('button', {name: type, exact: true});
  }

  getCostFilterButton(cost: number): Locator {
    const label = cost >= 9 ? '9+' : String(cost);
    return this.page.getByRole('button', {name: label, exact: true});
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

  async filterByCost(cost: number) {
    await this.getCostFilterButton(cost).click();
    await this.page.waitForTimeout(100);
  }

  async expandMoreFilters() {
    const isExpanded = await this.page
      .getByText(/More filters/)
      .locator('span')
      .first()
      .evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.transform.includes('90');
      })
      .catch(() => false);

    if (!isExpanded) {
      await this.moreFiltersToggle.click();
      await this.page.waitForTimeout(100);
    }
  }

  async filterByKeyword(keyword: string) {
    await this.expandMoreFilters();
    const keywordSelect = this.page.locator('select').filter({hasText: /Any keyword/});
    await keywordSelect.selectOption(keyword);
    await this.page.waitForTimeout(100);
  }

  async filterBySet(setName: string) {
    await this.expandMoreFilters();
    const setSelect = this.page.locator('select').filter({hasText: /Any set/});
    await setSelect.selectOption({label: setName});
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
   * Get all visible card tiles via stable data-testid selector
   */
  getAllCardTiles(): Locator {
    return this.page.getByTestId('card-tile');
  }

  /**
   * Get a card tile by zero-based index
   */
  getCardTileByIndex(index: number): Locator {
    return this.getAllCardTiles().nth(index);
  }

  async selectCardByIndex(index: number) {
    await this.getCardTileByIndex(index).click();
    await this.page.waitForTimeout(100);
  }

  async getDisplayedCardCount(): Promise<{shown: number; total: number}> {
    const text = await this.cardCountText.textContent();
    const match = text?.match(/(\d+) of (\d+)/);
    if (match) {
      return {shown: parseInt(match[1], 10), total: parseInt(match[2], 10)};
    }
    return {shown: 0, total: 0};
  }

  async isCardTileVisible(index: number): Promise<boolean> {
    return await this.getCardTileByIndex(index)
      .isVisible()
      .catch(() => false);
  }

  /**
   * Get count of visible card tiles
   */
  async getVisibleCardCount(): Promise<number> {
    return await this.getAllCardTiles().count();
  }
}
