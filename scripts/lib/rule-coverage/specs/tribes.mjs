import {poolLine, section} from '../blocks.mjs';
import {fmt, table} from '../render.mjs';
import {holders, scoreCounts} from '../stats.mjs';

const ROLES = ['member', 'buff', 'trigger', 'search', 'in-play-check'];
const PAYOFF_ROLES = ROLES.filter((role) => role !== 'member');

/** One row's numbers for a tribe: its members, its payoffs and its pairs. */
function tribeStats(coverage, spec) {
  const groups = coverage.roles((card) => coverage.engine.getTribalRoles(card, spec), ROLES);
  const rule = coverage.engine.getAllRules().find((r) => r.id === spec.playstyleId);
  return {
    name: rule.name,
    members: groups.get('member').length,
    payoffs: holders(groups, PAYOFF_ROLES).length,
    pairs: coverage.pairs(spec.playstyleId),
  };
}

export default {
  doc: 'TRIBES_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const tribes = Object.values(coverage.engine.TRIBAL_SPECS).map((spec) =>
        tribeStats(coverage, spec),
      );
      const scores = [
        ...new Set(tribes.flatMap(({pairs}) => pairs.map((pair) => pair.score))),
      ].sort((a, b) => a - b);
      const dist = (pairs) => {
        const counts = new Map(scoreCounts(pairs));
        return scores.map((score) => fmt(counts.get(score) ?? 0)).join(' / ');
      };
      const rows = tribes.map(({name, members, payoffs, pairs}) => [
        name,
        fmt(members),
        fmt(payoffs),
        fmt(pairs.length),
        dist(pairs),
      ]);
      const headers = [
        'Tribe',
        'Members',
        'Payoff cards',
        'Unique pairs',
        `Score dist (${scores.join(' / ')})`,
      ];
      return section(poolLine(coverage), table(headers, rows));
    },
  },
};
