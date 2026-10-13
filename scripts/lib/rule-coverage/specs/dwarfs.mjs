import {pairsLead, poolLine, roleTable, section, shapeTable} from '../blocks.mjs';
import {fmt} from '../render.mjs';
import {holders} from '../stats.mjs';

const SHAPES = [
  {label: 'recruit ↔ member, recruit ↔ density', score: 8, test: /free recruit/},
  {label: 'density ↔ density', score: 7, test: /^Both reward Seven Dwarfs density/},
  {label: 'density ↔ member', score: 7, test: /feeds the Seven Dwarfs density payoff/},
  {label: 'return ↔ member', score: 7, test: /^Bouncing the member/},
  {
    label: 'member ↔ member and other same-deck pairs',
    score: 5,
    test: /^Both share the Seven Dwarfs deck/,
  },
];

export default {
  doc: 'DWARFS_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const roles = coverage.roles(coverage.engine.getDwarfsRoles, [
        'member',
        'density',
        'recruit',
        'return',
      ]);
      const members = roles.get('member');
      const payoffsOnly = holders(roles).filter((card) => !members.includes(card));
      const pairs = coverage.pairs('dwarfs');
      return section(
        poolLine(coverage),
        `**${fmt(holders(roles).length)} Seven-Dwarfs-affiliated cards** (${fmt(members.length)} members + ` +
          `${fmt(payoffsOnly.length)} non-member payoffs). ${pairsLead(pairs)}:`,
        shapeTable(pairs, SHAPES),
        'Role population:',
        roleTable(roles, {names: 7, inks: coverage.inks}),
      );
    },
  },
};
