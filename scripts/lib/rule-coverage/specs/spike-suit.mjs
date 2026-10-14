import {pairsLead, poolLine, scoreChart, section, tierSplit} from '../blocks.mjs';
import {bars, doughnut, fmt, nameList, plural, tally} from '../render.mjs';
import {byName, namedIn} from '../stats.mjs';

/** The bonus combat damage Spike Suit unlocks: willpower minus strength. */
const gap = (card) => (card.willpower ?? 0) - (card.strength ?? 0);

/**
 * Every anchor in the pool, so one with no deck-compatible payoff is still listed, and the
 * payoffs it pairs with ("{anchor} lets {payoff} deal damage …" names the anchor first).
 */
const anchorsAndPayoffs = (coverage, pairs) => ({
  anchors: coverage.pool.cards.filter(coverage.engine.isSpikeSuitAnchor).sort(byName),
  payoffs: namedIn(pairs, 1),
});

/** The characters that could be a payoff: all but an anchor no other anchor pairs with. */
function candidates(coverage, {anchors, payoffs}) {
  const anchorOnly = new Set(anchors.filter((card) => !payoffs.includes(card)));
  return coverage.pool.cards.filter(
    (card) => coverage.engine.isCharacter(card) && !anchorOnly.has(card),
  );
}

/** How many characters lead on willpower, how many the floor keeps, how many pair. */
function floorLine(coverage) {
  const roles = anchorsAndPayoffs(coverage, coverage.pairs('spike-suit'));
  const characters = candidates(coverage, roles);
  const rule = coverage.engine.getAllRules().find((r) => r.id === 'spike-suit');
  const leading = characters.filter((card) => gap(card) >= 1);
  const kept = characters.filter((card) => rule.matches(card));
  return (
    `**${fmt(leading.length)} characters** have any willpower lead, ` +
    `**${fmt(leading.filter((card) => gap(card) === 1).length)}** of them only +1. ` +
    `The floor keeps **${fmt(kept.length)}**, and **${fmt(roles.payoffs.length)}** of those ` +
    'can share a deck with an anchor.'
  );
}

export default {
  doc: 'SPIKE_SUIT_RULE.md',
  blocks: {
    floor: (coverage) => section(poolLine(coverage), floorLine(coverage)),
    scores: (coverage) => {
      const pairs = coverage.pairs('spike-suit');
      return section(
        scoreChart(`Score distribution (${fmt(pairs.length)} unique pairs)`, pairs),
        `Tier split: **${tierSplit(pairs)}**.`,
      );
    },
    coverage: (coverage) => {
      const pairs = coverage.pairs('spike-suit');
      const {anchors, payoffs} = anchorsAndPayoffs(coverage, pairs);
      const gaps = tally(payoffs.map((card) => String(gap(card)))).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      );
      const inks = tally(payoffs.map((card) => coverage.inks(card)[0]));
      return section(
        [
          `- **${plural(anchors.length, 'anchor')}**: ${nameList(anchors)}`,
          `- **${plural(payoffs.length, 'deck-compatible payoff')}**; ${pairsLead(pairs)}`,
          `- **${fmt(payoffs.filter((card) => (card.strength ?? 0) === 0).length)}** of the payoffs are ` +
            'strength-0 walls, the highest-impact pairings',
        ].join('\n'),
        bars({
          title: `Payoff gap distribution (${fmt(payoffs.length)} cards)`,
          label: 'Payoffs',
          bars: gaps.map(([value, n]) => [`+${value}`, n]),
          colors: gaps.map(() => '#60b5f5'),
        }),
        doughnut(`Payoffs by primary ink (${fmt(payoffs.length)} cards)`, inks),
      );
    },
  },
};
