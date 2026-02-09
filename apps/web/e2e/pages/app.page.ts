import type {Locator, Page} from '@playwright/test';

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

  // Home state elements
  readonly heroSection: Locator;
  readonly heroSearch: Locator;
  readonly featuredCards: Locator;
  readonly etherealBackground: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator('header');
    this.desktopCardCountText = page.getByText(/\d+ cards loaded/);
    this.mobileCardCountText = page.getByText(/\d+ of \d+ cards/);
    this.loadingSpinner = page.locator('[role="status"]');
    this.searchInput = page.getByPlaceholder('Search cards...');
    this.errorMessage = page.getByText('Error loading cards');
    this.retryButton = page.getByRole('button', {name: 'Try Again'});

    // Home state elements
    this.heroSection = page.getByTestId('hero-section');
    this.heroSearch = page.getByTestId('hero-search');
    this.featuredCards = page.getByTestId('featured-cards');
    this.etherealBackground = page.getByTestId('ethereal-background');
  }

  async goto() {
    await this.page.goto('/');
    await this.waitForCardsLoaded();
  }

  /**
   * Wait for cards to be loaded - works for both desktop and mobile
   */
  async waitForCardsLoaded() {
    // Wait for the hero search input to be visible - this indicates the app is ready
    // Both desktop and mobile home show the hero search after cards load
    await this.heroSearch.waitFor({state: 'visible', timeout: 30000});
    // Give a small delay for the UI to stabilize
    await this.page.waitForTimeout(100);
  }

  /**
   * Navigate to card-selected state by clicking a featured card.
   * This transitions from the home hero view to the card-selected layout.
   * Desktop: CompactHeader + 3-column layout
   * Mobile: SynergyResults full screen
   */
  async selectFeaturedCard() {
    const firstCard = this.featuredCards.locator('button[aria-pressed]').first();
    await firstCard.click();
    // Wait for hero to disappear (transition to card-selected state)
    await this.heroSection.waitFor({state: 'hidden', timeout: 10000});
    await this.page.waitForTimeout(100);
  }
}
