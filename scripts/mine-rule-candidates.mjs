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
 *     [{ phrase, cardCount, inkSpread, payoffCount, sampleCards: [{id, name}], score }]  (ranked, score DESC)
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

// Each mechanic pairs an `anchor` (the ENABLER form — a card that performs the
// mechanic; used to detect mechanical phrases) with a `payoff` (the trigger/state
// form — a card that rewards the mechanic happening). The anchor/payoff split is what
// makes a real two-sided synergy axis: many enablers + many payoffs = a rule worth
// building; many enablers + ~0 payoffs = good-stuff, not synergy.
//
// Anchors use word boundaries (not substring) so "gain" doesn't match "against".
// `payoff: null` means the mechanic is good-stuff or one-directional (stat buffs,
// healing, bounce, ready) with no clean payoff axis — it counts 0 payoffs by design.
// Payoff patterns are validated against the live card DB (see issue #363); they are the
// per-mechanic tunable.
const MECHANICS = [
  {anchor: /\bbanish(?:ed|es)?\b/, payoff: /\b(?:is|are) banished\b/i},
  {anchor: /\bdamage\b/, payoff: /\bdamaged\b/i},
  {anchor: /\bdraws?\b/, payoff: /\bwhenever you draw\b|\bif you (?:have )?draw/i},
  {anchor: /\bexert(?:ed|s)?\b/, payoff: /\bwhile (?:this character is )?exerted\b/i},
  {anchor: /\bchallenges?\b/, payoff: /\bwhile challenging\b|\bwhenever[^.]{0,40}challenges?\b/i},
  {anchor: /\bdiscards?\b/, payoff: /\bmore cards in your hand\b/i},
  {anchor: /into your inkwell/, payoff: /\bwhenever[^.]{0,40}(?:into|enters) your inkwell\b/i},
  {anchor: /\bready\b|\breadie[ds]\b/, payoff: null},
  {anchor: /\bgains?\b/, payoff: null},
  {anchor: /\breturns?\b/, payoff: null},
  {anchor: /\bremove[sd]?\b/, payoff: null},
];

/**
 * Rank a candidate cluster: a higher score means it is more worth a human's
 * attention as a potential new rule this week. This is the ONE real design
 * decision in the miner: it decides which uncovered mechanic surfaces first.
 *
 * Inputs:
 *   cardCount   - how many distinct uncovered cards share this phrase
 *   inkCount    - how many distinct inks those cards span (1..6)
 *   payoffCount - how many cards across the whole DB reward this mechanic happening
 *                 (the payoff side of the axis); ~0..85. 0-1 means good-stuff, not synergy.
 *
 * @returns {number} ranking score (higher = surfaced first)
 */
function rankCluster(cardCount, inkCount, payoffCount) {
  // Size-and-spread baseline: sqrt(cardCount) gives diminishing returns on raw count
  // (a 36-card cluster is 6x the card-weight of a 1-card one, not 36x), and inkCount is
  // a linear multiplier rewarding cross-ink, deck-agnostic mechanics.
  const sizeScore = Math.sqrt(cardCount) * inkCount * 10;

  // payoffCount scales the whole score, so payoff richness (a real two-sided axis)
  // dominates raw size. 0-1 payoffs is good-stuff/one-directional and collapses to a
  // fraction of sizeScore (a floor); 2+ payoffs earns a log-scaled boost so an
  // 85-payoff mechanic doesn't dwarf a healthy 30-payoff one.
  const payoffFactor =
    payoffCount <= 1
      ? 0.15 + 0.15 * payoffCount // 0 -> 0.15, 1 -> 0.30: good-stuff floor
      : 1 + Math.log2(payoffCount); // diminishing returns above the floor
  return Math.round(sizeScore * payoffFactor);
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
      if (MECHANICS.some((m) => m.anchor.test(gram))) phrases.add(gram);
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

/**
 * Cards the live engine finds (almost) nothing for — the coverage oracle.
 */
function findUncoveredCards(cards, synergyEngine) {
  return cards.filter((card) => {
    const groups = synergyEngine.findSynergies(card, cards);
    const matchCount = groups.reduce((sum, g) => sum + g.synergies.length, 0);
    return matchCount <= UNCOVERED_THRESHOLD;
  });
}

/**
 * Group uncovered cards into clusters keyed by shared mechanical phrase.
 * Returns a Map of phrase -> { phrase, cardIds:Set, inks:Set }.
 */
function buildClusters(uncoveredCards) {
  const clusters = new Map();
  for (const card of uncoveredCards) {
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
  return clusters;
}

/**
 * For each mechanic, count cards across the FULL set whose text rewards the mechanic
 * happening (the payoff/trigger/state form). A mechanic with a populated payoff side is a
 * real two-sided synergy axis; `payoff: null` mechanics (good-stuff / one-directional)
 * count 0. Computed once, indexed parallel to MECHANICS.
 */
function countPayoffsByMechanic(cards) {
  return MECHANICS.map((m) =>
    m.payoff ? cards.filter((c) => m.payoff.test(c.text || '')).length : 0,
  );
}

/** Index of the first mechanic whose anchor matches the phrase (-1 if none). */
function mechanicIndexForPhrase(phrase) {
  return MECHANICS.findIndex((m) => m.anchor.test(phrase));
}

/**
 * Filter clusters to the meaningful ones, collapse near-duplicates, attach each cluster's
 * payoff-axis size, then shape and rank them into the report's candidate objects (score DESC).
 */
function buildCandidates(clusters, nameById, cards) {
  const payoffByMechanic = countPayoffsByMechanic(cards);
  const filtered = [...clusters.values()].filter(
    (c) => c.cardIds.size >= MIN_CARDS && c.inks.size >= MIN_INKS,
  );
  return collapseOverlapping(filtered)
    .map((c) => {
      const mi = mechanicIndexForPhrase(c.phrase);
      const payoffCount = mi >= 0 ? payoffByMechanic[mi] : 0;
      return {
        phrase: c.phrase,
        cardCount: c.cardIds.size,
        inkSpread: [...c.inks],
        payoffCount,
        sampleCards: [...c.cardIds].slice(0, 12).map((id) => ({id, name: nameById.get(id)})),
        score: rankCluster(c.cardIds.size, c.inks.size, payoffCount),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Print the top candidates for a --verbose run.
 */
function logTopCandidates(candidates) {
  for (const c of candidates.slice(0, 15)) {
    console.log(
      `  [${c.score}] "${c.phrase}" — ${c.cardCount} cards, ${c.inkSpread.length} inks, ${c.payoffCount} payoffs (${c.inkSpread.join('/')})`,
    );
  }
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

  const uncovered = findUncoveredCards(cards, synergyEngine);
  console.log(`  ${uncovered.length} uncovered cards (<= ${UNCOVERED_THRESHOLD} synergies)`);

  const candidates = buildCandidates(buildClusters(uncovered), nameById, cards);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), {recursive: true});
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(candidates, null, 2));
  console.log(`✔ ${candidates.length} candidate clusters → ${path.relative(ROOT, OUTPUT_FILE)}`);

  if (VERBOSE) logTopCandidates(candidates);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
