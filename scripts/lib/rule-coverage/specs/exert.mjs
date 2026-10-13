import {
  compositionChart,
  holdersLine,
  pairsLead,
  poolLine,
  roleBullet,
  section,
  shapeTable,
} from '../blocks.mjs';
import {fmt, nameList, tallyText} from '../render.mjs';

const SHAPES = [
  {label: 'enabler ↔ consume payoff', score: 8, test: /punishes the exerted body/},
  {label: 'enabler ↔ state payoff', score: 6, test: /keeps an opposing character exerted/},
  {label: 'payoff ↔ payoff', score: 5, test: /^Both reward opposing characters being exerted/},
];

/** Cards that put a card into an inkwell "facedown and exerted": ramp the rule must never tag. */
const INKWELL_EXERTED = /facedown and exerted/i;

function exertGroups(coverage) {
  const roles = coverage.roles(coverage.engine.getExertRoles, ['exert-enabler', 'exert-payoff']);
  const payoffs = roles.get('exert-payoff');
  const consume = payoffs.filter((card) => coverage.engine.isExertConsumePayoff(card));
  return {
    roles,
    enablers: roles.get('exert-enabler'),
    payoffs,
    consume,
    state: payoffs.filter((c) => !consume.includes(c)),
  };
}

export default {
  doc: 'EXERT_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const pairs = coverage.pairs('exert');
      return section(poolLine(coverage), `${pairsLead(pairs)}:`, shapeTable(pairs, SHAPES));
    },
    coverage: (coverage) => {
      const {roles, enablers, payoffs, consume, state} = exertGroups(coverage);
      const inkwellRamp = coverage.pool.cards.filter((card) =>
        INKWELL_EXERTED.test(card.text ?? ''),
      );
      const tagged = inkwellRamp.filter((card) => coverage.engine.getExertRoles(card).length > 0);
      return section(
        [
          roleBullet('exert-enabler', enablers, {inks: coverage.inks, names: 40}),
          `- **${fmt(payoffs.length)} exert-payoffs** (${tallyText(payoffs.flatMap(coverage.inks))}): ` +
            `**consume (${fmt(consume.length)})** ${nameList(consume)}; ` +
            `**state (${fmt(state.length)})** ${nameList(state)}`,
        ].join('\n'),
        holdersLine(roles),
        `Cards that put a card into an inkwell "facedown and exerted": ${fmt(inkwellRamp.length)}, ` +
          `of which ${fmt(tagged.length)} gain an exert role.`,
        compositionChart([
          ['Enablers', enablers],
          ['Consume payoffs', consume],
          ['State payoffs', state],
        ]),
      );
    },
  },
};
