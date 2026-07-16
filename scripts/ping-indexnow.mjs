#!/usr/bin/env node
/**
 * Pings IndexNow so Bing / DuckDuckGo (and other IndexNow consumers) re-crawl near-instantly
 * (issue #496). Hosts nothing itself; it reads the key from the hosted key file and POSTs a
 * URL list to the IndexNow API.
 *
 * Wired into .github/workflows/deploy.yml as a NON-FATAL post-deploy step, so a ping failure
 * never fails the deploy. By default it pings the hub URLs; the `buildPayload` export takes an
 * explicit list so the future reveal-admin flow can ping only newly-revealed cards.
 *
 * Usage:
 *   node scripts/ping-indexnow.mjs            # ping the hub URLs
 *   node scripts/ping-indexnow.mjs --dry-run  # print the payload, POST nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOST = 'inkweave.ink';
const SITE_ORIGIN = `https://${HOST}`;
const PUBLIC_DIR = path.join(ROOT, 'apps/web/public');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Default set: the crawlable hub pages. Per-card pings pass their own list to buildPayload. */
export const HUB_URLS = ['/', '/browse', '/playstyles'].map((r) => `${SITE_ORIGIN}${r}`);

/**
 * Discover the hosted IndexNow key: the `<hex>.txt` in public/ whose filename IS the key
 * (IndexNow convention). Reading it from disk keeps the ping in sync if the key is ever rotated.
 */
export function findKey() {
  const match = fs
    .readdirSync(PUBLIC_DIR)
    .find((f) => /^[a-f0-9]{8,128}\.txt$/.test(f));
  if (!match) throw new Error('No IndexNow key file (public/<hex>.txt) found');
  return match.replace(/\.txt$/, '');
}

/** Build the IndexNow POST payload. Pure. */
export function buildPayload(urlList, key) {
  return {host: HOST, key, keyLocation: `${SITE_ORIGIN}/${key}.txt`, urlList};
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const payload = buildPayload(HUB_URLS, findKey());

  if (dryRun) {
    console.log('[indexnow] dry-run payload:\n' + JSON.stringify(payload, null, 2));
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json; charset=utf-8'},
    body: JSON.stringify(payload),
  });
  console.log(`[indexnow] POST ${res.status} for ${payload.urlList.length} URL(s)`);
  // 200 = accepted, 202 = accepted (pending key validation). Anything else is a soft problem —
  // the deploy step wraps this in `|| true`, so a non-zero exit never fails the deploy.
  if (res.status !== 200 && res.status !== 202) {
    console.warn(`[indexnow] unexpected status: ${await res.text().catch(() => '')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('[indexnow]', e.message);
    process.exit(1);
  });
}
