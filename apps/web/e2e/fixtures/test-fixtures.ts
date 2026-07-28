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
  // Firefox-only: a self-hosted @font-face weight that ISN'T preloaded (index.html
  // preloads only the 400 weights) can still be in-flight when a test navigates or
  // tears down — e.g. the compact header renders weight-500 text, then the spec moves
  // on before plus-jakarta-sans-500.woff2 finishes. Gecko cancels the request and logs
  //   "downloadable font: download failed (... plus-jakarta-sans-500.woff2 ...) status=2152398850"
  // where 2152398850 = 0x804B0002 = NS_BINDING_ABORTED (request cancelled). Same class
  // as the "TypeError: Failed to fetch" navigation-abort above — a teardown artifact, not
  // a font fault. BOTH anchors are required ("download failed" AND the abort code) so a
  // REAL font failure (404 / bad MIME / CORS reports a different status) still fails the guard.
  /downloadable font: download failed.*status=2152398850/i,
  // WebKit-only (webkit + mobile-safari) intermittently logs a resource-load failure for a
  // same-origin /data/*.json fetch — e.g. "/data/previewCards.json due to access control checks"
  // or "/data/allCards.json due to access control checks" — under the Playwright harness. It's a
  // WebKit security-check quirk on the local fetch, not an app fault: the data still loads (the
  // page renders its data-dependent UI, and loader.ts handles a missing/!ok response gracefully).
  // Playwright's page.route interception (e.g. the voting specs' mockVoteQueue) perturbs WebKit's
  // fetch layer enough to surface it more often — including on allCards.json, not just preview.
  // The phrasing is WebKit-specific, so this stays WebKit-scoped even though the allowlist applies
  // to every project. Both anchors are required (a /data/*.json filename AND the "access control
  // checks" phrase) so it can't mask a real data fault — a genuine problem surfaces as an HTTP
  // status or JSON parse error, which contain neither anchor and still fail the guard.
  /\/data\/(allCards|previewCards)\.json.*access control checks/i,
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
