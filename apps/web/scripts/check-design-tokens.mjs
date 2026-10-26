#!/usr/bin/env node
// Design-token value-grep gate (#508, Design System Enforcement Wave 1).
//
// The AST rules (eslint-rules/index.js) cannot see literals inside cssText
// strings, quoted CSS shorthands, .css files, or index.html. This gate greps
// the LITERAL VALUES of the tokens themselves — every hex parsed live from
// inkweave-ui's token files (the needle list can never rot), the EASING linear() strings,
// the font family names, and three hard tripwires ('Barlow', 'Tinos', backdrop-filter).
// It reads the app's source and inkweave-ui's (packages/ui/src), keyed from the repo root.
// In .css and .html, which ESLint never reads, it also counts raw values that
// are not tokens at all (#546): literal rgb()/rgba(), keyword and bezier
// easings, and hexes no token declares.
//
// Baseline: scripts/known-design-values.json maps file -> hit count at
// enforcement day, and a .css or .html file's raw values to an entry of their
// own, `<file> (raw)`. A NEW entry, or an INCREASED count, fails; a decreased
// count prints a prompt to shrink the baseline. Tripwires have no baseline:
// any hit fails, in public/ and e2e/ as well (#912).
//
// Usage:
//   node scripts/check-design-tokens.mjs                  # gate (exit 1 on violation)
//   node scripts/check-design-tokens.mjs --update-baseline # rewrite the baseline
//
// House pattern: scripts/check-story-coverage.mjs (ledger + exit codes).
import {readdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..'); // apps/web
const REPO = join(ROOT, '..', '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'known-design-values.json');
// The files that declare token values: every hex they hold is a needle. Both live in inkweave-ui
// (#978), and the ink colours only in lorcana.ts.
const TOKEN_FILES = ['theme.ts', 'lorcana.ts'].map((file) =>
  join(REPO, 'packages', 'ui', 'src', 'tokens', file),
);
// Declaration sites are exempt from the scan.
const DECLARATION_FILES = [...TOKEN_FILES, join(ROOT, 'src', 'shared', 'constants', 'playstyleUi.ts')];
const THEME = TOKEN_FILES.map((file) => readFileSync(file, 'utf8')).join('\n');
// The app's source and the shared package's. A missing folder throws: never scan less in silence.
const SOURCE_DIRS = [join(ROOT, 'src'), join(REPO, 'packages', 'ui', 'src')];

// ── Needles ────────────────────────────────────────────────────────────
// Every hex the theme declares, longest-first so #d4af37 wins over #d4a.
const TOKEN_HEXES = [...new Set((THEME.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase()))];
if (TOKEN_HEXES.length === 0) {
  console.error('✗ TOKEN_FILES declare no hex: is a token file missing?');
  process.exit(2);
}
// The spring curves: any verbatim copy outside theme.ts is a fork that will drift.
const EASING_STRINGS = THEME.match(/linear\([^)]+\)/g) ?? [];
const FONT_NAMES = ['Plus Jakarta Sans', 'Marcellus'];
// Tripwires: zero tolerance, no baseline. backdrop-filter matches USAGE
// (declaration/property form), not the prose warning comments at scrim sites.
const TRIPWIRES = [
  {name: "'Barlow' (legacy font, fully purged)", re: /Barlow/},
  {name: "'Tinos' (the hero serif before Marcellus, fully purged)", re: /\btinos\b/i},
  {name: 'backdrop-filter usage', re: /backdrop-filter\s*:|backdropFilter\s*:/},
];
// Raw values in the files ESLint never reads (#546). Their count is baselined
// apart from the token values, so today's freeze holds, a new one fails, and
// none can hide behind a token value that the same change removed. A hex needs
// 6 or 8 digits, since index.css cites issues as #332; a token hex is already a
// needle above.
const UNLINTED = /\.(css|html)$/;
const RAW_ENTRY = ' (raw)';
const RAW_VALUES = [/rgba?\(\s*\d/g, /cubic-bezier\(|\bease(?:-in-out|-in|-out)?\b/g];
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g;

// ── Scan scope ─────────────────────────────────────────────────────────
// Everything that can carry styles is in, but DECLARATION_FILES.
const EXTENSIONS = /\.(ts|tsx|css|html)$/;
// The tripwires also read the rest of the app's text (#912): a purged font named
// in public/ or e2e/ is as stale as one in src/. Only the tripwires, since those
// files' values are not the app's styles and carry no baseline. public/data is
// card data and public/mockups git-ignored design scratch, so neither is read.
const TRIPWIRE_ONLY_DIRS = [join(ROOT, 'public'), join(ROOT, 'e2e')];
const TEXT_EXTENSIONS = /\.(ts|tsx|js|mjs|css|html|svg|json|md|txt|xml)$/;
const UNREAD_DIRS = [join(ROOT, 'public', 'data'), join(ROOT, 'public', 'mockups')];
const BUILD_DIRS = /node_modules|dist|coverage|storybook-static/;

function* walk(dir, extensions) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (!BUILD_DIRS.test(entry) && !UNREAD_DIRS.includes(p)) yield* walk(p, extensions);
    } else if (extensions.test(entry)) {
      yield p;
    }
  }
}

const files = [...SOURCE_DIRS.flatMap((dir) => [...walk(dir, EXTENSIONS)]), join(ROOT, 'index.html')];
const tripwireOnlyFiles = TRIPWIRE_ONLY_DIRS.flatMap((dir) => [...walk(dir, TEXT_EXTENSIONS)]);

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

/** Literal rgb()/rgba(), easings, and hexes that are not token values. */
function countRawValues(text) {
  const strayHexes = (text.match(HEX_COLOR) ?? []).filter((hex) => !TOKEN_HEXES.includes(hex.toLowerCase()));
  return RAW_VALUES.reduce((sum, re) => sum + (text.match(re) ?? []).length, strayHexes.length);
}

/** The names of the tripwires `text` trips. */
const tripwiresIn = (text) => TRIPWIRES.filter((t) => t.re.test(text)).map((t) => t.name);

function countHits(file) {
  const text = readFileSync(file, 'utf8');
  const values =
    sumNeedleHits(text.toLowerCase(), TOKEN_HEXES) +
    sumNeedleHits(text, EASING_STRINGS) +
    sumNeedleHits(text, FONT_NAMES);
  const raw = UNLINTED.test(file) ? countRawValues(text) : 0;
  return {values, raw, trips: tripwiresIn(text)};
}

/** How many files the entries cover (a file can have a token entry and a raw one). */
const fileCount = (entries) => new Set(Object.keys(entries).map((key) => key.replace(RAW_ENTRY, ''))).size;

const relPath = (file) => relative(REPO, file).replaceAll('\\', '/');

const current = {};
const tripHits = [];
for (const file of files) {
  if (DECLARATION_FILES.includes(file)) continue;
  const rel = relPath(file);
  const {values, raw, trips} = countHits(file);
  if (values > 0) current[rel] = values;
  if (raw > 0) current[rel + RAW_ENTRY] = raw;
  for (const t of trips) tripHits.push(`${rel}: '${t}'`);
}
for (const file of tripwireOnlyFiles) {
  for (const t of tripwiresIn(readFileSync(file, 'utf8'))) tripHits.push(`${relPath(file)}: '${t}'`);
}

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`✅ Baseline updated: ${fileCount(current)} files carry token-value literals or raw values.`);
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
  if (base === undefined) violations.push(`NEW file restates token values or carries raw ones: ${file} (x${count})`);
  else if (count > base) violations.push(`Value count INCREASED: ${file} (${base} -> ${count})`);
  else if (count < base) shrunk.push(`${file} (${base} -> ${count})`);
}
for (const [file, base] of Object.entries(baseline)) {
  if (current[file] === undefined) shrunk.push(`${file} (${base} -> 0, remove from baseline)`);
}
for (const hit of tripHits) violations.push(`TRIPWIRE: ${hit} (zero tolerance — 'Barlow' and 'Tinos' are purged, backdrop-filter hangs WebKit E2E #444/#445)`);

if (shrunk.length > 0) {
  console.log('ℹ Files came cleaner than the baseline — shrink it when convenient (--update-baseline):');
  for (const s of shrunk) console.log(`   ${s}`);
}
if (violations.length > 0) {
  console.error('✗ Design-token value gate failed:');
  for (const v of violations) console.error(`   ${v}`);
  console.error('  Use the token (COLORS.*, EASING.*, FONTS.*) instead of restating its value; see .claude/rules/design-tokens.md.');
  console.error('  In .css and .html, raw rgb()/rgba(), easings and hexes no token declares count too: style inline with tokens, or pass a token in through a CSS variable.');
  process.exit(1);
}
console.log(`✅ Design-token value gate passed (${fileCount(current)} baselined files, ${TOKEN_HEXES.length} token hexes guarded, ${tripwireOnlyFiles.length} more files read for the tripwires).`);
