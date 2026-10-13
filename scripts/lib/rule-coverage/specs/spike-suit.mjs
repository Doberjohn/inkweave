import {pairsLead, poolLine, scoreChart, section, tierSplit} from '../blocks.mjs';
import {bars, doughnut, fmt, nameList, plural, tally} from '../render.mjs';
import {namedIn} from '../stats.mjs';

/** The bonus combat damage Spike Suit unlocks: willpower minus strength. */
const gap = (card) => (card.willpower ?? 0) - (card.strength ?? 0);

// "{anchor} lets {payoff} deal damage with its N willpower …": an explanation names the anchor first.
const anchorsAndPayoffs = (pairs) => ({anchors: namedIn(pairs, 0), payoffs: namedIn(pairs, 1)});

export default {
  doc: 'SPIKE_SUIT_RULE.md',
  blocks: {
    floor: (coverage) => {
      const {payoffs} = anchorsAndPayoffs(coverage.pairs('spike-suit'));
      const characters = coverage.pool.cards.filter(coverage.engine.isCharacter);
      const floor = Math.min(...payoffs.map(gap));
      const leading = characters.filter((card) => gap(card) >= 1);
      return section(
        poolLine(coverage),
        `**${fmt(leading.length)} characters** have any willpower lead, ` +
          `**${fmt(leading.filter((card) => gap(card) === 1).length)}** of them only +1. ` +
          `The +${floor} floor keeps **${fmt(characters.filter((card) => gap(card) >= floor).length)}**, ` +
          `and **${fmt(payoffs.length)}** of those can share a deck with an anchor.`,
      );
    },
    scores: (coverage) => {
      const pairs = coverage.pairs('spike-suit');
      return section(
        scoreChart(`Score distribution (${fmt(pairs.length)} unique pairs)`, pairs),
        `Tier split: **${tierSplit(pairs)}**.`,
      );
    },
    coverage: (coverage) => {
      const pairs = coverage.pairs('spike-suit');
      const {anchors, payoffs} = anchorsAndPayoffs(pairs);
      const gaps = tally(payoffs.map((card) => String(gap(card)))).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      );
      const inks = tally(payoffs.map((card) => coverage.inks(card)[0]));
      return section(
        [
          `- **${fmt(anchors.length)} ${anchors.length === 1 ? 'anchor' : 'anchors'}**: ${nameList(anchors)}`,
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
