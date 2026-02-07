import {Page, Locator} from '@playwright/test';

export class AppPage {
  readonly page: Page;
  readonly header: Locator;
  // Desktop header shows card count like "123 cards loaded"
  readonly desktopCardCountText: Locator;
  // Mobile card list shows count like "50 of 123 cards"
  readonly mobileCardCountText: Locator;
  readonly loadingSpinner: Locator;
  readonly searchInput: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator('header');
    this.desktopCardCountText = page.getByText(/\d+ cards loaded/);
    this.mobileCardCountText = page.getByText(/\d+ of \d+ cards/);
    this.loadingSpinner = page.locator('[role="status"]');
    this.searchInput = page.getByPlaceholder('Search cards...');
    this.errorMessage = page.getByText('Error loading cards');
    this.retryButton = page.getByRole('button', {name: 'Try Again'});
  }

  async goto() {
    await this.page.goto('/');
    await this.waitForCardsLoaded();
  }

  /**
   * Wait for cards to be loaded - works for both desktop and mobile
   */
  async waitForCardsLoaded() {
    // Wait for the search input to be visible - this indicates the app is ready
    // Both desktop and mobile show the search input after cards load
    await this.searchInput.waitFor({state: 'visible', timeout: 30000});
    // Give a small delay for the UI to stabilize
    await this.page.waitForTimeout(100);
  }

  /**
   * Check if in mobile viewport based on mobile nav visibility
   */
  async isMobileViewport(): Promise<boolean> {
    const mobileNav = this.page.locator('nav');
    return await mobileNav.isVisible().catch(() => false);
  }
}
