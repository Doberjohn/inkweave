// Copies the root-relative public assets the components request into ds-bundle/.
//
// WHY THIS EXISTS: several components build image URLs as ROOT-RELATIVE literals
// inside the component (never as props) — `frameFor()` returns
// `/art/frames/<slug>.webp`, CompactHeader requests `/brand/logo.svg`, RevealHero
// `/art/sets/…`, NewFranchises `/art/franchises/…`. Storybook serves those via
// `staticDirs: ['../public']`, but the preview server has ONE static root
// (ds-bundle) and the uploaded project has no `public/` either. So they 404 in
// previews AND in every design the claude.ai/design agent builds — a broken-image
// box wherever a deck card, reveal hero or app header appears.
//
// MUST RUN AFTER package-build.mjs, not before: the build wipes its --out dir, so
// this cannot live in cfg.buildCmd (which runs first). Post-build step, documented
// in NOTES.md.
//
// Run: node .design-sync/copy-assets.mjs [--out ./ds-bundle]
import {cpSync, existsSync, mkdirSync, readdirSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PUBLIC = join(HERE, '..', 'apps', 'web', 'public');

const outFlag = process.argv.indexOf('--out');
const OUT = outFlag > -1 ? process.argv[outFlag + 1] : join(HERE, '..', 'ds-bundle');

// art/banner/ is deliberately EXCLUDED: 2.0 MB, and its only consumer is
// SynergyBanner, which has no story and is therefore not a synced component.
// Re-check this if SynergyBanner ever gains one.
const SETS = [
  ['art/frames', 'DeckSummaryCard — the ink-pair deck frames'],
  ['art/sets', 'RevealHero, RevealsPromoCard'],
  ['art/franchises', 'NewFranchises'],
  ['art/backgrounds', 'binder/browse backdrops'],
  ['brand', 'CompactHeader, HeroSection, HomePageSkeleton — the wordmark'],
];

const bytes = (dir) =>
  readdirSync(dir, {withFileTypes: true}).reduce(
    (n, e) =>
      n + (e.isDirectory() ? bytes(join(dir, e.name)) : statSync(join(dir, e.name)).size),
    0,
  );
const count = (dir) =>
  readdirSync(dir, {withFileTypes: true}).reduce(
    (n, e) => n + (e.isDirectory() ? count(join(dir, e.name)) : 1),
    0,
  );

let totalFiles = 0;
let totalBytes = 0;
let missing = 0;

for (const [rel, why] of SETS) {
  const src = join(PUBLIC, rel);
  if (!existsSync(src)) {
    console.error(`  ! ${rel} not found in apps/web/public — skipped (${why})`);
    missing++;
    continue;
  }
  const dest = join(OUT, rel);
  mkdirSync(dirname(dest), {recursive: true});
  cpSync(src, dest, {recursive: true});
  const n = count(src);
  const b = bytes(src);
  totalFiles += n;
  totalBytes += b;
  console.log(`  ${rel}: ${n} file(s), ${(b / 1024).toFixed(0)} KB — ${why}`);
}

console.log(
  `copy-assets: ${totalFiles} file(s), ${(totalBytes / 1024 / 1024).toFixed(2)} MB → ${OUT}` +
    ` (art/banner excluded: 2.0 MB, no synced consumer)`,
);
if (missing) process.exit(1);
