import {pairsLead, poolLine, roleTable, section, shapeTable} from '../blocks.mjs';
import {fmt} from '../render.mjs';
import {holders} from '../stats.mjs';

/**
 * The pair shapes. Two density payoffs read like a member and its payoff when only one of them is
 * a Dwarf, so that row checks the roles instead of the words.
 */
function dwarfsShapes(engine) {
  const density = (card) => engine.getDwarfsRoles(card).includes('density');
  return [
    {label: 'recruit ↔ member, recruit ↔ density', score: 8, test: /can play .+ for free/},
    {label: 'density ↔ density', score: 7, test: (pair) => pair.cards.every(density)},
    {label: 'density ↔ member', score: 7, test: /activates .+'s Seven Dwarfs ability/},
    {label: 'return ↔ member', score: 7, test: /returns .+ to your hand and draws a card/},
    {
      label: 'member ↔ member and other same-deck pairs',
      score: 5,
      test: /both go in a Seven Dwarfs deck/,
    },
  ];
}

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
        shapeTable(pairs, dwarfsShapes(coverage.engine)),
        'Role population:',
        roleTable(roles, {names: 7, inks: coverage.inks}),
      );
    },
  },
};
