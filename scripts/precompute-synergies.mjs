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
 * Usage:
 *   node scripts/precompute-synergies.mjs           # Normal run
 *   node scripts/precompute-synergies.mjs --verbose  # Show per-card output
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const OUTPUT_DIR = path.join(ROOT, 'apps/web/public/data/synergies');
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
  const {synergyEngine, getAllPlaystyles, transformCards} = await import(engineUrl.href);

  // Load and transform card data using the engine's shared transformer
  const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const rawCount = rawData.cards.length;
  const cards = transformCards(rawData.cards);
  console.log(`  ${cards.length}/${rawCount} cards loaded`);
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

  // Write manifest (last — used as staleness marker by Vite plugin)
  fs.writeFileSync(path.join(OUTPUT_DIR, '_manifest.json'), JSON.stringify(manifest));

  // Clean up stale files from previous runs (safe: new files already written)
  const newFiles = new Set([
    ...manifest.map((id) => `${id}.json`),
    '_playstyles.json',
    '_manifest.json',
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
  console.log(`  Output: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Pre-computation failed:', err);
  process.exit(1);
});
