#!/usr/bin/env node
/**
 * The service worker's update flow, checked in Chromium over two versions of one build. E2E
 * blocks service workers, so nothing else drives it. A check script rather than a *.test.mjs, so
 * `pnpm test:scripts` needs no build: CI's perf-gates.yml builds the app and runs it when
 * main.tsx, the update modules, the Vite config, vercel.json, this check or the dependencies
 * change.
 *
 * The build is served as vercel.json serves it (serve-dist.mjs), as two deploys: the second's
 * sw.js differs (index.html's precache revision), and each version's index.html names it in a
 * meta tag. The check "deploys" the second by switching the server over.
 *
 * Checks, each in a browser context of its own:
 *   1. A tab the old worker controls, reloaded after the deploy, shows the update toast, then
 *      reloads once onto the new version, and the toast goes.
 *   2. A tab loaded with a hard reload, which no worker controls, beside a tab the old worker
 *      controls: once that tab takes the update, the hard-reloaded tab shows the toast, then
 *      reloads once onto the new version. A page with no controller gets no `controllerchange`.
 *   3. The same for a tab on its first visit, which the worker installed under but doesn't
 *      control.
 *   4. With the old worker's allCards.json request held past UPDATE_TOAST_MAX_MS, so Chrome holds
 *      the new worker back, the toast goes UPDATE_TOAST_MAX_MS after it shows, and the page still
 *      reloads onto the new version once the request ends.
 *
 * Usage: `pnpm build:web`, then `pnpm check:sw-update [--dir apps/web/dist]`
 */
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {contentType} from './lib/mime.mjs';
import {readSiteHeaders, resolveDistFile} from './serve-dist.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Playwright is apps/web's, as for prerender.mjs: a root script can't see it otherwise.
const require = createRequire(resolve(ROOT, 'apps', 'web', 'package.json'));
const {chromium} = require('@playwright/test');

/** swUpdateToast.ts's toast. */
const TOAST_ID = 'sw-update-toast';
/** How long a page may take to load, or a worker to install. */
const LOAD_TIMEOUT_MS = 30000;
/** How long a tab may take to reach the new version once the update is found. */
const UPDATE_TIMEOUT_MS = 30000;
/** How far from UPDATE_TOAST_MAX_MS the held toast may go (check 4). */
const CAP_SLACK_MS = 1500;
/** How much longer than UPDATE_TOAST_MAX_MS check 4 holds the old worker's request. */
const HOLD_PAST_CAP_MS = 5000;
/** The request check 4 holds: a StaleWhileRevalidate route, so the old worker waits on it. */
const HELD_REQUEST = /^\/data\/allCards\.json/;

/** UPDATE_TOAST_MAX_MS, read from the source. */
function readToastCap() {
  const source = readFileSync(resolve(ROOT, 'apps/web/src/shared/lib/swUpdateToast.ts'), 'utf8');
  const cap = /export const UPDATE_TOAST_MAX_MS = (\d+);/.exec(source);
  if (!cap) throw new Error('UPDATE_TOAST_MAX_MS not found in swUpdateToast.ts');
  return Number(cap[1]);
}

/**
 * The two deploys' index.html and sw.js, made from a build's. The second sw.js gives index.html
 * another precache revision, which is enough for the browser to install it as a new worker and
 * for that worker to fetch the second index.html. Exported for scripts/check-sw-update.test.mjs.
 */
export function versionsOf(indexHtml, swSource) {
  const revision = /(\{url:"index\.html",revision:")([0-9a-f]+)(")/;
  const found = revision.exec(swSource);
  if (!found) throw new Error('sw.js precaches no index.html with a revision: is it a production build?');
  if (!indexHtml.includes('<head>')) throw new Error('index.html has no <head> to mark');
  const mark = (name) => indexHtml.replace('<head>', `<head><meta name="sw-check-version" content="${name}">`);
  const otherRevision = found[2].replace(/./g, (digit) => (digit === '0' ? '1' : '0'));
  return {
    old: {index: mark('old'), sw: swSource},
    new: {index: mark('new'), sw: swSource.replace(revision, `$1${otherRevision}$3`)},
  };
}

/**
 * A server over `dist` that answers as vercel.json does, with index.html and sw.js from the
 * version `deploy.current` names, and HELD_REQUEST held `deploy.holdMs`, which check 4 sets as the
 * new version goes out.
 */
function startServer(dist, versions, deploy) {
  const headers = readSiteHeaders();
  const server = createServer((req, res) => {
    void (async () => {
      const url = req.url ?? '/';
      const file = resolveDistFile(dist, url);
      if (!file) {
        res.writeHead(404, headers);
        res.end('not found');
        return;
      }
      if (deploy.holdMs && HELD_REQUEST.test(url)) {
        await new Promise((done) => setTimeout(done, deploy.holdMs));
      }
      const version = versions[deploy.current];
      let body;
      if (file === join(dist, 'index.html')) body = version.index;
      else if (file === join(dist, 'sw.js')) body = version.sw;
      else body = await readFile(file);
      res.writeHead(200, {...headers, 'Content-Type': contentType(extname(file))});
      res.end(body);
    })();
  });
  return new Promise((done) => server.listen(0, () => done(server)));
}

/**
 * Runs in each page before its own scripts: counts the tab's page loads and records when the
 * update toast shows and goes, in sessionStorage, which a reload keeps.
 */
function recordTab(toastId) {
  const KEY = 'sw-check';
  const read = () => JSON.parse(sessionStorage.getItem(KEY) ?? '{"loads":0,"toasts":[]}');
  const write = (state) => sessionStorage.setItem(KEY, JSON.stringify(state));
  const state = read();
  state.loads += 1;
  write(state);
  const load = state.loads;
  const note = (field) => {
    const next = read();
    if (field === 'shownAt') next.toasts.push({load, shownAt: Date.now()});
    else {
      const toast = next.toasts.findLast((entry) => entry.load === load && entry.goneAt === undefined);
      if (toast) toast.goneAt = Date.now();
    }
    write(next);
  };
  new MutationObserver((mutations) => {
    for (const {addedNodes, removedNodes} of mutations) {
      for (const node of addedNodes) if (node.id === toastId) note('shownAt');
      for (const node of removedNodes) if (node.id === toastId) note('goneAt');
    }
  }).observe(document, {childList: true, subtree: true});
}

/** What a tab shows now: its version, its controller, the toast, and what recordTab kept. */
async function readTab(page) {
  return page.evaluate((toastId) => {
    const kept = JSON.parse(sessionStorage.getItem('sw-check') ?? '{"loads":0,"toasts":[]}');
    return {
      version: document.querySelector('meta[name="sw-check-version"]')?.content ?? null,
      controlled: Boolean(navigator.serviceWorker.controller),
      toast: Boolean(document.getElementById(toastId)),
      ...kept,
    };
  }, TOAST_ID);
}

/** Polls a tab until `done(tab)` holds; a read during a reload's navigation just retries. */
async function waitForTab(page, done, timeoutMs) {
  const start = Date.now();
  let tab = null;
  while (Date.now() - start < timeoutMs) {
    tab = await readTab(page).catch(() => tab);
    if (tab && done(tab)) return tab;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return null;
}

/** Waits until the page's worker is active (the app registers it after `load`). */
async function waitForWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

/** A tab the old version's worker controls: a first visit installs it, the reload puts it in charge. */
async function controlledTab(context, base) {
  const page = await context.newPage();
  await page.goto(base, {timeout: LOAD_TIMEOUT_MS});
  await waitForWorker(page);
  await page.reload({timeout: LOAD_TIMEOUT_MS});
  const tab = await waitForTab(page, (state) => state.controlled, LOAD_TIMEOUT_MS);
  if (!tab) throw new Error('the old worker never took control of the tab');
  return page;
}

/** Shift+reload: the browser loads the page past the worker, which then controls nothing in it. */
async function hardReload(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.reload', {ignoreCache: true});
  await page.waitForLoadState('load');
  await cdp.detach();
}

/** Why `tab` (null: it never got there) isn't on the new version after one update reload, or null. */
function updateFailure(tab, loadsBefore) {
  if (!tab) return `never reached the new version without its toast within ${UPDATE_TIMEOUT_MS} ms`;
  if (tab.loads !== loadsBefore + 1) return `loaded ${tab.loads - loadsBefore} times for one update`;
  if (!tab.toasts.some((toast) => toast.load === loadsBefore)) return 'never showed the update toast';
  return null;
}

/** Waits for a tab on the new version, without the toast, and says why not, or null. */
async function newVersionFailure(page, loadsBefore) {
  const reached = (state) => state.version === 'new' && !state.toast && state.loads > loadsBefore;
  const tab = await waitForTab(page, reached, UPDATE_TIMEOUT_MS);
  // A second reload would land shortly after the first.
  await new Promise((settle) => setTimeout(settle, 1000));
  return updateFailure(tab && (await readTab(page)), loadsBefore);
}

const checks = [
  {
    name: '1. a tab the old worker controls reloads onto the new version',
    async run({context, base, deploy}) {
      const page = await controlledTab(context, base);
      deploy.current = 'new';
      await page.reload();
      const {loads} = await readTab(page);
      return newVersionFailure(page, loads);
    },
  },
  {
    name: '2. a hard-reloaded tab follows another tab onto the new version',
    async run({context, base, deploy}) {
      const other = await controlledTab(context, base);
      const page = await controlledTab(context, base);
      await hardReload(page);
      const before = await readTab(page);
      if (before.controlled) return 'the hard reload left the tab controlled: the check needs one that is not';
      deploy.current = 'new';
      await other.reload();
      return newVersionFailure(page, before.loads);
    },
  },
  {
    name: "3. a first visit's tab follows another tab onto the new version",
    async run({context, base, deploy}) {
      const page = await context.newPage();
      await page.goto(base, {timeout: LOAD_TIMEOUT_MS});
      await waitForWorker(page);
      const other = await controlledTab(context, base);
      const before = await readTab(page);
      if (before.controlled) return 'the first visit is controlled: the check needs one that is not';
      deploy.current = 'new';
      await other.reload();
      return newVersionFailure(page, before.loads);
    },
  },
  {
    name: '4. the toast goes after UPDATE_TOAST_MAX_MS while Chrome holds the new worker back',
    async run({context, base, deploy, cap}) {
      const page = await controlledTab(context, base);
      deploy.current = 'new';
      deploy.holdMs = cap + HOLD_PAST_CAP_MS;
      await page.reload();
      const {loads} = await readTab(page);
      // The app asks for the card list itself; this makes sure a request is out when the toast is.
      // The reload may end the page before the request does, which rejects the evaluation.
      page.evaluate(() => fetch('/data/allCards.json')).catch(() => {});
      const held = await waitForTab(page, (state) => state.toasts.some((toast) => toast.goneAt), cap * 2);
      if (!held) return `the toast never went (or never showed) within ${cap * 2} ms`;
      const toast = held.toasts.find((entry) => entry.goneAt);
      const shownFor = toast.goneAt - toast.shownAt;
      if (Math.abs(shownFor - cap) > CAP_SLACK_MS) return `the toast stayed ${shownFor} ms, not ${cap}`;
      if (held.version !== 'old') return 'the page reloaded before the held request ended: nothing held the new worker back';
      return newVersionFailure(page, loads);
    },
  },
];

/** Runs each check in a context of its own, against a server it starts over the two versions. */
async function runChecks(dist, versions, cap) {
  const browser = await chromium.launch();
  const results = [];
  for (const check of checks) {
    const deploy = {current: 'old', holdMs: 0};
    const server = await startServer(dist, versions, deploy);
    // Each server takes a port of its own, so each check starts with no worker registered.
    const base = `http://localhost:${server.address().port}/`;
    const context = await browser.newContext();
    await context.addInitScript(recordTab, TOAST_ID);
    let failure;
    try {
      failure = await check.run({context, base, deploy, cap});
    } catch (error) {
      failure = `crashed: ${error.message}`;
    }
    await context.close();
    server.close();
    results.push({name: check.name, failure});
  }
  await browser.close();
  return results;
}

async function main() {
  const {values} = parseArgs({options: {dir: {type: 'string', default: 'apps/web/dist'}}});
  const dist = resolve(ROOT, values.dir);
  if (!existsSync(join(dist, 'sw.js'))) {
    console.error(`✖ ${join(dist, 'sw.js')} not found: run \`pnpm build:web\` first`);
    process.exit(1);
  }
  const versions = versionsOf(
    readFileSync(join(dist, 'index.html'), 'utf8'),
    readFileSync(join(dist, 'sw.js'), 'utf8'),
  );
  const results = await runChecks(dist, versions, readToastCap());
  for (const {name, failure} of results) console.log(failure ? `✖ ${name}: ${failure}` : `✓ ${name}`);
  const failed = results.filter((result) => result.failure).length;
  console.log(`\n${results.length - failed} of ${results.length} service worker update checks passed.`);
  if (failed > 0) process.exit(1);
}

// Run only when invoked directly (never when imported).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('✖ Service worker update check crashed:', error);
    process.exit(1);
  });
}
