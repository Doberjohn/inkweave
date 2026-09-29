#!/usr/bin/env node
/**
 * Fold Epic/Enchanted/Iconic printings from a LorcanaJSON export into our card data (#625).
 *
 * - allCards.json: canonical cards match on LorcanaJSON's `baseId` (our ids are LorcanaJSON's)
 *   and keep the LorcanaJSON variant id.
 * - previewCards.json: reveal-set cards match on set + full name (preview ids are
 *   REVEAL_ID_BASE + number, not LorcanaJSON's) and get a reveal-convention id, so a variant
 *   first added from a manual scan and later synced with official art lands on the same id.
 *
 * Only variants from sets the target file holds are considered, so the export's pre-Core sets
 * are not reported as unmatched. Idempotent: a second run changes nothing.
 *
 * Usage:
 *   pnpm sync-variants <lorcanajson-allCards.json>           # dry run: report only
 *   pnpm sync-variants <lorcanajson-allCards.json> --write   # write both data files
 *
 * The export: https://lorcanajson.org/files/current/en/allCards.json.zip (unzip anywhere
 * outside the repo; never commit it). Writing the files directly bypasses the
 * preview-data-auto-precompute hook, so run `pnpm precompute-synergies` afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {foldVariants} from './lib/fold-variants.mjs';
import {loadSeason} from './reveal-sync/web.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL_CARDS = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const PREVIEW_AVIFS_DIR = path.join(ROOT, 'apps/web/public/card-images-preview');

function fromSetsIn(cards, source) {
  const sets = new Set(cards.map((c) => String(c.setCode)));
  return source.filter((v) => sets.has(String(v.setCode)));
}

/**
 * Fold `source` variants into both data files' cards (mutated in place) and report per file.
 * `shadowed` lists preview variant ids that now have official art but still have a committed
 * manual scan AVIF, which the image build prefers until it is deleted.
 */
export function syncVariants({allData, previewData, source, season, previewAvifExists}) {
  const canonical = foldVariants(allData.cards, fromSetsIn(allData.cards, source), {
    matchBy: 'baseId',
    idFor: (v) => v.id,
  });
  // Empty once the reveal set graduates, so its variants are not reported as unmatched here.
  const revealSource = fromSetsIn(previewData.cards, source).filter(
    (v) => String(v.setCode) === season.setCode,
  );
  const preview = foldVariants(previewData.cards, revealSource, {
    matchBy: 'name',
    idFor: (v) => season.idBase + v.number,
  });
  const shadowed = previewData.cards
    .flatMap((c) => c.variants ?? [])
    .filter((v) => v.images && previewAvifExists(v.id))
    .map((v) => v.id);
  return {canonical, preview, shadowed};
}

const describeVariant = (v) => `${v.setCode}/${v.number} ${v.rarity} ${v.fullName}`;

function printReport(label, result) {
  console.log(
    `  ${label}: +${result.folded.length} folded, ${result.replaced.length} replaced, ` +
      `${result.unchanged.length} unchanged, ${result.unmatched.length} unmatched`,
  );
  for (const v of result.unmatched) console.log(`    unmatched: ${describeVariant(v)}`);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Replaces `file` whole: the JSON goes to a temporary file beside it, then a rename swaps it in,
 * so an interrupted run leaves the old file rather than half-written JSON.
 */
function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

async function main() {
  const [sourceArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const write = process.argv.includes('--write');
  if (!sourceArg || !fs.existsSync(sourceArg)) {
    console.error('Usage: pnpm sync-variants <lorcanajson-allCards.json> [--write]');
    process.exit(2);
  }

  const exported = readJson(path.resolve(sourceArg));
  const allData = readJson(ALL_CARDS);
  const previewData = readJson(PREVIEW);
  const season = await loadSeason();
  const report = syncVariants({
    allData,
    previewData,
    source: exported.cards ?? exported,
    season,
    // Both sizes: download-card-images' hasPreviewAvifs prefers a scan over the official art
    // only when the full and the small AVIF both exist, so a half-finished conversion
    // shadows nothing.
    previewAvifExists: (id) =>
      ['', '-sm'].every((s) => fs.existsSync(path.join(PREVIEW_AVIFS_DIR, `${id}${s}.avif`))),
  });

  console.log(`\n  Variant sync from ${sourceArg}${write ? '' : ' (dry run, nothing written)'}\n`);
  printReport('allCards.json    ', report.canonical);
  printReport('previewCards.json', report.preview);
  for (const id of report.shadowed) {
    console.warn(
      `  ! ${id} now has official art, but card-images-preview/${id}.avif shadows it: delete that manual scan (and its -sm) to switch.`,
    );
  }

  if (!write) return;
  writeJson(ALL_CARDS, allData);
  writeJson(PREVIEW, previewData);
  console.log('\n  Wrote allCards.json and previewCards.json. Next: pnpm precompute-synergies\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
