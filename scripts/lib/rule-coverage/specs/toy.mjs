import {pairsLead, poolLine, roleTable, section, shapeTable} from '../blocks.mjs';
import {fmt} from '../render.mjs';
import {holders} from '../stats.mjs';
import {TOY_ROLES} from './roles.mjs';

const SHAPES = [
  {label: 'member ↔ search', score: 8, test: /fetches .* from the deck/},
  {label: 'search ↔ banish-trigger', score: 8, test: /loads a Toy/},
  {label: 'tribal ↔ tribal', score: 7, test: /^Both reward Toy density/},
  {label: 'member ↔ tribal', score: 7, test: /^Contributes to the Toy density/},
  {
    label: 'member ↔ member, member ↔ generic, generic ↔ generic',
    score: 5,
    test: /^Both share the Toys deck/,
  },
];

const LABELS = {
  burn: 'burn (Lore Denial)',
  steal: 'steal (Lore Denial)',
  targeted: 'targeted (Discard)',
  random: 'random (Discard)',
  standard: 'standard (Discard)',
  'inkwell-ramp': 'inkwell-ramp (Ramp)',
  'inkwell-trigger': 'inkwell-trigger (Ramp)',
  'cost-reduction': 'cost-reduction (Ramp)',
};

export default {
  doc: 'TOY_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const roles = coverage.roles(coverage.engine.getToyRoles, TOY_ROLES);
      const pairs = coverage.pairs('toy');
      return section(
        poolLine(coverage),
        `**${fmt(holders(roles).length)} Toy-affiliated cards**. ${pairsLead(pairs)}:`,
        shapeTable(pairs, SHAPES),
        'Role population (roles no card holds are left out):',
        roleTable(roles, {names: 6, inks: coverage.inks, labels: LABELS, hideEmpty: true}),
      );
    },
  },
};
