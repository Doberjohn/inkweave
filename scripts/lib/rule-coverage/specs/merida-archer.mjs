import {pairsLead, poolLine, scoreChart, section, tierSplit} from '../blocks.mjs';
import {fmt, nameList, plural, tallyText} from '../render.mjs';
import {byName, namedIn} from '../stats.mjs';

export default {
  doc: 'MERIDA_ARCHER_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const pairs = coverage.pairs('merida-archer');
      // "{anchor}'s STEADY AIM adds 2 damage to {payoff}'s …": an explanation names the anchor first.
      const [anchors, payoffs] = [namedIn(pairs, 0), namedIn(pairs, 1)];
      const raw = coverage.pool.cards.filter(coverage.engine.isMeridaDamageAction).sort(byName);
      return section(
        poolLine(coverage),
        [
          `- **${plural(anchors.length, 'anchor')}**: ${nameList(anchors)}`,
          `- **${fmt(raw.length)} damage-dealing actions** (${tallyText(raw.flatMap(coverage.inks))}), ` +
            `**${fmt(payoffs.length)}** of them deck-compatible payoffs: ${nameList(payoffs)}`,
          `- ${pairsLead(pairs)}`,
        ].join('\n'),
        scoreChart(`Score distribution (${fmt(pairs.length)} unique pairs)`, pairs),
        `Tier split: **${tierSplit(pairs)}**.`,
      );
    },
  },
};
