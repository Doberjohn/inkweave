#!/usr/bin/env node
/**
 * Startup shape check (#978), run by Performance Gates' Bundle Size job on PRs and master.
 *
 * Startup loads four JS files: the entry and its three modulepreloads (rolldown's runtime and
 * the two STARTUP_* groups in apps/web/vite.config.ts, #789). A module that a lazy chunk newly
 * shares, and no STARTUP_SHARED line names, splits into a fifth file; startupGroupsGuard fails a
 * stale line but never sees that, and size-limit's budgets barely move. The critical CSS that
 * the inline-css plugin puts in index.html must also keep the kit's focus ring, overlay
 * transitions and quantity pop, wherever their stylesheet lives.
 *
 * Usage:
 *   node scripts/check-bundle-shape.mjs <distDir>
 *     reads <distDir>/index.html and fails unless startup loads STARTUP_JS_FILES JS files and
 *     its <style> text matches every REQUIRED_STARTUP_CSS pattern.
 *   node scripts/check-bundle-shape.mjs --compare <base> <head> [--max-growth <bytes>]
 *     reads each folder's index.html and size.json (`size-limit --json`), prints each row's
 *     delta, and fails when a WATCHED_ROWS row grew more than the allowance (MAX_GROWTH_BYTES
 *     unless given), a row is missing from either side, or the JS file or style block counts
 *     differ.
 */
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const STARTUP_JS_FILES = 4;
export const REQUIRED_STARTUP_CSS = [
  /(^|[}>,\s]):focus-visible\{/,
  /\.inset-focus-ring\{/,
  /\.overlay-transition\{/,
  /@keyframes inkweave-qty-pop\b/,
];
export const MAX_GROWTH_BYTES = 100;
export const WATCHED_ROWS = ['User-facing JS', 'Entry chunk'];

const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}=["']?([^"'\\s>]+)`, 'i'))?.[1];

/** True for `<script type="module" src>` and `<link rel="modulepreload">`: the JS startup fetches. */
function isStartupJs(tag) {
  if (/^<script/i.test(tag))
    return attribute(tag, 'type') === 'module' && Boolean(attribute(tag, 'src'));
  return attribute(tag, 'rel') === 'modulepreload';
}

/** The JS files startup loads, in document order, and the text and count of its <style> blocks. */
export function readShape(html) {
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) ?? [];
  const jsFiles = [
    ...new Set(
      tags.filter(isStartupJs).map((tag) => attribute(tag, 'src') ?? attribute(tag, 'href')),
    ),
  ];
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  return {jsFiles, styleBlocks: styles.length, styleText: styles.join('\n')};
}

/** What is wrong with a build's startup shape: an empty list when it holds. */
export function shapeProblems(html) {
  const {jsFiles, styleText} = readShape(html);
  const problems = [];
  if (jsFiles.length !== STARTUP_JS_FILES) {
    problems.push(
      `startup loads ${jsFiles.length} JS files, not ${STARTUP_JS_FILES}: ${jsFiles.join(', ')}`,
    );
  }
  for (const pattern of REQUIRED_STARTUP_CSS) {
    if (!pattern.test(styleText)) problems.push(`no startup <style> matches ${pattern}`);
  }
  return problems;
}

const sizesByName = (rows) => new Map(rows.map((row) => [row.name, row.size]));

/** Each size-limit row both sides hold, with its base and head sizes in bytes. */
export function sizeDeltas(baseRows, headRows) {
  const head = sizesByName(headRows);
  return baseRows
    .filter((row) => head.has(row.name))
    .map((row) => ({
      name: row.name,
      base: row.size,
      head: head.get(row.name),
      delta: head.get(row.name) - row.size,
    }));
}

function missingRows(base, head) {
  const names = (rows) => new Set(rows.map((row) => row.name));
  const [baseNames, headNames] = [names(base), names(head)];
  return [
    ...[...baseNames]
      .filter((name) => !headNames.has(name))
      .map((name) => `size-limit row "${name}" is missing from the head`),
    ...[...headNames]
      .filter((name) => !baseNames.has(name))
      .map((name) => `size-limit row "${name}" is missing from the base`),
  ];
}

function countChanges(base, head) {
  const [before, after] = [readShape(base.html), readShape(head.html)];
  const changes = [];
  if (before.jsFiles.length !== after.jsFiles.length) {
    changes.push(`startup JS files went from ${before.jsFiles.length} to ${after.jsFiles.length}`);
  }
  if (before.styleBlocks !== after.styleBlocks) {
    changes.push(`startup <style> blocks went from ${before.styleBlocks} to ${after.styleBlocks}`);
  }
  return changes;
}

/**
 * What fails a head against its base, each `{sizes, html}`: size-limit's JSON rows and the
 * build's index.html.
 */
export function compareProblems(base, head, maxGrowth = MAX_GROWTH_BYTES) {
  const grown = sizeDeltas(base.sizes, head.sizes)
    .filter((row) => WATCHED_ROWS.includes(row.name) && row.delta > maxGrowth)
    .map((row) => `${row.name} grew ${row.delta} B, more than ${maxGrowth} B`);
  return [...missingRows(base.sizes, head.sizes), ...grown, ...countChanges(base, head)];
}

function readBuild(dir) {
  return {
    sizes: JSON.parse(readFileSync(join(dir, 'size.json'), 'utf8')),
    html: readFileSync(join(dir, 'index.html'), 'utf8'),
  };
}

function parseGrowth(value) {
  const bytes = Number(value);
  if (!Number.isInteger(bytes) || bytes < 0)
    throw new Error(`--max-growth takes a whole number of bytes, not "${value}"`);
  return bytes;
}

function runCompare([baseDir, headDir, flag, value]) {
  const maxGrowth = flag === '--max-growth' ? parseGrowth(value) : MAX_GROWTH_BYTES;
  const [base, head] = [readBuild(baseDir), readBuild(headDir)];
  for (const row of sizeDeltas(base.sizes, head.sizes)) {
    const sign = row.delta > 0 ? '+' : '';
    console.log(`${row.name}: ${row.base} B to ${row.head} B (${sign}${row.delta} B)`);
  }
  return compareProblems(base, head, maxGrowth);
}

function runShape(distDir) {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const problems = shapeProblems(html);
  if (problems.length === 0) {
    const {jsFiles, styleBlocks} = readShape(html);
    console.log(`Startup shape OK: ${jsFiles.length} JS files, ${styleBlocks} style blocks`);
  }
  return problems;
}

function main(args) {
  if (!args[0])
    throw new Error(
      'Usage: check-bundle-shape.mjs <distDir> | --compare <base> <head> [--max-growth <bytes>]',
    );
  const problems = args[0] === '--compare' ? runCompare(args.slice(1)) : runShape(args[0]);
  for (const problem of problems) console.error(`✗ ${problem}`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
