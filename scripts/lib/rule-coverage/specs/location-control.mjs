import {holdersLine, pairsLead, poolLine, roleTable, scoreTable, section} from '../blocks.mjs';
import {bars, fmt, tallyText, tierColor} from '../render.mjs';

const ROLES = [
  'at-payoff',
  'play-trigger',
  'move-trigger',
  'buff',
  'location-ramp',
  'move',
  'in-play-check',
  'search',
  'boost',
];

const locationRules = (engine) =>
  engine.getAllRules().filter((rule) => rule.playstyleId === 'location-control');

/** Each sub-rule's own pairs, most first, coloured by the tier of its top score. */
function subRuleBars(coverage, rules) {
  const entries = rules
    .map((rule) => {
      const pairs = coverage.pairs(rule.id);
      return {
        name: rule.name,
        count: pairs.length,
        top: Math.max(0, ...pairs.map((pair) => pair.score)),
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return bars({
    title: 'Pairs per sub-rule, before merging',
    label: 'Pairs',
    bars: entries.map(({name, count}) => [name, count]),
    colors: entries.map(({top}) => tierColor(top)),
  });
}

export default {
  doc: 'LOCATION_CONTROL_RULE.md',
  blocks: {
    pairs: (coverage) => {
      const rules = locationRules(coverage.engine);
      const merged = coverage.pairs(...rules.map((rule) => rule.id));
      return section(
        poolLine(coverage),
        `Merged across the ${fmt(rules.length)} sub-rules, ${pairsLead(merged)}:`,
        scoreTable(merged),
        subRuleBars(coverage, rules),
      );
    },
    coverage: (coverage) => {
      const {engine} = coverage;
      const locations = coverage.pool.cards.filter(engine.isLocation);
      const classified = locations.flatMap((card) => card.classifications ?? []);
      const groups = coverage.roles(engine.getLocationRoles, ROLES);
      return section(
        `**${fmt(locations.length)} Location cards** (${tallyText(locations.flatMap(coverage.inks))}). ` +
          `By classification: ${tallyText(classified)}.`,
        roleTable(groups, {names: 5, inks: coverage.inks}),
        holdersLine(groups),
      );
    },
  },
};
