/**
 * Point Playwright at the browsers a cloud container ships (#983).
 *
 * Claude Code's cloud containers carry Chromium, its headless shell and ffmpeg under
 * /opt/pw-browsers, but often a revision or two behind the ones this repo's Playwright asks
 * for (1243 against 1248 on 2026-10-24), and Playwright looks a build up by its exact
 * revision. The builds still run the suite, so this links each wanted revision's folder to
 * the newest one the container has, in a folder of links that PLAYWRIGHT_BROWSERS_PATH then
 * names. WebKit and Firefox aren't shipped at all, so the cloud pre-push leaves them to CI.
 */
import {existsSync, mkdirSync, readdirSync, rmSync, symlinkSync} from 'node:fs';
import {join} from 'node:path';

/** The browsers the chromium and mobile-chrome projects launch. */
const LINKED = ['chromium', 'chromium-headless-shell', 'ffmpeg'];

/**
 * The browsers to link, from Playwright's `browsers.json`: each one's folder name
 * (Playwright spells `chromium-headless-shell` as `chromium_headless_shell` on disk) and
 * the revision this Playwright wants.
 */
export function wantedBrowsers(browsersJson) {
  return browsersJson.browsers
    .filter(({name}) => LINKED.includes(name))
    .map(({name, revision}) => ({dir: name.replaceAll('-', '_'), revision}));
}

/** The newest revision of `dir` among the shipped folders, or null when there is none. */
function newestShipped(shipped, dir) {
  const revisions = shipped
    .filter((folder) => folder.startsWith(`${dir}-`))
    .map((folder) => folder.slice(dir.length + 1))
    .filter((revision) => /^\d+$/.test(revision));
  if (revisions.length === 0) return null;
  return revisions.sort((a, b) => Number(b) - Number(a))[0];
}

/** The folders in `shippedDir`, or an error that names it when it is missing. */
function shippedFolders(shippedDir) {
  if (!existsSync(shippedDir)) {
    throw new Error(
      `No browsers folder at ${shippedDir}; set PLAYWRIGHT_BROWSERS_PATH to the one this machine has`,
    );
  }
  return readdirSync(shippedDir);
}

/** Point `link` at `target`, replacing a link an earlier run left. */
function replaceLink(target, link) {
  // Never recursive: that could follow the link into the shipped build.
  rmSync(link, {force: true});
  // A junction needs no admin rights on Windows, where the script tests also run.
  symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
}

/**
 * Where Playwright should look for its browsers. When `shippedDir` already holds every
 * wanted revision, that is `shippedDir` itself and nothing is written. Otherwise `linkDir`
 * gets one link per wanted browser, to the same revision when it is shipped and to the
 * newest shipped one when it isn't, and `linked` lists the substitutions.
 */
export function linkShippedBrowsers({shippedDir, linkDir, wanted}) {
  const shipped = shippedFolders(shippedDir);
  const isShipped = ({dir, revision}) => shipped.includes(`${dir}-${revision}`);
  if (wanted.every(isShipped)) return {browsersPath: shippedDir, linked: []};

  mkdirSync(linkDir, {recursive: true});
  const linked = [];
  for (const browser of wanted) {
    const {dir, revision} = browser;
    const source = isShipped(browser) ? revision : newestShipped(shipped, dir);
    if (source === null)
      throw new Error(`No ${dir} build in ${shippedDir} to stand in for ${dir}-${revision}`);
    replaceLink(join(shippedDir, `${dir}-${source}`), join(linkDir, `${dir}-${revision}`));
    if (source !== revision) linked.push(`${dir}-${revision} -> ${dir}-${source}`);
  }
  return {browsersPath: linkDir, linked};
}
