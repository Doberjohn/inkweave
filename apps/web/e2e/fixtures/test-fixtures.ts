/* eslint-disable react-hooks/rules-of-hooks */
import {test as base, expect} from '@playwright/test';
import {AppPage} from '../pages/app.page';
import {CardListPage} from '../pages/card-list.page';
import {SynergyResultsPage} from '../pages/synergy-results.page';
import {VotePage} from '../pages/vote.page';

// Define fixture types
type TestFixtures = {
  appPage: AppPage;
  cardListPage: CardListPage;
  synergyResultsPage: SynergyResultsPage;
  votePage: VotePage;
};

/**
 * Console-error guard allowlist.
 *
 * The overridden `page` fixture fails any test that logs a console error or
 * throws an uncaught exception — this is what turns silent runtime faults (the
 * loudest being React's "Maximum update depth exceeded" render loop, which a
 * loading-skeleton assertion happily passes through) into red builds for free.
 *
 * Every entry here is a DELIBERATE, documented exception for a message that is
 * benign in the E2E environment. Keep the list tight: prefer fixing the source
 * over adding an allowlist entry. Patterns are matched against the message text.
 */
const BENIGN_CONSOLE: readonly RegExp[] = [
  // Card art is served via a dev proxy / local fallback; a missing image logs a
  // resource error that doesn't reflect an app fault.
  /Failed to load resource/i,
  // A mount-time fetch aborted by client navigation (e.g. a test re-navigating
  // before the fetch settles) rejects with "TypeError: Failed to fetch". This is
  // a navigation artifact, not a data fault — REAL data problems surface as an
  // HTTP status ("...: 404") or "received HTML instead of JSON", which are NOT
  // matched here and still fail the guard.
  /TypeError: Failed to fetch/,
  // React Grab (dev inspector) is imported ONLY in Vite dev mode (index.html,
  // gated on `import.meta.env.DEV`) and its client connects to ws://localhost:4722.
  // E2E runs under `npx vite` (dev) with no react-grab daemon, so the connection is
  // refused and logged. Pure dev-tooling noise — it never exists in a prod build.
  /ws:\/\/localhost:4722/,
  // WebKit-only (webkit + mobile-safari) intermittently logs a resource-load
  // failure for the preview-card fetch — "/data/previewCards.json due to access
  // control checks" — under the Playwright harness. It's a WebKit security-check
  // quirk on the local fetch, not an app fault: the loader already treats a
  // missing/!ok preview response gracefully (see loader.ts fetchCardsFromLocal),
  // so a genuine preview problem never reaches the console. The phrasing is
  // WebKit-specific, so this entry stays WebKit-scoped even though the allowlist
  // applies to every project. Both anchors are required (filename AND the
  // "access control checks" phrase) so it can't mask an unrelated preview fault —
  // a real preview problem surfaces as an HTTP status or JSON parse error, which
  // contain neither anchor and still fail the guard.
  /previewCards\.json.*access control checks/i,
];

// Extend base test with custom fixtures + a global console-error guard.
// Note: `use` is Playwright's fixture function, not a React Hook.
export const test = base.extend<TestFixtures>({
  // Override the built-in `page` fixture so every spec inherits the guard.
  page: async ({page}, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`[uncaught] ${err.message}`));

    await use(page);

    const fatal = errors.filter((text) => !BENIGN_CONSOLE.some((re) => re.test(text)));
    expect(
      fatal,
      `Page logged ${fatal.length} unexpected console error(s):\n${fatal.join('\n---\n')}`,
    ).toEqual([]);
  },
  appPage: async ({page}, use) => {
    const appPage = new AppPage(page);
    await use(appPage);
  },
  cardListPage: async ({page}, use) => {
    const cardListPage = new CardListPage(page);
    await use(cardListPage);
  },
  synergyResultsPage: async ({page}, use) => {
    const synergyResultsPage = new SynergyResultsPage(page);
    await use(synergyResultsPage);
  },
  votePage: async ({page}, use) => {
    const votePage = new VotePage(page);
    await use(votePage);
  },
});

export {expect} from '@playwright/test';
