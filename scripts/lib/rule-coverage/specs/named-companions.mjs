import {partnerBuckets, poolLine, section} from '../blocks.mjs';
import {bars, doughnut, fmt, nameList, tierColor} from '../render.mjs';
import {byName} from '../stats.mjs';

const TIER = /^\{A\} has an? (\S+) effect that names \{B\}/;

/** "Game-winning (8)": a tier and the score it maps to. */
const tierLabel = ([tier, score]) => `${tier[0].toUpperCase()}${tier.slice(1)} (${score})`;

/**
 * Pairs per effect tier. A pair whose explanation names no known tier fails the run, so a new
 * explanation can't go uncounted.
 *
 * @param {object[]} pairs
 * @param {Array<[string, number]>} tiers - NAMED_EFFECT_SCORES entries
 */
function tierCounts(pairs, tiers) {
  const counts = new Map(tiers.map(([tier]) => [tier, 0]));
  for (const pair of pairs) {
    const tier = pair.explanation.match(TIER)?.[1];
    if (!counts.has(tier)) throw new Error(`no effect tier for the pair: ${pair.explanation}`);
    counts.set(tier, counts.get(tier) + 1);
  }
  return counts;
}

export default {
  doc: 'NAMED_COMPANIONS_RULE.md',
  blocks: {
    tiers: (coverage) => {
      const pairs = coverage.pairs('named-companions');
      const tiers = Object.entries(coverage.engine.NAMED_EFFECT_SCORES).sort((a, b) => a[1] - b[1]);
      const counts = tierCounts(pairs, tiers);
      return section(
        poolLine(coverage),
        bars({
          title: `Effect tier distribution (${fmt(pairs.length)} unique pairs)`,
          label: 'Pairs',
          bars: tiers.map((entry) => [tierLabel(entry), counts.get(entry[0])]),
          colors: tiers.map(([, score]) => tierColor(score)),
        }),
      );
    },
    coverage: (coverage) => {
      const {engine, pool} = coverage;
      const referrers = pool.cards
        .filter((card) => engine.getNamedReferences(card).length > 0)
        .sort(byName);
      const names = [...new Set(referrers.flatMap((card) => engine.getNamedReferences(card)))];
      const carried = new Set(pool.cards.map((card) => card.name));
      const unknown = names.filter((name) => !carried.has(name)).sort();
      const partners = coverage.partners('named-companions');
      const targetless = referrers.filter((card) => !partners.has(card.id));
      return section(
        [
          `- **${fmt(referrers.length)} cards** carry a "named" reference, through ${fmt(names.length)} distinct names.`,
          `- Names no pool card carries: ${unknown.length === 0 ? 'none' : unknown.join(', ')}.`,
          `- Cards with a Companions group: ${fmt(partners.size)}. ` +
            `With no target: ${nameList(targetless)}.`,
        ].join('\n'),
        doughnut(
          `Cards by number of targets (${fmt(partners.size)} cards)`,
          partnerBuckets(partners, 'targets'),
        ),
      );
    },
  },
};
