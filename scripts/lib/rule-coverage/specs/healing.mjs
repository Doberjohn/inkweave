import {pairsLead, poolLine, roleBullet, section, shapeTable} from '../blocks.mjs';
import {doughnut, fmt, pct} from '../render.mjs';
import {holders} from '../stats.mjs';

const SHAPES = [
  {label: 'healer <-> heal-payoff', score: 8, test: /clears damage off your characters/},
  {label: 'heal-payoff <-> heal-payoff', score: 7, test: /^Both reward removing damage/},
];

/** Healers, payoffs, and the cards that are only one or both. */
function healGroups(coverage) {
  const roles = coverage.roles(coverage.engine.getHealRoles, ['healer', 'heal-payoff']);
  const [healers, payoffs] = [roles.get('healer'), roles.get('heal-payoff')];
  const both = healers.filter((card) => payoffs.includes(card));
  return {
    healers,
    payoffs,
    both,
    healersOnly: healers.filter((card) => !both.includes(card)),
    payoffsOnly: payoffs.filter((card) => !both.includes(card)),
    all: holders(roles),
  };
}

export default {
  doc: 'HEALING_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const groups = healGroups(coverage);
      const pairs = coverage.pairs('healing');
      return section(
        poolLine(coverage),
        `${fmt(groups.healers.length)} healers + ${fmt(groups.payoffs.length)} heal-payoffs ` +
          `(${fmt(groups.payoffsOnly.length)} pure payoff + ${fmt(groups.both.length)} dual-role ` +
          `healer+payoff) = ${fmt(groups.all.length)} distinct participating cards. ${pairsLead(pairs)}:`,
        shapeTable(pairs, SHAPES),
        `${fmt(coverage.compatiblePairs(groups.healersOnly))} healer <-> healer pairs are dropped ` +
          '(payoff-anchored).',
        doughnut(`Role composition (${fmt(groups.all.length)} cards)`, [
          ['Healers only', groups.healersOnly.length],
          ['Payoffs only', groups.payoffsOnly.length],
          ['Both roles', groups.both.length],
        ]),
      );
    },
    coverage: (coverage) => {
      const groups = healGroups(coverage);
      const madrigals = groups.healers.filter((card) =>
        coverage.engine.hasClassification(card, 'Madrigal'),
      );
      const payoffNote = `${fmt(groups.payoffsOnly.length)} pure payoff, ${fmt(groups.both.length)} dual-role`;
      return [
        roleBullet('healer', groups.healers, {inks: coverage.inks}),
        `${roleBullet('heal-payoff', groups.payoffs, {inks: coverage.inks})}; ${payoffNote}`,
        `- Healers with the Madrigal classification: ${fmt(madrigals.length)} of ` +
          `${fmt(groups.healers.length)} (${pct(madrigals.length, groups.healers.length)})`,
      ].join('\n');
    },
  },
};
