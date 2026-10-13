import {pairsAndScores, poolLine, roleTable, section} from '../blocks.mjs';

export default {
  doc: 'RED_PANDA_RULE.md',
  blocks: {
    coverage: (coverage) =>
      section(
        poolLine(coverage),
        roleTable(coverage.roles(coverage.engine.getRedPandaRoles, ['member', 'search']), {
          names: 6,
          inks: coverage.inks,
        }),
        pairsAndScores(coverage.pairs('red-panda')),
      ),
  },
};
