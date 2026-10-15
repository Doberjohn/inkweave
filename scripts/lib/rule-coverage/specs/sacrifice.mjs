import {
  countWithNames,
  holdersLine,
  pairsLead,
  poolLine,
  roleBullet,
  roleChart,
  section,
  shapeTable,
} from '../blocks.mjs';
import {pct} from '../render.mjs';
import {TOY_ROLES} from './roles.mjs';

const ROLES = ['self-banish', 'banish-trigger'];

const SHAPES = [
  {label: 'self-banish ↔ banish-trigger', score: 8, test: /banishes your own character on demand/},
  // Read by what each trigger counts: any of your characters banished, or only the card itself.
  {label: 'banish-trigger ↔ banish-trigger', score: 5, test: /\bbanished\b/},
  {label: 'self-banish ↔ self-banish', score: 5, test: /both banish your own characters/},
  // A self-banish card next to a payoff that fires only on an opponent's turn.
  {
    label: "self-banish ↔ an opponent's-turn banish-trigger",
    score: 5,
    test: /both go in a Sacrifice deck/,
  },
];

/** The share of a rule's pairs that score 8. */
function eightShare(coverage, ruleId) {
  const pairs = coverage.pairs(ruleId);
  return pct(pairs.filter((pair) => pair.score === 8).length, pairs.length);
}

const sacrificeRoles = (coverage) => coverage.roles(coverage.engine.getSacrificeRoles, ROLES);

export default {
  doc: 'SACRIFICE_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const pairs = coverage.pairs('sacrifice');
      const shares = ['sacrifice', 'discard', 'toy'].map((id) => eightShare(coverage, id));
      return section(
        poolLine(coverage),
        `${pairsLead(pairs)}:`,
        shapeTable(pairs, SHAPES),
        `Score-8 share next to Discard and Toy: Sacrifice ${shares[0]}, Discard ${shares[1]}, ` +
          `Toy ${shares[2]}.`,
      );
    },
    coverage: (coverage) => {
      const roles = sacrificeRoles(coverage);
      const toyTriggers = coverage
        .roles(coverage.engine.getToyRoles, TOY_ROLES)
        .get('banish-trigger');
      const shared = roles.get('banish-trigger').filter((card) => toyTriggers.includes(card));
      return section(
        [
          roleBullet('self-banish card', roles.get('self-banish'), {
            inks: coverage.inks,
            names: 12,
          }),
          roleBullet('banish-trigger', roles.get('banish-trigger'), {
            inks: coverage.inks,
            names: 12,
          }),
        ].join('\n'),
        holdersLine(roles),
        `Banish-triggers the Toy rule tags too: ${countWithNames(shared, 12)}.`,
        roleChart(roles, {
          'self-banish': 'Self-banish cards',
          'banish-trigger': 'Banish-triggers',
        }),
      );
    },
  },
};
