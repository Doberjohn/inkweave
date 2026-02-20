import {Page, Locator} from '@playwright/test';

export class SynergyResultsPage {
  readonly page: Page;
  readonly emptyState: Locator;
  readonly clearSelectionButton: Locator;
  readonly synergyCountText: Locator;
  readonly noSynergiesMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emptyState = page.getByText('Select a card to see synergies');
    this.clearSelectionButton = page.getByRole('button', {name: /×|clear|back to home|inkweave/i});
    this.synergyCountText = page.getByText(/Found \d+ synergistic cards/);
    this.noSynergiesMessage = page.getByText('No synergies found for this card');
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  async hasSynergies(): Promise<boolean> {
    return await this.synergyCountText.isVisible();
  }

  async getSynergyCount(): Promise<number> {
    const text = await this.synergyCountText.textContent();
    const match = text?.match(/Found (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async clearSelection() {
    await this.clearSelectionButton.click();
    await this.page.waitForTimeout(100);
  }

  getSelectedCardDetail(): Locator {
    // The card detail section shows the selected card's info
    return this.page
      .locator('div')
      .filter({hasText: /Clear selection|×|INKWEAVE/})
      .first();
  }

  getSynergyGroup(type: string): Locator {
    return this.page.locator('div').filter({hasText: new RegExp(type, 'i')});
  }
}
