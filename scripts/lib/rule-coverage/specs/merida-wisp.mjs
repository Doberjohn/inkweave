import {countWithNames, pairsLead, poolLine, section} from '../blocks.mjs';
import {bars, fmt, nameList, plural, table, tallyText, tierColor} from '../render.mjs';
import {byName, namedIn, namedOrder} from '../stats.mjs';

// getBeckonEnablerTier's tiers, strongest first.
const TIERS = ['engine', 'reanimator', 'self'];

/** Each tier's raw enablers, deck-compatible enablers, and the score its pairs take. */
function tierStats(coverage, pairs) {
  const tierOf = coverage.engine.getBeckonEnablerTier;
  const raw = coverage.pool.cards.filter((card) => tierOf(card) !== null).sort(byName);
  return TIERS.map((tier) => {
    // "{enabler} …, so {anchor} draws a card each time": an explanation names the enabler first.
    const own = pairs.filter((pair) => tierOf(namedOrder(pair)[0]) === tier);
    const scores = [...new Set(own.map((pair) => pair.score))].sort((a, b) => b - a);
    return {
      tier,
      raw: raw.filter((card) => tierOf(card) === tier),
      compatible: namedIn(own, 0),
      scores,
    };
  });
}

export default {
  doc: 'MERIDA_WISP_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const pairs = coverage.pairs('merida-wisp');
      const anchors = namedIn(pairs, 1);
      const tiers = tierStats(coverage, pairs);
      const self = tiers.find(({tier}) => tier === 'self').raw;
      const rawCount = tiers.reduce((n, {raw}) => n + raw.length, 0);
      return section(
        poolLine(coverage),
        [
          `- **${plural(anchors.length, 'anchor')}**: ${nameList(anchors)}`,
          `- **${fmt(rawCount)} raw enablers**; ${pairsLead(pairs)}`,
          `- Self-only enablers per ink: ${tallyText(self.flatMap(coverage.inks))}`,
        ].join('\n'),
        table(
          ['Tier', 'Raw enablers', 'Deck-compatible', 'Score'],
          tiers.map(({tier, raw, compatible, scores}) => [
            tier,
            countWithNames(raw, 5),
            fmt(compatible.length),
            scores.join(', ') || 'none',
          ]),
        ),
        bars({
          title: `Enabler tiers (${fmt(rawCount)} raw enablers)`,
          label: 'Enablers',
          bars: tiers.map(({tier, raw}) => [tier, raw.length]),
          colors: tiers.map(({scores}) => tierColor(scores[0] ?? 5)),
        }),
      );
    },
  },
};
