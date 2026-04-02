import type {Locator, Page} from '@playwright/test';

export class VotePage {
  readonly page: Page;
  readonly scoreButtons: Locator;
  readonly skipButton: Locator;
  readonly scorePicker: Locator;
  readonly toastNotification: Locator;
  readonly undoButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scorePicker = page.getByRole('radiogroup', {name: 'Synergy score'});
    this.scoreButtons = page.getByRole('radio');
    this.skipButton = page.getByRole('button', {name: /Skip this pair/});
    this.toastNotification = page.locator('[role="status"][aria-live="polite"]');
    this.undoButton = page.getByRole('button', {name: 'Undo'});
  }

  async goto() {
    await this.page.goto('/vote');
    await this.waitForPairLoaded();
  }

  /** Wait for a pair to be displayed — score picker visible means pair data loaded. */
  async waitForPairLoaded() {
    await this.scorePicker.waitFor({state: 'visible', timeout: 15000});
    await this.page.waitForTimeout(200);
  }

  /** Get all card images currently displayed in the pair. */
  getCardImages() {
    return this.page.locator('main img[alt]');
  }

  /** Click a specific score button (1-10). Uses exact match to avoid Score 1 / Score 10 collision. */
  async clickScore(score: number) {
    await this.page.getByRole('radio', {name: `Score ${score}`, exact: true}).click();
  }

  /** Get a specific score button by value. */
  getScoreButton(score: number) {
    return this.page.getByRole('radio', {name: `Score ${score}`, exact: true});
  }

  /** Press a keyboard shortcut key. */
  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }

  /** Wait for toast to appear after voting. */
  async waitForToast() {
    await this.toastNotification.waitFor({state: 'visible', timeout: 3000});
  }

  /** Get the count of seen pairs in localStorage (reliable signal for advance/skip). */
  async getSeenPairsCount(): Promise<number> {
    return await this.page.evaluate(() => {
      const stored = localStorage.getItem('inkweave:voted-pairs');
      return stored ? JSON.parse(stored).length : 0;
    });
  }

  /** Wait for seen pairs count to increase (proves pair was advanced). */
  async waitForPairAdvance(previousCount: number) {
    await this.page.waitForFunction(
      (prevCount) => {
        const stored = localStorage.getItem('inkweave:voted-pairs');
        const current = stored ? JSON.parse(stored).length : 0;
        return current > prevCount;
      },
      previousCount,
      {timeout: 5000},
    );
    await this.page.waitForTimeout(300);
  }
}
