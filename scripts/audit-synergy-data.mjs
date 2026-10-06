#!/usr/bin/env node
/**
 * One-off audit: rebuild SYNERGY_AUDIT.md distribution numbers from the
 * precomputed synergy JSON files. Run after a fresh `pnpm precompute-synergies`
 * to refresh the doc.
 *
 * Output is markdown printed to stdout — paste into docs/SYNERGY_AUDIT.md
 * (or pipe into a file). Doesn't modify the doc itself; that step is manual
 * so you can review the deltas before committing.
 */
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYNERGY_DIR = resolve(__dirname, '../apps/web/public/data/synergies');
const ALL_CARDS = JSON.parse(
  readFileSync(resolve(__dirname, '../apps/web/public/data/allCards.json'), 'utf8'),
);
const cards = ALL_CARDS.cards ?? [];
const cardById = new Map(cards.map((c) => [String(c.id), c]));

const playstyles = JSON.parse(readFileSync(join(SYNERGY_DIR, '_playstyles.json'), 'utf8'));

const cardFiles = readdirSync(SYNERGY_DIR).filter((f) => /^\d+\.json$/.test(f));

// ── Per-rule + score aggregations ──
const scoreHist = new Map();
const ruleStats = new Map(); // ruleId → {matches:[], scores:[], cards:Set}
const cardMatchTotals = new Map(); // cardId → total match count
let totalMatches = 0;
let cardsWithSynergies = 0;

for (const file of cardFiles) {
  const cardId = file.replace('.json', '');
  const data = JSON.parse(readFileSync(join(SYNERGY_DIR, file), 'utf8'));
  const groups = data.groups ?? [];
  if (groups.length === 0) continue;
  cardsWithSynergies++;
  let cardTotal = 0;
  for (const group of groups) {
    for (const syn of group.synergies ?? []) {
      totalMatches++;
      cardTotal++;
      const score = syn.score;
      scoreHist.set(score, (scoreHist.get(score) ?? 0) + 1);
      const ruleId = syn.ruleId ?? group.groupKey;
      const ruleName = syn.ruleName ?? group.label;
      let stat = ruleStats.get(ruleId);
      if (!stat) {
        stat = {ruleName, scores: [], cards: new Set()};
        ruleStats.set(ruleId, stat);
      }
      stat.scores.push(score);
      stat.cards.add(cardId);
    }
  }
  if (cardTotal > 0) cardMatchTotals.set(cardId, cardTotal);
}

// ── Helpers ──
function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pct(n, total) {
  return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
}

// ── Render ──
console.log(`# Synergy Audit — refreshed`);
console.log(``);
console.log(`Total cards: ${cards.length}`);
console.log(`Cards with synergies: ${cardsWithSynergies} (${pct(cardsWithSynergies, cards.length)})`);
console.log(`Total matches: ${totalMatches.toLocaleString('en-US')}`);
console.log(`Rules represented: ${ruleStats.size}`);
console.log(`Playstyles: ${Object.keys(playstyles).length} (${Object.keys(playstyles).join(', ')})`);
console.log(``);

console.log(`## Overall Score Distribution`);
console.log(``);
console.log(`| Score | Count | % |`);
console.log(`|-------|-------|---|`);
const scoreKeys = [...scoreHist.keys()].sort((a, b) => b - a);
for (const s of scoreKeys) {
  console.log(`| ${s} | ${scoreHist.get(s).toLocaleString('en-US')} | ${pct(scoreHist.get(s), totalMatches)} |`);
}
console.log(``);

console.log(`## Per-Rule Summary`);
console.log(``);
console.log(`| Rule | Matches | Cards | Min | Max | Mean | Median | Spread |`);
console.log(`|------|---------|-------|-----|-----|------|--------|--------|`);
const sortedRules = [...ruleStats.entries()].sort((a, b) => b[1].scores.length - a[1].scores.length);
for (const [, stat] of sortedRules) {
  const min = Math.min(...stat.scores);
  const max = Math.max(...stat.scores);
  const mean = (stat.scores.reduce((s, n) => s + n, 0) / stat.scores.length).toFixed(2);
  const med = median(stat.scores);
  console.log(
    `| ${stat.ruleName} | ${stat.scores.length.toLocaleString('en-US')} | ${stat.cards.size} | ${min} | ${max} | ${mean} | ${med} | ${max - min} |`,
  );
}
console.log(``);

console.log(`## Per-Rule Score Histograms`);
console.log(``);
for (const [, stat] of sortedRules) {
  const hist = new Map();
  for (const s of stat.scores) hist.set(s, (hist.get(s) ?? 0) + 1);
  console.log(`### ${stat.ruleName} — ${stat.scores.length.toLocaleString('en-US')} matches across ${stat.cards.size} cards`);
  console.log(``);
  console.log(`| Score | Count | % |`);
  console.log(`|-------|-------|---|`);
  for (const s of [...hist.keys()].sort((a, b) => b - a)) {
    console.log(`| ${s} | ${hist.get(s).toLocaleString('en-US')} | ${pct(hist.get(s), stat.scores.length)} |`);
  }
  console.log(``);
}

console.log(`## Playstyle Balance`);
console.log(``);
console.log(`| Playstyle | Cards | % of Total |`);
console.log(`|-----------|-------|------------|`);
for (const [psId, ids] of Object.entries(playstyles).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`| ${psId} | ${ids.length} | ${pct(ids.length, cards.length)} |`);
}
console.log(``);

console.log(`## Top 10 Cards by Total Matches`);
console.log(``);
console.log(`| Card | Matches |`);
console.log(`|------|---------|`);
const top = [...cardMatchTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [cardId, count] of top) {
  const card = cardById.get(cardId);
  const name = card?.fullName ?? card?.name ?? `Card ${cardId}`;
  console.log(`| ${name} | ${count} |`);
}
