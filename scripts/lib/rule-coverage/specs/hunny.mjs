import {holdersLine, pairsAndScores, poolLine, roleTable, section} from '../blocks.mjs';

export default {
  doc: 'HUNNY_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const roles = coverage.roles(coverage.engine.getHunnyRoles, [
        'member',
        'density',
        'search',
        'buff',
      ]);
      return section(
        poolLine(coverage),
        roleTable(roles, {names: 6, inks: coverage.inks}),
        holdersLine(roles),
        pairsAndScores(coverage.pairs('hunny')),
      );
    },
  },
};
