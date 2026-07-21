import {expect, type Page, type Locator} from '@playwright/test';

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
    // The card overview modal contains the selected card's info (replaces the old card-detail-panel
    // after the modal redesign — see #320).
    return this.page.getByTestId('card-overview-modal');
  }

  getSynergyGroup(type: string): Locator {
    return this.page.locator('div').filter({hasText: new RegExp(type, 'i')});
  }

  /** Wait for synergy data to finish loading inside the CardOverviewModal — chips, empty
   *  state, or error all signal "load done". The modal renders synergies in a
   *  `<section aria-label="Synergies">` along with chip filter buttons. */
  async waitForSynergiesLoaded(): Promise<void> {
    const modal = this.page.getByTestId('card-overview-modal');
    const hasChips = modal.getByRole('button', {name: /\d+ cards/i});
    const noSynergies = modal.getByText('No synergies yet');
    const errorBanner = this.page.getByRole('alert');
    await expect(hasChips.first().or(noSynergies).or(errorBanner)).toBeVisible({timeout: 10000});
  }

  /** Get a synergy group container by its group key (e.g. "shift-targets", "discard") */
  getSynergyGroupByKey(groupKey: string): Locator {
    return this.page.locator(`[data-group-key="${groupKey}"]`);
  }

  /** Get all synergy card tiles within a specific synergy group */
  getGroupCardTiles(groupKey: string): Locator {
    // SynergyCard renders a crawlable <a> now (issue #486), not a <button>.
    return this.getSynergyGroupByKey(groupKey).locator('a.card-tile');
  }

  /** Get the "+N more" tile within a specific synergy group */
  getMoreTile(groupKey: string): Locator {
    return this.getSynergyGroupByKey(groupKey).getByTestId('more-tile');
  }
}
