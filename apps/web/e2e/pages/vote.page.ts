import type {Locator, Page} from '@playwright/test';

/**
 * Serve a deterministic vote queue via route interception so voting tests don't depend on the
 * Vite dev server's static-JSON responses under parallel-worker contention. That contention is a
 * LOCAL-ONLY flake (net::ERR_ABORTED navigations + slow pair loads): CI runs `workers: 1` (serial,
 * no contention) and is green, while the local pre-push hook runs many parallel workers hammering
 * one dev server. Call from a spec's beforeEach AFTER the initial home navigation.
 *
 * The pair entries are copied verbatim from the live `_pairs_index.json` so their card ids resolve
 * through the real CardDataContext (`getCardById`); several entries keep the queue non-empty across
 * advance/skip. Individual synergy files return an empty-but-valid shape, which `resolvePair`
 * tolerates (connections default to []) — the tests only need the pair + score picker to render.
 */
export async function mockVoteQueue(page: Page): Promise<void> {
  const pairsIndex = [
    ['1128', '2737', 10],
    ['1212', '2737', 10],
    ['1670', '2737', 10],
    ['2513', '2515', 10],
    ['962', '975', 9],
  ];
  await page.route('**/data/synergies/_pairs_index.json', (route) =>
    route.fulfill({json: pairsIndex}),
  );
  await page.route(/\/data\/synergies\/(?!_pairs_index)[^/]+\.json(\?.*)?$/, (route) =>
    route.fulfill({json: {groups: [], pairs: {}}}),
  );
}

/**
 * Navigate to a path, retrying if the navigation is interrupted. Under parallel-worker dev-server
 * contention a page.goto intermittently fails — net::ERR_ABORTED / "Frame load interrupted" on
 * chromium, "interrupted by another navigation to /" on webkit. This is a LOCAL-ONLY flake (CI runs
 * workers:1 serially and is green) and the interruption is a transient dev-server artifact, not a
 * real redirect. waitUntil:'domcontentloaded' resolves once the document is parsed rather than
 * waiting for every subresource (the 'load' event is the one aborted under contention). Callers
 * should assert their own readiness signal after this returns.
 */
export async function gotoWithRetry(page: Page, url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, {waitUntil: 'domcontentloaded'});
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

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
    // The vote queue is deterministic via mockVoteQueue, so a retried navigation re-runs an
    // identical, side-effect-free load. waitForPairLoaded below is the real readiness signal.
    await gotoWithRetry(this.page, '/vote');
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
