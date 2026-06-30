#!/usr/bin/env node
/**
 * Build-time precompute: joins community votes (Supabase) against engine synergy
 * artifacts and emits apps/web/public/data/vote-analytics.json.
 *
 * Reads:
 *   - Supabase pair_scores (anon key, VITE_SUPABASE_ANON_KEY) — core gap data
 *   - Supabase votes (service-role key, SUPABASE_SERVICE_ROLE_KEY, OPTIONAL) — weekly/voters/dims
 *   - apps/web/public/data/synergies/{cardId}.json + _pairs_index.json — engine score + rules
 *   - apps/web/public/data/allCards.json + previewCards.json — card names
 *
 * Must run AFTER precompute-synergies. Degrades gracefully (no weekly/voters/dims)
 * when SUPABASE_SERVICE_ROLE_KEY is absent. Exits 0 with an empty-but-valid artifact
 * when Supabase env is entirely absent (forked PRs / offline builds).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildAnalytics, pairKey} from './lib/voteAnalytics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SYN_DIR = path.join(ROOT, 'apps/web/public/data/synergies');
const OUT_FILE = path.join(ROOT, 'apps/web/public/data/vote-analytics.json');

const require = createRequire(path.join(ROOT, 'apps/web/package.json'));
const {createClient} = require('@supabase/supabase-js');

// --- env (mirror scripts/test-supabase-integration.mjs loader) ---
function loadEnv() {
  const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  if (need.slice(0, 2).every((k) => process.env[k])) return;
  try {
    const content = fs.readFileSync(path.join(ROOT, 'apps/web/.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^(VITE_SUPABASE_\w+|SUPABASE_SERVICE_ROLE_KEY)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* rely on env vars */
  }
}

function writeArtifact(obj) {
  fs.writeFileSync(OUT_FILE, JSON.stringify({...obj, generatedAt: new Date().toISOString()}));
}

/** The empty-but-valid artifact written when Supabase env is entirely absent. */
function emptyArtifact() {
  return {
    hasRawVotes: false,
    global: {totalVotes: 0, distinctPairs: 0, distinctVoters: null, meanGap: null,
      accuracySentiment: null, engineSilentPairs: 0, weekly: [], dimensionFill: null},
    rules: [], pairs: [],
  };
}

/** Read every row of a Supabase table, paginating past PostgREST's 1000-row cap. */
async function fetchAllRows(client, table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const {data, error} = await client.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/** Read the synergy artifacts into an enginePairs Map + per-rule pair totals. */
function loadEngineArtifacts(synDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(synDir, '_manifest.json'), 'utf8'));
  const enginePairs = new Map();
  const ruleTotalPairs = {};
  for (const cardId of manifest) {
    const data = JSON.parse(fs.readFileSync(path.join(synDir, `${cardId}.json`), 'utf8'));
    for (const [targetId, pairData] of Object.entries(data.pairs)) {
      const key = pairKey(cardId, targetId);
      if (enginePairs.has(key)) continue;
      const connections = pairData.connections.map((c) => ({ruleId: c.ruleId}));
      enginePairs.set(key, {engineScore: pairData.aggregateScore, connections});
      for (const c of connections) ruleTotalPairs[c.ruleId] = (ruleTotalPairs[c.ruleId] ?? 0) + 1;
    }
  }
  return {enginePairs, ruleTotalPairs};
}

/** Rule roster (labels + zero-vote rules) from the built engine. */
async function loadRuleRoster(root) {
  const enginePath = path.join(root, 'packages/synergy-engine/dist/index.js');
  const {getAllRules} = await import(new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href);
  return getAllRules().map((r) => ({
    ruleId: r.id, ruleName: r.name, category: r.category,
  }));
}

/** Record a card's display name, keeping the first occurrence (allCards wins). */
function addNameIfAbsent(names, card) {
  if (!names.has(card.id)) names.set(card.id, card.fullName ?? card.name ?? card.id);
}

/** Card id -> display name, from allCards.json + previewCards.json. */
function loadCardNames(root) {
  const names = new Map();
  const files = ['allCards.json', 'previewCards.json']
    .map((f) => path.join(root, 'apps/web/public/data', f))
    .filter((p) => fs.existsSync(p));
  for (const p of files) {
    const {cards} = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const c of cards) addNameIfAbsent(names, c);
  }
  return names;
}

async function main() {
  console.log('⚙ Pre-computing vote analytics...');
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    console.warn('  ⚠ Supabase env absent — writing empty artifact.');
    writeArtifact(emptyArtifact());
    return;
  }

  const {enginePairs, ruleTotalPairs} = loadEngineArtifacts(SYN_DIR);
  const allRules = await loadRuleRoster(ROOT);
  const names = loadCardNames(ROOT);

  const scoreRows = await fetchAllRows(createClient(url, anon), 'pair_scores', '*');

  let rawVotes = null;
  if (service) {
    rawVotes = await fetchAllRows(
      createClient(url, service),
      'votes',
      'created_at, ip_hash, card_a_id, card_b_id, score, accuracy, is_real, would_play, difficulty',
    );
  } else {
    console.warn('  ⚠ SUPABASE_SERVICE_ROLE_KEY absent — skipping weekly/voters/dimensions.');
  }

  const analytics = buildAnalytics({scoreRows, enginePairs, allRules, names, ruleTotalPairs, rawVotes});
  writeArtifact(analytics);
  console.log(`✓ ${scoreRows.length} pairs, ${analytics.rules.length} rules, hasRawVotes=${analytics.hasRawVotes}`);
  console.log(`  Output: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('Vote-analytics precompute failed:', err);
  process.exit(1);
});
