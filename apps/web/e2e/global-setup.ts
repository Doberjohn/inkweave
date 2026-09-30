import {chromium, type FullConfig, type Page, type Request} from '@playwright/test';

/** The pages accessibility.spec.ts opens first: each is a lazy page chunk to compile. */
const WARM_ROUTES = [
  '/',
  '/browse',
  '/card/1939',
  '/playstyles',
  '/playstyles/discard',
  '/inks',
  '/ink/steel',
];
/** Room for a cold compile on a busy shared machine (measured: up to 34 s for the first page). */
const WARM_TIMEOUT_MS = 180_000;
/** A page has compiled once no module request has been in flight for this long. */
const QUIET_MS = 1_000;
/**
 * Pages open at once, capped at the run's worker count. Vite compiles them side by side: 3 took
 * 13.6 s against 19.2 s one at a time.
 */
const WARM_PAGES = 3;
/** Vite serves each source file and dependency on its own request under these prefixes. */
const MODULE_REQUEST = /\/(src|node_modules|@fs|@id|@vite)\//;

/** Counts the page's Vite module requests in flight and notes when one last started or ended. */
function watchModuleRequests(page: Page) {
  let pending = 0;
  let lastActivity = Date.now();
  const track = (delta: number) => (request: Request) => {
    if (!MODULE_REQUEST.test(request.url())) return;
    pending += delta;
    lastActivity = Date.now();
  };
  const onStart = track(1);
  const onEnd = track(-1);
  page.on('request', onStart);
  page.on('requestfinished', onEnd);
  page.on('requestfailed', onEnd);
  return {
    settled: () => pending <= 0 && Date.now() - lastActivity >= QUIET_MS,
    stop: () => {
      page.off('request', onStart);
      page.off('requestfinished', onEnd);
      page.off('requestfailed', onEnd);
    },
  };
}

/**
 * Opens `route` and waits until no module request has been in flight for QUIET_MS, so the page's
 * lazy chunk and everything it imports have compiled. A DOM landmark can't be the signal: only
 * the home and card pages render `<main>`.
 */
async function openAndSettle(page: Page, route: string): Promise<void> {
  const modules = watchModuleRequests(page);
  try {
    const deadline = Date.now() + WARM_TIMEOUT_MS;
    await page.goto(route, {timeout: WARM_TIMEOUT_MS});
    while (!modules.settled()) {
      if (Date.now() > deadline) {
        throw new Error(`modules still loading after ${WARM_TIMEOUT_MS / 1000} s`);
      }
      await page.waitForTimeout(100);
    }
  } finally {
    modules.stop();
  }
}

/**
 * Every local run starts a fresh Vite (#645), which compiles each module on its first request,
 * and Playwright starts the tests as soon as `/` answers. Opening the first spec's pages here
 * compiles them, and the app shell every page shares, before any test, instead of inside the first
 * tests' 30 s timeouts, where it took 7 to 15 s of each on a quiet machine and pushed them past
 * 30 s under load (#664).
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Under PWDEBUG this browser would open headed and pause in the Inspector before any test.
  if (process.env.PWDEBUG) return;
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('E2E warm-up: playwright.config.ts has no baseURL');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({baseURL});
    const started = Date.now();
    const queue = [...WARM_ROUTES];
    const warmFromQueue = async () => {
      const page = await context.newPage();
      for (let route = queue.shift(); route; route = queue.shift()) {
        // The cause says why: a timeout, a refused connection if the server died, a crash.
        await openAndSettle(page, route).catch((error: unknown) => {
          throw new Error(`E2E warm-up: could not load ${route}`, {cause: error});
        });
      }
    };
    const lanes = Math.min(WARM_PAGES, config.workers);
    await Promise.all(Array.from({length: lanes}, warmFromQueue));
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`E2E warm-up: ${WARM_ROUTES.length} routes in ${seconds} s`);
  } finally {
    await browser.close();
  }
}
