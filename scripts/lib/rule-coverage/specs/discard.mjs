import {holdersLine, pairsLead, poolLine, roleTable, section, shapeTable} from '../blocks.mjs';
import {doughnut} from '../render.mjs';
import {holders} from '../stats.mjs';

const ENABLERS = ['standard', 'targeted', 'random'];
const ROLES = [...ENABLERS, 'payoff'];
const LABELS = {
  standard: 'standard (enabler)',
  targeted: 'targeted (enabler)',
  random: 'random (enabler)',
};

const SHAPES = [
  {label: 'Enabler ↔ Enabler', score: 5, test: /^Both disrupt the opponent's hand/},
  {label: 'Enabler ↔ Payoff', score: 8, test: /empties the opponent's hand/},
  {label: 'Payoff ↔ Payoff', score: 5, test: /^Both reward hand-size advantage/},
];

const discardRoles = (coverage) => coverage.roles(coverage.engine.getDiscardRoles, ROLES);

export default {
  doc: 'DISCARD_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const pairs = coverage.pairs('discard');
      const noPayoff = discardRoles(coverage).get('payoff').length === 0;
      return section(
        poolLine(coverage),
        `${pairsLead(pairs)}:`,
        shapeTable(pairs, SHAPES),
        noPayoff && 'No hand-size payoff is in the pool, so every pair sits at the 5 baseline.',
      );
    },
    coverage: (coverage) => {
      const roles = discardRoles(coverage);
      const enablers = holders(roles, ENABLERS);
      return section(
        roleTable(roles, {names: 6, inks: coverage.inks, labels: LABELS}),
        holdersLine(roles),
        doughnut(`Role composition (${holders(roles).length} cards)`, [
          ['Enablers', enablers.length],
          ['Payoffs', roles.get('payoff').length],
        ]),
      );
    },
  },
};
