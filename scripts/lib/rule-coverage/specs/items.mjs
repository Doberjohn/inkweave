import {countWithNames, pairsAndScores, poolLine, roleTable, section} from '../blocks.mjs';
import {fmt, tallyText} from '../render.mjs';
import {holders} from '../stats.mjs';

const PAYOFFS = ['payoff-trigger', 'payoff-static'];

export default {
  doc: 'ITEMS_RULE.md',
  blocks: {
    distribution: (coverage) =>
      section(poolLine(coverage), pairsAndScores(coverage.pairs('items'))),
    coverage: (coverage) => {
      const roles = coverage.roles(coverage.engine.getItemRoles, [
        'member',
        'item-engine',
        ...PAYOFFS,
      ]);
      const payoffs = holders(roles, PAYOFFS);
      const others = holders(roles).filter((card) => !payoffs.includes(card));
      return section(
        roleTable(roles, {names: 6, inks: coverage.inks}),
        `Payoffs (\`payoff-trigger\` or \`payoff-static\`): ${countWithNames(payoffs, 0)} ` +
          `(${tallyText(payoffs.flatMap(coverage.inks))}). Payoff anchoring skips the ` +
          `${fmt(coverage.compatiblePairs(others))} pairs among the other tagged cards (members and ` +
          'item engines) that could share a deck.',
      );
    },
  },
};
