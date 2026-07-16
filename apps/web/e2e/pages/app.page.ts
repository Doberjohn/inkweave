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

  // Card overview modal — opens globally when a card tile is clicked (home featured, Browse grid).
  // Note: /card/:id is a real page now (issue #486), no longer a modal shortcut.
  readonly cardOverviewModal: Locator;
  readonly cardOverviewBackdrop: Locator;

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

    // Card modal
    this.cardOverviewModal = page.getByTestId('card-overview-modal');
    this.cardOverviewBackdrop = page.getByTestId('card-overview-backdrop');
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
   * Click a featured card — opens the global CardOverviewModal. URL stays at `/` since the
   * modal is overlay-style (mounted by CardModalProvider, not a route). Hero remains in the
   * DOM behind the backdrop.
   */
  async selectFeaturedCard() {
    const firstCard = this.featuredCards.getByTestId('card-tile').first();
    await firstCard.click();
    await this.cardOverviewModal.waitFor({state: 'visible', timeout: 10000});
    await this.page.waitForTimeout(100);
  }

  /**
   * Open the global CardOverviewModal for a SPECIFIC card via the Browse UI.
   *
   * The old `/card/:id`-opens-the-modal shortcut is gone — that route renders a real, crawlable
   * page now (issue #486) — so specs that need the modal on a chosen card drive it through Browse:
   * filter the grid to the card with `?q=` (URL param works on both desktop and mobile; the inline
   * search box is desktop-only), then click the first matching tile. `query` should uniquely
   * identify the card — pass its fullName (see `cardFullNameById`).
   */
  async openCardOverview(query: string) {
    await this.page.goto(`/browse?q=${encodeURIComponent(query)}`);
    const firstTile = this.page.getByTestId('card-tile').first();
    await firstTile.waitFor({state: 'visible', timeout: 30000});
    await firstTile.click();
    await this.cardOverviewModal.waitFor({state: 'visible', timeout: 10000});
    await this.page.waitForTimeout(100);
  }
}
