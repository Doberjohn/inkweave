#!/usr/bin/env node
/**
 * The service worker's update flow, checked in Chromium over two versions of one build. E2E
 * blocks service workers, so nothing else drives it. A check script rather than a *.test.mjs, so
 * `pnpm test:scripts` needs no build: CI's perf-gates.yml builds the app and runs it when
 * index.html, main.tsx, the update modules, the Vite config, vercel.json, this check or the
 * dependencies change.
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
 *      the new worker back, the toast goes UPDATE_TOAST_MAX_MS after it shows, and once the
 *      request ends the page shows it again, UPDATE_TOAST_LEAD_MS before it reloads onto the new
 *      version.
 *   5. A tab the old worker controls, whose card list hasn't loaded yet, meets a deploy with card
 *      data it can't read. An in-app link loads the list, which fails, and with no navigation for
 *      the browser to look for the new worker on, the page looks itself (cardListFailure.ts): it
 *      shows the toast, then reloads once onto the new version.
 *   6. The same, with the new worker held mid-install: the error screen's Reload, pressed then,
 *      waits for it rather than reloading onto the old version, which the old worker would serve
 *      again, and the tab reloads once onto the new version when the install ends.
 *
 * Usage: `pnpm build:web`, then `pnpm check:sw-update [--dir apps/web/dist]`
 */
import {createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createDistServer} from './serve-dist.mjs';

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
/** How much sooner than UPDATE_TOAST_LEAD_MS after the toast the late reload may come (check 4). */
const LEAD_SLACK_MS = 100;
/** How much longer than UPDATE_TOAST_MAX_MS check 4 holds the old worker's request. */
const HOLD_PAST_CAP_MS = 5000;
/**
 * The card list: check 4 holds it (a StaleWhileRevalidate route, so the old worker waits on it),
 * and check 5 answers it with UNREADABLE_CARDS.
 */
const CARD_LIST_REQUEST = /^\/data\/allCards\.json/;
/** The worker's script, which the browser requests each time it looks for a new version. */
const WORKER_SCRIPT = /^\/sw\.js(\?|$)/;
/** Card data that no version of the app can read: `cards` is not a list. */
const UNREADABLE_CARDS = JSON.stringify({cards: 'unreadable'});
/**
 * index.html, which only a new worker's install asks the network for: the old worker answers
 * every navigation from its precache, and the other precached files keep their cache keys.
 */
const INSTALL_REQUEST = /^\/index\.html(\?|$)/;
/** How long check 6 waits, after Reload is pressed, for a reload that mustn't come. */
const NO_RELOAD_MS = 2000;

/**
 * The number `source` exports as `name`, written with or without a type or numeric separators.
 * Exported for scripts/check-sw-update.test.mjs.
 */
export function toastConstant(source, name) {
  const found = new RegExp(`export const ${name}(?::\\s*number)?\\s*=\\s*([\\d_]+);`).exec(source);
  if (!found) throw new Error(`${name} not found in swUpdateToast.ts`);
  return Number(found[1].replaceAll('_', ''));
}

/** A number swUpdateToast.ts exports, such as UPDATE_TOAST_MAX_MS, read from the source. */
function readToastConstant(name) {
  const source = readFileSync(resolve(ROOT, 'apps/web/src/shared/lib/swUpdateToast.ts'), 'utf8');
  return toastConstant(source, name);
}

/**
 * The two deploys' index.html and sw.js, made from a build's. The second sw.js gives index.html
 * another precache revision, which is enough for the browser to install it as a new worker and
 * for that worker to fetch the second index.html. Exported for scripts/check-sw-update.test.mjs.
 */
export function versionsOf(indexHtml, swSource) {
  const revision = /(\{url:"index\.html",revision:")([0-9a-f]+)(")/;
  const found = revision.exec(swSource);
  if (!found)
    throw new Error('sw.js precaches no index.html with a revision: is it a production build?');
  if (!indexHtml.includes('<head>')) throw new Error('index.html has no <head> to mark');
  const mark = (name) =>
    indexHtml.replace('<head>', `<head><meta name="sw-check-version" content="${name}">`);
  const otherRevision = found[2].replace(/./g, (digit) => (digit === '0' ? '1' : '0'));
  return {
    old: {index: mark('old'), sw: swSource},
    new: {index: mark('new'), sw: swSource.replace(revision, `$1${otherRevision}$3`)},
  };
}

/** Whether `url` is the new version's worker installing while check 6 holds its install. */
function holdsInstall(deploy, url) {
  return Boolean(deploy.installHold) && deploy.current === 'new' && INSTALL_REQUEST.test(url);
}

/**
 * A server over `dist` that answers as vercel.json does (serve-dist.mjs), with index.html and
 * sw.js from the version `deploy.current` names, and the card list held `deploy.holdMs` (check 4)
 * or answered with `deploy.cardList` (check 5), which the checks set as the new version goes out.
 * It counts the browser's looks for a new worker, each a request for sw.js, in
 * `deploy.workerLooks`, and once the new version is out, holds its worker's install until
 * `deploy.installHold` settles, counting the installs it holds in `deploy.installsHeld` (check 6).
 */
function startServer(dist, versions, deploy) {
  const bodyFor = async (file, url) => {
    if (WORKER_SCRIPT.test(url)) deploy.workerLooks += 1;
    if (holdsInstall(deploy, url)) {
      deploy.installsHeld += 1;
      await deploy.installHold;
    }
    if (deploy.holdMs && CARD_LIST_REQUEST.test(url)) {
      await new Promise((done) => setTimeout(done, deploy.holdMs));
    }
    if (deploy.cardList && CARD_LIST_REQUEST.test(url)) return deploy.cardList;
    const version = versions[deploy.current];
    return {[join(dist, 'index.html')]: version.index, [join(dist, 'sw.js')]: version.sw}[file];
  };
  const server = createDistServer(dist, {bodyFor});
  return new Promise((done) => server.listen(0, () => done(server)));
}

/**
 * Runs in each page before its own scripts: counts the tab's page loads, when each one first
 * asked to leave, and when the update toast shows and goes, in sessionStorage, which a reload
 * keeps.
 */
function recordTab(toastId) {
  const KEY = 'sw-check';
  const read = () =>
    JSON.parse(sessionStorage.getItem(KEY) ?? '{"loads":0,"leftAt":{},"toasts":[]}');
  const write = (state) => sessionStorage.setItem(KEY, JSON.stringify(state));
  const state = read();
  state.loads += 1;
  write(state);
  const load = state.loads;
  // A reload's beforeunload fires as the page asks for it, however long the reload then takes.
  window.addEventListener('beforeunload', () => {
    const next = read();
    next.leftAt[load] ??= Date.now();
    write(next);
  });
  const note = (field) => {
    const next = read();
    if (field === 'shownAt') next.toasts.push({load, shownAt: Date.now()});
    else {
      const toast = next.toasts.findLast(
        (entry) => entry.load === load && entry.goneAt === undefined,
      );
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
    const kept = JSON.parse(
      sessionStorage.getItem('sw-check') ?? '{"loads":0,"leftAt":{},"toasts":[]}',
    );
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

/**
 * Runs in each page of check 5 before its own scripts: idle callbacks never run, so the homepage
 * never loads its card list on its own (it waits for an idle moment, #641), only when a link needs
 * it. The worker still registers: the app does that at `load`.
 */
function neverIdle() {
  window.requestIdleCallback = () => 0;
  window.cancelIdleCallback = () => {};
}

/** Polls until `done()` holds, or `timeoutMs` passes: whether it came to hold. */
async function until(done, timeoutMs) {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start >= timeoutMs) return false;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return true;
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
  // Page.reload answers before the new document commits: wait for that document's own load.
  await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', {ignoreCache: true})]);
  await cdp.detach();
}

/** Why `tab`, on the new version, didn't get there by one update reload with the toast, or null. */
function updateFailure(tab, loadsBefore) {
  if (tab.loads !== loadsBefore + 1)
    return `loaded ${tab.loads - loadsBefore} times for one update`;
  if (!tab.toasts.some((toast) => toast.load === loadsBefore))
    return 'never showed the update toast';
  return null;
}

/**
 * Waits for a tab on the new version, without the toast, and says why not, or null; then why the
 * settled tab fails `alsoFailure`, a check's own question, if it does.
 */
async function newVersionFailure(page, loadsBefore, alsoFailure = () => null) {
  const reached = (state) => state.version === 'new' && !state.toast && state.loads > loadsBefore;
  if (!(await waitForTab(page, reached, UPDATE_TIMEOUT_MS))) {
    return `never reached the new version without its toast within ${UPDATE_TIMEOUT_MS} ms`;
  }
  // A second reload would land shortly after the first, and a read it cuts off retries.
  await new Promise((settle) => setTimeout(settle, 1000));
  const settled = await waitForTab(page, () => true, 2000);
  if (!settled) return 'kept reloading after it reached the new version';
  return updateFailure(settled, loadsBefore) ?? alsoFailure(settled);
}

/**
 * Why the reload that left load `load` of `tab` came without the toast again, or too soon after
 * it for anyone to read it, or null.
 */
function lateToastFailure(tab, load, lead) {
  const late = tab.toasts.filter((toast) => toast.load === load)[1];
  if (!late) return 'the late reload never showed the toast again';
  // Up to the page asking to reload (recordTab's beforeunload), not to the next page's start: a
  // slow navigation that a second reload replaces would push that past a reload that came too soon.
  const shownFor = tab.leftAt[load] - late.shownAt;
  if (!(shownFor >= lead - LEAD_SLACK_MS)) {
    return `the late reload came ${shownFor} ms after the toast, not ${lead}`;
  }
  return null;
}

/**
 * Checks 5 and 6: a tab the old worker controls, whose card list hasn't loaded yet, meets a deploy
 * with card data it can't read, and an in-app link loads the list. The tab and its page loads so
 * far, or why it couldn't be set up.
 */
async function unreadableDeployTab(context, base, deploy) {
  await context.addInitScript(neverIdle);
  const page = await context.newPage();
  await page.goto(base, {timeout: LOAD_TIMEOUT_MS});
  await waitForWorker(page);
  const looksBefore = deploy.workerLooks;
  await page.reload({timeout: LOAD_TIMEOUT_MS});
  // The reload sets off the browser's own look for a new worker, which Chromium makes once the
  // worker has gone a second without a request. Had it come after the deploy, it would find the
  // new version without the page's help, so the deploy waits for it.
  if (!(await until(() => deploy.workerLooks > looksBefore, LOAD_TIMEOUT_MS)))
    return 'the reload never looked for a new worker';
  const before = await waitForTab(page, (state) => state.controlled, LOAD_TIMEOUT_MS);
  if (!before) return 'the old worker never took control of the tab';
  deploy.current = 'new';
  deploy.cardList = UNREADABLE_CARDS;
  // The router's link changes the page without navigating, so the browser looks for no worker.
  await page.getByTestId('cta-browse').click();
  return {page, loads: before.loads};
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
      if (before.controlled)
        return 'the hard reload left the tab controlled: the check needs one that is not';
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
      if (before.controlled)
        return 'the first visit is controlled: the check needs one that is not';
      deploy.current = 'new';
      await other.reload();
      return newVersionFailure(page, before.loads);
    },
  },
  {
    name: '4. the toast goes after UPDATE_TOAST_MAX_MS while Chrome holds the new worker back, and shows again before the late reload',
    async run({context, base, deploy, cap, lead}) {
      const page = await controlledTab(context, base);
      deploy.current = 'new';
      deploy.holdMs = cap + HOLD_PAST_CAP_MS;
      await page.reload();
      const {loads} = await readTab(page);
      // The app asks for the card list itself; this makes sure a request is out when the toast is.
      // The reload may end the page before the request does, which rejects the evaluation.
      page.evaluate(() => fetch('/data/allCards.json')).catch(() => {});
      const held = await waitForTab(
        page,
        (state) => state.toasts.some((toast) => toast.goneAt),
        cap * 2,
      );
      if (!held) return `the toast never went (or never showed) within ${cap * 2} ms`;
      const toast = held.toasts.find((entry) => entry.goneAt);
      const shownFor = toast.goneAt - toast.shownAt;
      if (Math.abs(shownFor - cap) > CAP_SLACK_MS)
        return `the toast stayed ${shownFor} ms, not ${cap}`;
      if (held.version !== 'old')
        return 'the page reloaded before the held request ended: nothing held the new worker back';
      // The reload comes after the toast went, so it shows the toast again first (announceReload).
      return newVersionFailure(page, loads, (tab) => lateToastFailure(tab, loads, lead));
    },
  },
  {
    name: "5. a tab the old worker controls looks for the new version when it can't read the new deploy's card data",
    async run({context, base, deploy}) {
      const tab = await unreadableDeployTab(context, base, deploy);
      if (typeof tab === 'string') return tab;
      return newVersionFailure(tab.page, tab.loads);
    },
  },
  {
    name: '6. the error screen\'s Reload, pressed while the new worker installs, waits for it and reloads once onto the new version',
    async run({context, base, deploy}) {
      let release;
      deploy.installHold = new Promise((done) => (release = done));
      const tab = await unreadableDeployTab(context, base, deploy);
      if (typeof tab === 'string') return tab;
      const {page, loads} = tab;
      if (!(await until(() => deploy.installsHeld > 0, UPDATE_TIMEOUT_MS)))
        return 'no new worker started to install';
      await page.getByRole('button', {name: 'Reload'}).click({timeout: LOAD_TIMEOUT_MS});
      await new Promise((settle) => setTimeout(settle, NO_RELOAD_MS));
      const pressed = await readTab(page);
      release();
      if (pressed.loads !== loads)
        return 'Reload reloaded before the new worker installed, so the old worker served the old version again';
      if (!pressed.toast) return 'Reload showed no update toast while it waited';
      return newVersionFailure(page, loads);
    },
  },
];

/** Runs each check in a context of its own, against a server it starts over the two versions. */
async function runChecks(dist, versions, {cap, lead}) {
  const browser = await chromium.launch();
  const results = [];
  for (const check of checks) {
    const deploy = {
      current: 'old',
      holdMs: 0,
      cardList: null,
      workerLooks: 0,
      installHold: null,
      installsHeld: 0,
    };
    const server = await startServer(dist, versions, deploy);
    // Each server takes a port of its own, so each check starts with no worker registered.
    const base = `http://localhost:${server.address().port}/`;
    const context = await browser.newContext();
    await context.addInitScript(recordTab, TOAST_ID);
    let failure;
    try {
      failure = await check.run({context, base, deploy, cap, lead});
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
  const results = await runChecks(dist, versions, {
    cap: readToastConstant('UPDATE_TOAST_MAX_MS'),
    lead: readToastConstant('UPDATE_TOAST_LEAD_MS'),
  });
  for (const {name, failure} of results)
    console.log(failure ? `✖ ${name}: ${failure}` : `✓ ${name}`);
  const failed = results.filter((result) => result.failure).length;
  console.log(
    `\n${results.length - failed} of ${results.length} service worker update checks passed.`,
  );
  if (failed > 0) process.exit(1);
}

// Run only when invoked directly (never when imported).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('✖ Service worker update check crashed:', error);
    process.exit(1);
  });
}
