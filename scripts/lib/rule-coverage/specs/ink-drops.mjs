import {pairsLead, poolLine, roleBullet, section, shapeTable} from '../blocks.mjs';
import {doughnut, fmt, nameList, table, tallyText} from '../render.mjs';
import {byName, holders, scoreCounts} from '../stats.mjs';

const INKS = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];
const GATED = /The opponent decides whether you get the drop\.$/;

/** A pair shape and its opponent-gated twin, which takes -1, floored at 5. */
function withGate(label, score, pattern) {
  const matches = (gated) => (pair) =>
    pattern.test(pair.explanation) && GATED.test(pair.explanation) === gated;
  return [
    {label, score, test: matches(false)},
    {label: `${label}, gated`, score: Math.max(5, score - 1), test: matches(true)},
  ];
}

const SHAPES = [
  ...withGate('maker ↔ spend rider', 7, /banks the ink drop you remove to play/),
  ...withGate(
    'repeating maker ↔ remove trigger',
    8,
    /keeps making ink drops, and spending one each turn draws a card/,
  ),
  ...withGate('one-shot maker ↔ remove trigger', 6, /banks an ink drop, and spending it fires/),
  ...withGate('one-shot maker ↔ hold', 6, /banks an ink drop, and holding it keeps/),
  ...withGate(
    'repeating maker ↔ hold',
    7,
    /keeps making ink drops, so you can spend some and still hold one/,
  ),
  ...withGate('one-shot maker ↔ sink', 6, /turns the drop .* makes into a permanent inkwell card/),
  ...withGate('burst maker ↔ sink', 7, /gets the \d+ drops .*'s Shift removes in one go/),
  ...withGate('repeating maker ↔ sink', 8, /^Each drop .* makes becomes a permanent inkwell card/),
  ...withGate('one-shot maker ↔ gain gate', 6, /'s ink drop lets .* quest and challenge that turn/),
  ...withGate('repeating maker ↔ gain gate', 7, /can get you an ink drop every turn/),
  {label: 'hold ↔ hold', score: 6, test: /^One held ink drop switches on both/},
];

/** The payoff shapes, in the order a payoff with two of them is filed under. */
const PAYOFF_SHAPES = [
  ['spend', 'isDropSpendRider'],
  ['remove trigger', 'isDropRemoveTrigger'],
  ['hold', 'isDropHoldPayoff'],
  ['sink', 'isDropSink'],
  ['gain gate', 'isDropGainGate'],
];

function dropGroups(coverage) {
  const roles = coverage.roles(coverage.engine.getInkDropRoles, [
    'drop-maker',
    'drop-payoff',
    'drop-shared',
  ]);
  const payoffs = roles.get('drop-payoff');
  const shapes = PAYOFF_SHAPES.map(([shape, helper]) => [
    shape,
    payoffs.filter((card) => coverage.engine[helper](card)),
  ]);
  return {
    roles,
    all: holders(roles),
    makers: roles.get('drop-maker'),
    payoffs,
    shared: roles.get('drop-shared'),
    shapes,
  };
}

/** Cards with partners for `ruleId` and for no other rule. */
function onlyGroup(coverage, ruleId, cards) {
  const others = coverage.engine.getAllRules().filter((rule) => rule.id !== ruleId);
  const elsewhere = new Set(others.flatMap((rule) => [...coverage.partners(rule.id).keys()]));
  const own = coverage.partners(ruleId);
  return cards.filter((card) => own.has(card.id) && !elsewhere.has(card.id));
}

const perInk = (cards, inks) => (ink) => cards.filter((card) => inks(card).includes(ink)).length;

/**
 * The role composition doughnut's slices, each drop card in one: makers first, then payoffs
 * under their first shape. A card no slice takes fails the run, so the slices always add up.
 */
function compositionSlices({all, makers, shapes}) {
  const filed = new Set(makers);
  const slices = [['Makers', makers.length]];
  for (const [shape, cards] of shapes) {
    const fresh = cards.filter((card) => !filed.has(card));
    for (const card of fresh) filed.add(card);
    slices.push([`${shape[0].toUpperCase()}${shape.slice(1)} payoffs`, fresh.length]);
  }
  const unfiled = all.filter((card) => !filed.has(card));
  if (unfiled.length > 0) throw new Error(`no role composition slice for ${nameList(unfiled)}`);
  return slices;
}

export default {
  doc: 'INK_DROPS_RULE.md',
  blocks: {
    inks: (coverage) => {
      const {makers, payoffs, shared} = dropGroups(coverage);
      const [m, p, s] = [makers, payoffs, shared].map((cards) => perInk(cards, coverage.inks));
      const rows = INKS.map((ink) => [ink, fmt(m(ink)), fmt(p(ink)), fmt(s(ink))]);
      return section(
        poolLine(coverage),
        table(['Ink', 'Makers', 'Payoffs', 'Shared makers'], rows),
      );
    },
    helpers: (coverage) => {
      const {engine} = coverage;
      const {all} = dropGroups(coverage);
      const gain = (card) => `${card.fullName} (${engine.getInkDropGain(card)})`;
      const rows = [
        ['`isRepeatingDropMaker`', nameList(all.filter(engine.isRepeatingDropMaker))],
        ['`isLateDropMaker`', nameList(all.filter(engine.isLateDropMaker))],
        ['`isOpponentGatedDrop`', nameList(all.filter(engine.isOpponentGatedDrop))],
        [
          'burst',
          all
            .filter((card) => engine.getInkDropGain(card) >= 2)
            .map(gain)
            .join(', ') || 'none',
        ],
      ];
      return table(['Helper', 'Cards'], rows);
    },
    distribution: (coverage) => {
      const {all} = dropGroups(coverage);
      const pairs = coverage.pairs('ink-drops');
      const totals = scoreCounts(pairs)
        .reverse()
        .map(([score, n]) => `${score}: ${fmt(n)}`)
        .join(', ');
      const partnered = coverage.partners('ink-drops');
      const loners = all.filter((card) => !partnered.has(card.id));
      const only = onlyGroup(coverage, 'ink-drops', all);
      return section(
        `**${fmt(all.length)} drop cards**. ${pairsLead(pairs)}:`,
        shapeTable(pairs, SHAPES, {hideEmpty: true}),
        `Totals: **${totals}**. Drop cards with no partner: ${nameList(loners)}. ` +
          `Cards whose only synergy group is Ink Drops: ${fmt(only.length)}` +
          `${only.length > 0 ? ` (${nameList(only)})` : ''}.`,
      );
    },
    coverage: (coverage) => {
      const groups = dropGroups(coverage);
      const {all, makers, payoffs, shared, shapes} = groups;
      const shapeText = shapes
        .filter(([, cards]) => cards.length > 0)
        .map(([shape, cards]) => `**${shape}** ${nameList([...cards].sort(byName))}`)
        .join('; ');
      return section(
        [
          roleBullet('maker', makers, {inks: coverage.inks, names: 100}),
          `- **${fmt(payoffs.length)} payoffs** (${tallyText(payoffs.flatMap(coverage.inks))}): ${shapeText || 'none'}`,
          roleBullet('shared maker', shared, {inks: coverage.inks, names: 100}),
        ].join('\n'),
        doughnut(`Role composition (${fmt(all.length)} cards)`, compositionSlices(groups)),
      );
    },
  },
};
