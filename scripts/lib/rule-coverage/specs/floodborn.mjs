import {countWithNames, pairsAndScores, poolLine, roleTable, section} from '../blocks.mjs';
import {fmt} from '../render.mjs';
import {holders} from '../stats.mjs';

export default {
  doc: 'FLOODBORN_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const roles = coverage.roles(coverage.engine.getFloodbornRoles, [
        'member',
        'buff',
        'trigger',
      ]);
      const payoffs = holders(roles, ['buff', 'trigger']);
      const plain = roles.get('member').filter((card) => !payoffs.includes(card));
      return section(
        poolLine(coverage),
        roleTable(roles, {names: 6, inks: coverage.inks}),
        `Payoffs (\`buff\` or \`trigger\`): ${countWithNames(payoffs, 0)}. ` +
          `Floodborn characters with no payoff role: ${fmt(plain.length)}. Payoff anchoring skips ` +
          `the ${fmt(coverage.compatiblePairs(plain))} pairs among them that could share a deck.`,
        pairsAndScores(coverage.pairs('floodborn')),
      );
    },
  },
};
