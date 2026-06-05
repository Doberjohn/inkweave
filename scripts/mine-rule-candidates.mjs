#!/usr/bin/env node
/**
 * Mines the card database for recurring mechanics that NO synergy rule covers yet.
 *
 * Coverage oracle: the live SynergyEngine itself. A card is "uncovered" when
 * `synergyEngine.findSynergies(card, allCards)` produces <= UNCOVERED_THRESHOLD
 * matches. Among uncovered cards we extract recurring mechanical phrases, cluster
 * them, and rank the clusters so a human (or the /mine-rules skill) can review the
 * highest-value candidate for a new rule.
 *
 * This script is READ-ONLY: it reads card data, runs the engine in-memory, and
 * writes a single report file. It never edits engine source, commits, or pushes.
 *
 * Output:
 *   reports/rule-candidates.json
 *     [{ phrase, cardCount, inkSpread, sampleCards: [{id, name}], score }]  (ranked, score DESC)
 *
 * Usage:
 *   node scripts/mine-rule-candidates.mjs            # writes the report
 *   node scripts/mine-rule-candidates.mjs --verbose  # also prints the top clusters
 *
 * Requires the engine to be built first (`pnpm build:engine`); `pnpm mine-rules`
 * wires that up.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAIN_DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
const OUTPUT_FILE = path.join(ROOT, 'reports/rule-candidates.json');
const VERBOSE = process.argv.includes('--verbose');

// --- Tunables -------------------------------------------------------------
const UNCOVERED_THRESHOLD = 0; // a card is "uncovered" when its synergy match count is <= this
const MIN_CARDS = 4; // a cluster must span at least this many distinct cards
const MIN_INKS = 2; // ...and at least this many distinct inks
const NGRAM_MIN = 3; // shortest phrase (word count) to consider
const NGRAM_MAX = 6; // longest phrase (word count) to consider
const OVERLAP_THRESHOLD = 0.8; // merge a cluster into a larger one when this fraction of its cards are shared

// A phrase only counts as mechanical if it contains one of these anchors.
// Word-boundary regexes (not substring) so "gain" doesn't match "against",
// "play" doesn't match "player", etc. Tense/plural variants folded in.
const ANCHOR_PATTERNS = [
  /\bbanish(?:ed|es)?\b/,
  /\bready\b|\breadie[ds]\b/,
  /\bexert(?:ed|s)?\b/,
  /\bgains?\b/,
  /\bchallenges?\b/,
  /\bdiscards?\b/,
  /\bdraws?\b/,
  /\breturns?\b/,
  /\bdamage\b/,
  /\bremove[sd]?\b/,
  /into your inkwell/,
];

/**
 * Rank a candidate cluster: a higher score means it is more worth a human's
 * attention as a potential new rule this week. This is the ONE real design
 * decision in the miner: it decides which uncovered mechanic surfaces first.
 *
 * Inputs:
 *   cardCount - how many distinct uncovered cards share this phrase
 *   inkCount  - how many distinct inks those cards span (1..6)
 *
 * @returns {number} ranking score (higher = surfaced first)
 */
function rankCluster(cardCount, inkCount) {
  // sqrt(cardCount) applies diminishing returns: a 36-card cluster scores 6x the
  // card-weight of a 1-card one, not 36x, so a giant pile of one mechanic doesn't
  // drown out a smaller-but-broader one. inkCount is a linear multiplier so a
  // mechanic spread across many inks (more flexible, deck-agnostic rule) is
  // rewarded. Scaled x10 and rounded for readable integer scores.
  return Math.round(Math.sqrt(cardCount) * inkCount * 10);
}

/**
 * Collapse near-duplicate clusters that describe the same mechanic under different
 * overlapping phrasings (e.g. "draw a card" vs "you may draw a card", whose card
 * sets are nearly identical). Process clusters largest-first; each surviving cluster
 * becomes a representative that absorbs any smaller cluster whose cards are mostly
 * contained in it. Because we keep the largest cluster, the representative carries
 * the broadest wording and the truest card count. The remainder (<20% of a dropped
 * cluster) is discarded rather than unioned, so each representative's cardCount stays
 * honest: every counted card actually contains that representative's phrase.
 */
function collapseOverlapping(clusters) {
  const byCardDesc = [...clusters].sort((a, b) => b.cardIds.size - a.cardIds.size);
  const reps = [];
  for (const cluster of byCardDesc) {
    const absorbed = reps.some((rep) => {
      let shared = 0;
      for (const id of cluster.cardIds) if (rep.cardIds.has(id)) shared++;
      return shared / cluster.cardIds.size >= OVERLAP_THRESHOLD;
    });
    if (!absorbed) reps.push(cluster);
  }
  return reps;
}

/**
 * Extract distinct mechanical phrases (anchored n-grams) from a card's text.
 */
function extractPhrases(text) {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop reminder text in parentheses
    .replace(/[^a-z\s]/g, ' ') // drop digits and punctuation
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ');
  const phrases = new Set();
  for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(' ');
      if (ANCHOR_PATTERNS.some((re) => re.test(gram))) phrases.add(gram);
    }
  }
  return [...phrases];
}

/**
 * Merge main + preview card data the same way precompute-synergies.mjs does
 * (main wins on id conflict), then transform to engine LorcanaCard[].
 */
function loadCards(transformCards) {
  const mainData = JSON.parse(fs.readFileSync(MAIN_DATA_FILE, 'utf-8'));
  const mainIds = new Set(mainData.cards.map((c) => c.id));
  let mergedRaw = mainData.cards;
  if (fs.existsSync(PREVIEW_DATA_FILE)) {
    const previewData = JSON.parse(fs.readFileSync(PREVIEW_DATA_FILE, 'utf-8'));
    const previewFiltered = previewData.cards.filter((c) => !mainIds.has(c.id));
    mergedRaw = [...mainData.cards, ...previewFiltered];
  }
  return transformCards(mergedRaw);
}

async function main() {
  console.log('⛏ Mining uncovered rule candidates...');

  const enginePath = path.join(ROOT, 'packages/synergy-engine/dist/index.js');
  if (!fs.existsSync(enginePath)) {
    console.error('ERROR: Engine not built. Run `pnpm build:engine` first.');
    process.exit(1);
  }
  const engineUrl = new URL(`file:///${enginePath.replace(/\\/g, '/')}`);
  const {synergyEngine, transformCards} = await import(engineUrl.href);

  const cards = loadCards(transformCards);
  const nameById = new Map(cards.map((c) => [c.id, c.fullName]));
  console.log(`  ${cards.length} cards loaded`);

  // Coverage oracle: keep cards the live engine finds (almost) nothing for.
  const uncovered = cards.filter((card) => {
    const groups = synergyEngine.findSynergies(card, cards);
    const matchCount = groups.reduce((sum, g) => sum + g.synergies.length, 0);
    return matchCount <= UNCOVERED_THRESHOLD;
  });
  console.log(`  ${uncovered.length} uncovered cards (<= ${UNCOVERED_THRESHOLD} synergies)`);

  // Cluster uncovered cards by shared mechanical phrase.
  const clusters = new Map(); // phrase -> { phrase, cardIds:Set, inks:Set }
  for (const card of uncovered) {
    for (const phrase of extractPhrases(card.text)) {
      let cluster = clusters.get(phrase);
      if (!cluster) {
        cluster = {phrase, cardIds: new Set(), inks: new Set()};
        clusters.set(phrase, cluster);
      }
      cluster.cardIds.add(card.id);
      cluster.inks.add(card.ink);
      if (card.ink2) cluster.inks.add(card.ink2);
    }
  }

  const filtered = [...clusters.values()].filter(
    (c) => c.cardIds.size >= MIN_CARDS && c.inks.size >= MIN_INKS,
  );
  const candidates = collapseOverlapping(filtered)
    .map((c) => ({
      phrase: c.phrase,
      cardCount: c.cardIds.size,
      inkSpread: [...c.inks],
      sampleCards: [...c.cardIds].slice(0, 12).map((id) => ({id, name: nameById.get(id)})),
      score: rankCluster(c.cardIds.size, c.inks.size),
    }))
    .sort((a, b) => b.score - a.score);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), {recursive: true});
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(candidates, null, 2));
  console.log(`✔ ${candidates.length} candidate clusters → ${path.relative(ROOT, OUTPUT_FILE)}`);

  if (VERBOSE) {
    for (const c of candidates.slice(0, 15)) {
      console.log(
        `  [${c.score}] "${c.phrase}" — ${c.cardCount} cards, ${c.inkSpread.length} inks (${c.inkSpread.join('/')})`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
