/**
 * Stamp the build with the commit it was built from (#569).
 *
 * Writes apps/web/public/version.json, which Vite copies to the site root, so production
 * answers `GET /version.json` with {"sha", "builtAt"}. .github/workflows/deploy-drift.yml
 * compares that sha with master to catch a production site that has stopped updating: the
 * 2026-07-28 build stayed live until 2026-09-23 while every deploy failed, and nothing said so.
 *
 * Runs first in `build:vercel`. vercel.json serves the file with `Cache-Control: no-store`,
 * and the service worker never touches it (its precache only takes js/css/html/woff2).
 *
 * It never fails the build. A stamp is not worth a blocked deploy: with no usable sha it
 * writes nothing, and the drift check then reports production's missing stamp instead.
 */
import {execFileSync} from 'node:child_process';
import {rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'apps', 'web', 'public', 'version.json');
const FULL_SHA = /^[0-9a-f]{40}$/;

/**
 * Which commit is this build? Production builds run in GitHub Actions (deploy.yml runs
 * `vercel build` there), where GITHUB_SHA is the pushed commit. Vercel's own Git builds (PR
 * previews) have no GITHUB_SHA but set VERCEL_GIT_COMMIT_SHA. `git rev-parse HEAD` covers
 * local builds. GITHUB_SHA goes first because a CLI build can inherit VERCEL_GIT_COMMIT_SHA
 * from `vercel pull`, and nothing guarantees that value belongs to this build.
 *
 * Empty sources are skipped, and a value that is not a full sha is skipped with a warning.
 * Returns {sha, source}, or null when no source answers. `gitHead` is only called when both
 * environment variables are empty. Exported for scripts/write-version.test.mjs.
 */
export function resolveBuildSha(env, gitHead, warn = console.warn) {
  const sources = [
    ['GITHUB_SHA', () => env.GITHUB_SHA],
    ['VERCEL_GIT_COMMIT_SHA', () => env.VERCEL_GIT_COMMIT_SHA],
    ['git rev-parse HEAD', gitHead],
  ];
  for (const [source, read] of sources) {
    const value = read()?.trim();
    if (!value) continue;
    if (FULL_SHA.test(value)) return {sha: value, source};
    warn(`[version] ignoring ${source}: not a full commit sha ("${value}")`);
  }
  return null;
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

function writeStamp() {
  const found = resolveBuildSha(process.env, gitHead);
  if (!found) {
    // Never ship a stale stamp from an earlier local build.
    rmSync(OUT, {force: true});
    console.warn('[version] no commit sha available; version.json not written');
    return;
  }
  writeFileSync(OUT, `${JSON.stringify({sha: found.sha, builtAt: new Date().toISOString()})}\n`);
  console.log(`[version] ${found.sha} (from ${found.source}) -> apps/web/public/version.json`);
}

function main() {
  try {
    writeStamp();
  } catch (e) {
    // Never fail the build over the stamp: without one, deploy-drift reports the gap.
    console.warn(`[version] could not write version.json: ${e.message}`);
  }
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
