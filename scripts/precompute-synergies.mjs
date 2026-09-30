#!/usr/bin/env node
/**
 * Pre-computes synergies for all cards at build time.
 *
 * Outputs per-card files:
 *   apps/web/public/data/synergies/{cardId}.json
 *     { groups: [...], pairs: { cardId: { connections, aggregateScore } } }
 *
 * Plus metadata:
 *   apps/web/public/data/synergies/_playstyles.json  — playstyleId → cardId[]
 *   apps/web/public/data/synergies/_manifest.json    — cardIds with synergy files
 *
 * And the homepage's featured cards (#641):
 *   apps/web/public/data/featuredCards.json: those few cards in allCards.json's shape
 *
 * Usage:
 *   node scripts/precompute-synergies.mjs           # Normal run
 *   node scripts/precompute-synergies.mjs --verbose  # Show per-card output
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildFeaturedCards, featuredIdsSetting, resolveFeaturedIds} from './featured-cards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAIN_DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const OUTPUT_DIR = path.join(ROOT, 'apps/web/public/data/synergies');
const FEATURED_IDS_FILE = path.join(ROOT, 'apps/web/src/features/cards/featuredCardIds.json');
const FEATURED_OUTPUT = path.join(ROOT, 'apps/web/public/data/featuredCards.json');
const VERBOSE = process.argv.includes('--verbose');

async function main() {
  console.log('⚙ Pre-computing synergies...');
  const startTime = Date.now();

  // Import built engine (must run pnpm build:engine first)
  const enginePath = path.join(ROOT, 'packages/synergy-engine/dist/index.js');
  if (!fs.existsSync(enginePath)) {
    console.error('ERROR: Engine not built. Run `pnpm build:engine` first.');
    process.exit(1);
  }
  const engineUrl = new URL(`file:///${enginePath.replace(/\\/g, '/')}`);
  const {synergyEngine, getAllPlaystyles, transformCards, isCoreSet, MIN_CORE_SET} =
    await import(engineUrl.href);

  // Load and transform card data (main + optional preview) using the engine's shared transformer
  const mainData = JSON.parse(fs.readFileSync(MAIN_DATA_FILE, 'utf-8'));
  const mainIds = new Set(mainData.cards.map((c) => c.id));

  let previewCount = 0;
  let mergedRaw = mainData.cards;
  let previewData = null;
  if (fs.existsSync(PREVIEW_DATA_FILE)) {
    previewData = JSON.parse(fs.readFileSync(PREVIEW_DATA_FILE, 'utf-8'));
    // Dedup: main wins on id conflict
    const previewFiltered = previewData.cards.filter((c) => !mainIds.has(c.id));
    previewCount = previewFiltered.length;
    mergedRaw = [...mainData.cards, ...previewFiltered];
  }

  // Enforce the Core rotation floor: drop cards from sets below MIN_CORE_SET so the
  // engine only computes synergies over Core-legal cards (see engine constants.ts).
  const preCoreCount = mergedRaw.length;
  mergedRaw = mergedRaw.filter((c) => isCoreSet(c.setCode));
  if (mergedRaw.length < preCoreCount) {
    console.log(`  Core filter: dropped ${preCoreCount - mergedRaw.length} cards (sets < ${MIN_CORE_SET})`);
  }

  const rawCount = mergedRaw.length;
  const cards = transformCards(mergedRaw);
  console.log(
    `  ${cards.length}/${rawCount} cards loaded` +
      (previewCount > 0 ? ` (${previewCount} from previewCards.json)` : ''),
  );
  if (cards.length < rawCount) {
    console.warn(`  ⚠ ${rawCount - cards.length} cards skipped (invalid ink/type)`);
  }

  // Ensure output directory exists (don't clean yet — avoid data loss if script fails midway)
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  const existingFiles = new Set(fs.readdirSync(OUTPUT_DIR));

  function serializeConnection(conn) {
    const base = {
      category: conn.category,
      ruleId: conn.ruleId,
      ruleName: conn.ruleName,
      score: conn.score,
      explanation: conn.explanation,
    };
    if (conn.category === 'playstyle') base.playstyleId = conn.playstyleId;
    return base;
  }

  /**
   * Build the per-card output: groups (lightweight) + pairs (deduplicated).
   * Groups reference cards by ID only. Pair data is stored once per target card.
   */
  function serializeCardData(card, groups) {
    const pairs = {};

    const serializedGroups = groups.map((group) => ({
      groupKey: group.groupKey,
      category: group.category,
      label: group.label,
      tagline: group.tagline,
      description: group.description,
      synergies: group.synergies.map((match) => {
        // Compute pair data once per unique target card
        if (!pairs[match.card.id]) {
          const pair = synergyEngine.getPairSynergies(card, match.card);
          pairs[match.card.id] = {
            connections: pair.connections.map(serializeConnection),
            aggregateScore: pair.aggregateScore,
          };
        }

        return {
          cardId: match.card.id,
          score: match.score,
          explanation: match.explanation,
          ruleId: match.ruleId,
          ruleName: match.ruleName,
        };
      }),
    }));

    return {groups: serializedGroups, pairs};
  }

  // Pre-compute synergies for every card
  const manifest = [];
  let totalGroups = 0;
  let totalMatches = 0;

  for (const card of cards) {
    const groups = synergyEngine.findSynergies(card, cards);
    if (groups.length === 0) continue;

    const data = serializeCardData(card, groups);
    const matchCount = data.groups.reduce((sum, g) => sum + g.synergies.length, 0);

    fs.writeFileSync(path.join(OUTPUT_DIR, `${card.id}.json`), JSON.stringify(data));

    manifest.push(card.id);
    totalGroups += data.groups.length;
    totalMatches += matchCount;

    if (VERBOSE) {
      console.log(`  ${card.fullName}: ${data.groups.length} groups, ${matchCount} matches`);
    }
  }

  // Pre-compute playstyle card lists
  const playstyles = {};
  for (const ps of getAllPlaystyles()) {
    const psCards = synergyEngine.getPlaystyleCards(ps.id, cards);
    playstyles[ps.id] = psCards.map((c) => c.id);
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, '_playstyles.json'), JSON.stringify(playstyles));

  // The homepage's featured cards (#641). Written before the manifest, so the manifest stays the
  // newest file the Vite plugin's staleness check compares against.
  const defaultFeaturedIds = JSON.parse(fs.readFileSync(FEATURED_IDS_FILE, 'utf-8')).map((entry) => entry.id);
  const readWebEnvFile = (name) => {
    const file = path.join(ROOT, 'apps/web', name);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
  };
  const featuredIds = resolveFeaturedIds(featuredIdsSetting(process.env, readWebEnvFile), defaultFeaturedIds);
  const featured = buildFeaturedCards({
    main: mainData,
    preview: previewData,
    ids: featuredIds,
    isCoreSet,
    envSetting: process.env.VITE_FEATURED_CARD_IDS,
  });
  fs.writeFileSync(FEATURED_OUTPUT, JSON.stringify(featured));
  if (featured.cards.length < featuredIds.length) {
    console.warn(`  ⚠ featuredCards.json holds ${featured.cards.length}/${featuredIds.length} featured cards; the homepage falls back to the full list`);
  }

  // Write manifest (last — used as staleness marker by Vite plugin)
  fs.writeFileSync(path.join(OUTPUT_DIR, '_manifest.json'), JSON.stringify(manifest));

  // Generate pairs index for voting page (unique pairs with aggregate scores)
  const pairsIndex = [];
  const seenPairs = new Set();
  for (const cardId of manifest) {
    const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, `${cardId}.json`), 'utf-8'));
    for (const [targetId, pairData] of Object.entries(data.pairs)) {
      const [a, b] = [cardId, targetId].sort();
      const key = `${a}:${b}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        pairsIndex.push([a, b, pairData.aggregateScore]);
      }
    }
  }
  pairsIndex.sort((a, b) => b[2] - a[2]);
  fs.writeFileSync(path.join(OUTPUT_DIR, '_pairs_index.json'), JSON.stringify(pairsIndex));

  // Clean up stale files from previous runs (safe: new files already written)
  const newFiles = new Set([
    ...manifest.map((id) => `${id}.json`),
    '_playstyles.json',
    '_manifest.json',
    '_pairs_index.json',
  ]);
  for (const file of existingFiles) {
    if (!newFiles.has(file)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Pre-computed synergies in ${elapsed}s`);
  console.log(`  ${manifest.length}/${cards.length} cards with synergies`);
  console.log(`  ${totalGroups} groups, ${totalMatches} total matches`);
  console.log(`  ${Object.keys(playstyles).length} playstyles`);
  console.log(`  ${pairsIndex.length} unique pairs indexed`);
  console.log(`  ${featured.cards.length} featured cards in featuredCards.json`);
  console.log(`  Output: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Pre-computation failed:', err);
  process.exit(1);
});
