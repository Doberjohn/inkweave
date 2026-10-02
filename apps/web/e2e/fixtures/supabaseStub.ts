import type {Page} from '@playwright/test';

/**
 * The Supabase origin E2E points at, and the browser-level stub that answers it.
 *
 * `playwright.config.ts` pins `VITE_SUPABASE_URL` to this host so `getSupabase()` returns
 * a client and the auth control renders. That makes the app genuinely CONFIGURED, which
 * switches on every other Supabase-backed path too: voting reads `pair_scores` and writes
 * `submit_vote`. The host does not resolve, so without this stub those calls fail at DNS.
 *
 * The app handles that correctly — it degrades, and chromium + mobile-chrome stayed green —
 * but the console-error guard in `test-fixtures.ts` fails any test that logs an error, and
 * WebKit ("due to access control checks") and Firefox ("Name or service not known") word
 * their network failures differently from Chromium's already-allowlisted "Failed to load
 * resource". Stubbing at the browser is the fix rather than widening that allowlist, which
 * would have meant allowing `[submitVote] RPC error` — precisely the class of fault the
 * guard exists to catch.
 *
 * Empty JSON is the right answer: `pair_scores` reads `[]` as "no community votes yet", a
 * state the UI already renders, and `submit_vote` reads a null error as success. This is
 * also a truer environment than an unreachable host, which is a configuration that exists
 * neither in production (real project) nor in the old E2E setup (no credentials at all).
 */
export const E2E_SUPABASE_ORIGIN = 'https://e2e.placeholder.supabase.co';
export const E2E_SUPABASE_ANON_KEY = 'e2e-placeholder-anon-key';

const E2E_SUPABASE_HOST = new URL(E2E_SUPABASE_ORIGIN).hostname;

/**
 * Answer every request to the placeholder project with an empty success.
 *
 * Registered by the `page` fixture before a spec runs, so a spec that needs specific rows
 * can register its own route afterwards: Playwright matches handlers most-recent-first, so
 * the spec's wins (this is what keeps the voting specs' `mockVoteQueue` in charge).
 */
export async function stubSupabase(page: Page): Promise<void> {
  await page.route(
    (url) => url.hostname === E2E_SUPABASE_HOST,
    (route, request) => {
      // PostgREST hands back a row set; everything else (auth, storage) expects an object.
      // No auth call is expected here — with no stored session `getSession()` resolves from
      // localStorage — but answering with valid JSON beats a parse error if one ever appears.
      const isRestQuery = new URL(request.url()).pathname.startsWith('/rest/');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: isRestQuery ? '[]' : '{}',
      });
    },
  );
}
