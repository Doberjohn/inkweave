import {pairsLead, poolLine, section, shapeTable} from '../blocks.mjs';
import {fmt, table, tallyText} from '../render.mjs';
import {holders, templatePattern, tokenCard} from '../stats.mjs';

const ROLES = ['inkwell-ramp', 'inkwell-trigger', 'cost-reduction'];

/**
 * Ramp's scores and explanations live in tuning.json, so the shapes read both from the engine's
 * TUNING: a retuned score or reworded template moves the table instead of breaking it.
 */
function rampShapes(engine) {
  const {scores, templates} = engine.TUNING.ruleTexts.ramp;
  const chainPattern = templatePattern(templates['ramp-trigger']);
  const chain = (deck, repeating) => (pair) => {
    const groups = chainPattern.exec(pair.explanation)?.groups;
    if (!groups) return false;
    const deckRamp = engine.isDeckRamp(tokenCard(pair, groups.RAMP));
    return (
      deckRamp === deck && engine.isRepeatingTrigger(tokenCard(pair, groups.TRIGGER)) === repeating
    );
  };
  const plain = (key) => templatePattern(templates[key]);
  return [
    {
      label: 'Deck ramp ↔ repeating trigger',
      score: scores['chain.deckRepeating'],
      test: chain(true, true),
    },
    {
      label: 'Deck ramp ↔ once-per-turn trigger',
      score: scores['chain.mixed'],
      test: chain(true, false),
    },
    {
      label: 'Self-sacrifice ↔ repeating trigger',
      score: scores['chain.mixed'],
      test: chain(false, true),
    },
    {
      label: 'Self-sacrifice ↔ once-per-turn trigger',
      score: scores['chain.neither'],
      test: chain(false, false),
    },
    {
      label: 'Cost reduction ↔ cost reduction (overlapping targets)',
      score: scores.costOverlap,
      test: plain('cost-cost'),
    },
    {label: 'Ramp ↔ ramp', score: scores.density, test: plain('ramp-ramp')},
    {label: 'Trigger ↔ trigger', score: scores.density, test: plain('trigger-trigger')},
    {label: 'Ramp ↔ cost reduction', score: scores.density, test: plain('ramp-cost')},
    {label: 'Trigger ↔ cost reduction', score: scores.density, test: plain('trigger-cost')},
  ];
}

/** "26 deck ramp + 12 self-sacrifice": the cards that pass `split`, then the rest. */
function subPatterns(cards, split, [yes, no]) {
  const passing = cards.filter(split).length;
  return `${fmt(passing)} ${yes} + ${fmt(cards.length - passing)} ${no}`;
}

export default {
  doc: 'RAMP_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const pairs = coverage.pairs('ramp');
      return section(
        poolLine(coverage),
        `${pairsLead(pairs)}:`,
        shapeTable(pairs, rampShapes(coverage.engine)),
      );
    },
    coverage: (coverage) => {
      const {engine} = coverage;
      const roles = coverage.roles(engine.getRampRoles, ROLES);
      const all = holders(roles);
      const inks = (role) => tallyText(roles.get(role).flatMap(coverage.inks));
      const rows = [
        [
          'Inkwell Ramp',
          fmt(roles.get('inkwell-ramp').length),
          subPatterns(roles.get('inkwell-ramp'), engine.isDeckRamp, [
            'deck ramp',
            'self-sacrifice',
          ]),
          inks('inkwell-ramp'),
        ],
        [
          'Inkwell Triggers',
          fmt(roles.get('inkwell-trigger').length),
          subPatterns(roles.get('inkwell-trigger'), engine.isRepeatingTrigger, [
            'repeating',
            'once-per-turn',
          ]),
          inks('inkwell-trigger'),
        ],
        [
          'Cost Reduction',
          fmt(roles.get('cost-reduction').length),
          'Exert/Quest/Passive activation',
          inks('cost-reduction'),
        ],
      ];
      return section(
        `**${fmt(all.length)} total ramp cards**:`,
        table(['Role', 'Cards', 'Sub-patterns', 'Cards per ink'], rows),
      );
    },
  },
};
