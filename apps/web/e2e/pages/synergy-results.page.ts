import {Page, Locator, expect} from '@playwright/test';

export class SynergyResultsPage {
  readonly page: Page;
  readonly emptyState: Locator;
  readonly clearSelectionButton: Locator;
  readonly synergyCountText: Locator;
  readonly noSynergiesMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emptyState = page.getByText('Select a card to see synergies');
    this.clearSelectionButton = page.getByLabel(/return to home|back to home|go to home page/i);
    this.synergyCountText = page.getByTestId('synergy-header');
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
    // Header renders "Synergies" + count as adjacent spans, text is "SynergiesN"
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async clearSelection() {
    await this.clearSelectionButton.click();
    await this.page.waitForTimeout(100);
  }

  getSelectedCardDetail(): Locator {
    // The card detail panel shows the selected card's info
    return this.page.getByTestId('card-detail-panel');
  }

  getSynergyGroup(type: string): Locator {
    return this.page.locator('div').filter({hasText: new RegExp(type, 'i')});
  }

  /** Wait for synergy data to finish loading (synergies loaded, empty, or error).
   *  Uses the "Synergies" heading which exists on both desktop and mobile layouts. */
  async waitForSynergiesLoaded(): Promise<void> {
    await expect(
      this.page
        .getByRole('heading', {name: 'Synergies'})
        .or(this.noSynergiesMessage)
        .or(this.page.getByRole('alert')),
    ).toBeVisible({timeout: 10000});
  }

  /** Get a synergy group container by its group key (e.g. "shift-targets", "discard") */
  getSynergyGroupByKey(groupKey: string): Locator {
    return this.page.locator(`[data-group-key="${groupKey}"]`);
  }

  /** Get all synergy card tiles within a specific synergy group */
  getGroupCardTiles(groupKey: string): Locator {
    return this.getSynergyGroupByKey(groupKey).locator('button.card-tile');
  }

  /** Get the "+N more" tile within a specific synergy group */
  getMoreTile(groupKey: string): Locator {
    return this.getSynergyGroupByKey(groupKey).getByTestId('more-tile');
  }

  /** Get the synergy detail modal */
  getDetailModal(): Locator {
    return this.page.getByTestId('synergy-detail-modal');
  }

  /** Get the CTA button inside the synergy detail modal */
  getDetailModalCTA(): Locator {
    return this.page.getByTestId('synergy-detail-cta');
  }

  /** Close the synergy detail modal by clicking the backdrop */
  async closeDetailModalBackdrop(): Promise<void> {
    await this.page.getByTestId('synergy-detail-backdrop').click({position: {x: 5, y: 5}});
    await this.page.waitForTimeout(200);
  }
}
