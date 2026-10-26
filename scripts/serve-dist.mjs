#!/usr/bin/env node
/**
 * A static server over a build's output that answers the way vercel.json does (#915), to see a
 * crawled build as a visitor's browser gets it: scripts/check-prerender-handoff.mjs serves
 * through it, and so can a look by hand.
 *
 * - A path that names a file gets that file, and one that names a folder gets its index.html,
 *   where the prerender crawl writes each route (dist/<route>/index.html).
 * - Any other path without a dot gets dist/index.html, the home page's capture, as vercel.json's
 *   catch-all rewrite serves it; a path with a dot that names no file is a 404.
 * - Every response carries vercel.json's site-wide headers, its Content-Security-Policy among
 *   them, so a page runs under the policy production enforces.
 *
 * Usage: node scripts/serve-dist.mjs [--port 4180] [--dir apps/web/dist]
 * Build and crawl first: `pnpm build:web`, then `PRERENDER_SAMPLE=1 node scripts/prerender.mjs`.
 */
import {createServer} from 'node:http';
import {readFileSync, statSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {dirname, extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {contentType} from './lib/mime.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** vercel.json's catch-all rewrite to /index.html, `/((?!.*\.).*)`: every path without a dot. */
const REWRITTEN = /^\/[^.]*$/;

/** True for a file, false for a folder, undefined for nothing at all. */
function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return undefined;
  }
}

/**
 * The file a request for `url` gets from `dist`, or undefined for a 404. Exported for
 * scripts/serve-dist.test.mjs.
 */
export function resolveDistFile(dist, url) {
  let path;
  try {
    path = decodeURIComponent(url.split('?')[0]);
  } catch {
    return undefined; // a malformed escape names no file
  }
  const target = join(dist, path);
  if (target !== dist && !target.startsWith(dist + sep)) return undefined;
  const found = isFile(target);
  if (found) return target;
  if (found === false && isFile(join(target, 'index.html'))) return join(target, 'index.html');
  return REWRITTEN.test(path) ? join(dist, 'index.html') : undefined;
}

/**
 * The headers vercel.json gives every path: its entries whose source is "/(.*)" with no `has`
 * condition (a `has` entry, such as staging's noindex, answers one host only).
 */
export function siteHeaders(config) {
  return Object.fromEntries(
    (config.headers ?? [])
      .filter((entry) => entry.source === '/(.*)' && !entry.has)
      .flatMap((entry) => entry.headers.map(({key, value}) => [key, value])),
  );
}

/** vercel.json's site-wide headers, read from the repo. */
export function readSiteHeaders() {
  return siteHeaders(JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')));
}

/**
 * A server over `dist` that answers as vercel.json does, with `headers` on every response.
 * `sendPage(res, body, url)`, if given, sends each HTML page in place of sending it whole:
 * scripts/check-prerender-handoff.mjs sends one in two parts, as a slow network delivers it.
 * `bodyFor(file, url)`, if given, may answer with a body of its own in place of the file's, or
 * undefined for the file's, and the response waits for it: scripts/check-sw-update.mjs serves
 * two deploys of one build through it, and holds a request.
 */
export function createDistServer(dist, {headers = readSiteHeaders(), sendPage, bodyFor} = {}) {
  return createServer((req, res) => {
    void (async () => {
      const url = req.url ?? '/';
      const file = resolveDistFile(dist, url);
      if (!file) {
        res.writeHead(404, headers);
        res.end('not found');
        return;
      }
      let body;
      try {
        body = (await bodyFor?.(file, url)) ?? (await readFile(file));
      } catch {
        // Gone since it was found, as when a rebuild empties dist under a running server.
        res.writeHead(500, headers);
        res.end('could not read the file');
        return;
      }
      res.writeHead(200, {...headers, 'Content-Type': contentType(extname(file))});
      if (sendPage && extname(file) === '.html') sendPage(res, body, url);
      else res.end(body);
    })();
  });
}

function main() {
  const {values} = parseArgs({
    options: {
      port: {type: 'string', default: '4180'},
      dir: {type: 'string', default: 'apps/web/dist'},
    },
  });
  const dist = resolve(ROOT, values.dir);
  if (!isFile(join(dist, 'index.html'))) {
    console.error(`[serve-dist] ${dist}/index.html not found: run \`pnpm build:web\` first`);
    process.exit(1);
  }
  createDistServer(dist).listen(Number(values.port), () => {
    console.log(`[serve-dist] ${dist} at http://localhost:${values.port}`);
  });
}

// Run only when invoked directly (never when imported).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
