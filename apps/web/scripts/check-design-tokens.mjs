#!/usr/bin/env node
// Design-token value-grep gate (#508, Design System Enforcement Wave 1).
//
// The AST rules (eslint-rules/index.js) cannot see literals inside cssText
// strings, quoted CSS shorthands, .css files, or index.html. This gate greps
// the LITERAL VALUES of the tokens themselves — every COLORS hex parsed live
// from theme.ts (the needle list can never rot), the EASING linear() strings,
// the font family names, and two hard tripwires ('Barlow', backdrop-filter).
//
// Baseline: scripts/known-design-values.json maps file -> hit count at
// enforcement day. A NEW file with hits, or an INCREASED count, fails; a
// decreased count prints a prompt to shrink the baseline. Tripwires have no
// baseline: any hit fails.
//
// Usage:
//   node scripts/check-design-tokens.mjs                  # gate (exit 1 on violation)
//   node scripts/check-design-tokens.mjs --update-baseline # rewrite the baseline
//
// House pattern: scripts/check-story-coverage.mjs (ledger + exit codes).
import {readdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'known-design-values.json');
const THEME = readFileSync(join(ROOT, 'src', 'shared', 'constants', 'theme.ts'), 'utf8');

// ── Needles ────────────────────────────────────────────────────────────
// Every hex the theme declares, longest-first so #d4af37 wins over #d4a.
const TOKEN_HEXES = [...new Set((THEME.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase()))];
// The spring curves: any verbatim copy outside theme.ts is a fork that will drift.
const EASING_STRINGS = THEME.match(/linear\([^)]+\)/g) ?? [];
const FONT_NAMES = ['Plus Jakarta Sans', 'Marcellus'];
// Tripwires: zero tolerance, no baseline. backdrop-filter matches USAGE
// (declaration/property form), not the prose warning comments at scrim sites.
const TRIPWIRES = [
  {name: "'Barlow' (legacy font, fully purged)", re: /Barlow/},
  {name: 'backdrop-filter usage', re: /backdrop-filter\s*:|backdropFilter\s*:/},
];

// ── Scan scope ─────────────────────────────────────────────────────────
// Declaration sites are exempt; everything else that can carry styles is in.
const EXEMPT = [/src[\\/]shared[\\/]constants[\\/]theme\.ts$/, /src[\\/]shared[\\/]constants[\\/]playstyleUi\.ts$/];
const EXTENSIONS = /\.(ts|tsx|css|html)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (!/node_modules|dist|coverage|storybook-static/.test(entry)) yield* walk(p);
    } else if (EXTENSIONS.test(entry)) {
      yield p;
    }
  }
}

const files = [...walk(join(ROOT, 'src')), join(ROOT, 'index.html')];

/** Occurrences of `needle` in `haystack` (plain substring scan). */
function countOccurrences(haystack, needle) {
  let count = 0;
  let i = -1;
  while ((i = haystack.indexOf(needle, i + 1)) !== -1) count += 1;
  return count;
}

/** Total occurrences of every needle in `text` against the given haystack. */
function sumNeedleHits(haystack, needles) {
  return needles.reduce((sum, needle) => sum + countOccurrences(haystack, needle), 0);
}

function countHits(text) {
  const tokens =
    sumNeedleHits(text.toLowerCase(), TOKEN_HEXES) +
    sumNeedleHits(text, EASING_STRINGS) +
    sumNeedleHits(text, FONT_NAMES);
  const trips = TRIPWIRES.filter((t) => t.re.test(text)).map((t) => t.name);
  return {tokens, trips};
}

const current = {};
const tripHits = [];
for (const file of files) {
  if (EXEMPT.some((re) => re.test(file))) continue;
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const {tokens, trips} = countHits(readFileSync(file, 'utf8'));
  if (tokens > 0) current[rel] = tokens;
  for (const t of trips) tripHits.push(`${rel}: '${t}'`);
}

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`✅ Baseline updated: ${Object.keys(current).length} files carry token-value literals.`);
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('✗ Missing baseline. Run: node scripts/check-design-tokens.mjs --update-baseline');
  process.exit(2);
}

const violations = [];
const shrunk = [];
for (const [file, count] of Object.entries(current)) {
  const base = baseline[file];
  if (base === undefined) violations.push(`NEW file restates token values: ${file} (x${count})`);
  else if (count > base) violations.push(`Token-value count INCREASED: ${file} (${base} -> ${count})`);
  else if (count < base) shrunk.push(`${file} (${base} -> ${count})`);
}
for (const [file, base] of Object.entries(baseline)) {
  if (current[file] === undefined) shrunk.push(`${file} (${base} -> 0, remove from baseline)`);
}
for (const hit of tripHits) violations.push(`TRIPWIRE: ${hit} (zero tolerance — 'Barlow' is purged, backdrop-filter hangs WebKit E2E #444/#445)`);

if (shrunk.length > 0) {
  console.log('ℹ Files came cleaner than the baseline — shrink it when convenient (--update-baseline):');
  for (const s of shrunk) console.log(`   ${s}`);
}
if (violations.length > 0) {
  console.error('✗ Design-token value gate failed:');
  for (const v of violations) console.error(`   ${v}`);
  console.error('  Use the token (COLORS.*, EASING.*, FONTS.*) instead of restating its value; see .claude/rules/design-tokens.md.');
  process.exit(1);
}
console.log(`✅ Design-token value gate passed (${Object.keys(current).length} baselined files, ${TOKEN_HEXES.length} token hexes guarded).`);
