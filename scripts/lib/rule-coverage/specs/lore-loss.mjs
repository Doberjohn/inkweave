import {cardSetTable, pairsLead, poolLine, scoreRange, section, shapeTable} from '../blocks.mjs';
import {fmt, table} from '../render.mjs';
import {holders} from '../stats.mjs';

const SHAPES = [
  {label: 'burn ↔ burn', score: 5, test: /^Both make opponents lose lore/},
  {label: 'burn ↔ steal', score: 6, test: /pushes opponents down/},
  {label: 'steal ↔ steal', score: 7, test: /^Both steal lore/},
];

const loreRoles = (coverage) =>
  coverage.roles(coverage.engine.getLoreDenialRoles, ['burn', 'steal']);

export default {
  doc: 'LORE_LOSS_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const roles = loreRoles(coverage);
      const pairs = coverage.pairs('lore-loss');
      const rows = [
        ['Burn cards', fmt(roles.get('burn').length)],
        ['Steal cards', fmt(roles.get('steal').length)],
        ['Total cards', fmt(holders(roles).length)],
        ['Total unique pairs', fmt(pairs.length)],
        ['Score range', scoreRange(pairs)],
        ['Playstyle ID', '`lore-denial`'],
      ];
      return section(poolLine(coverage), table(['Metric', 'Value'], rows));
    },
    distribution: (coverage) => {
      const pairs = coverage.pairs('lore-loss');
      return section(`${pairsLead(pairs)}:`, shapeTable(pairs, SHAPES));
    },
    'burn-cards': (coverage) => cardSetTable(coverage, loreRoles(coverage).get('burn')),
    'steal-cards': (coverage) => cardSetTable(coverage, loreRoles(coverage).get('steal')),
  },
};
