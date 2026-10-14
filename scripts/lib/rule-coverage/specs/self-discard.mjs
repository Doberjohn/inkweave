import {
  countWithNames,
  pairsLead,
  poolLine,
  roleChart,
  roleTable,
  section,
  shapeTable,
} from '../blocks.mjs';
import {fmt, table} from '../render.mjs';
import {holders, namedIn} from '../stats.mjs';

const ROLES = ['enabler', 'reanimator', 'state-payoff', 'zone-payoff', 'mill'];

const REPLAY = /can replay them from the discard/;
const SWITCH = /switches on .*'s discard payoff/;
const UNLOCK = /keeps your hand at/;

const SHAPES = [
  {
    label: 'enabler ↔ a payoff its discard switches on',
    score: 8,
    test: (p) => REPLAY.test(p.explanation) || SWITCH.test(p.explanation),
  },
  {label: 'enabler ↔ any other reanimator', score: 7, test: REPLAY},
  {label: 'enabler ↔ small-hand payoff', score: 7, test: UNLOCK},
  {label: 'mill ↔ reanimator', score: 7, test: /mills cards into your discard/},
  {label: 'mill ↔ zone-payoff', score: 7, test: /mills your deck into the discard/},
  {label: 'enabler ↔ zone-payoff', score: 6, test: /fills your discard from hand/},
  {label: 'reanimator ↔ reanimator', score: 6, test: /both take cards from your discard/},
  {label: 'enabler ↔ enabler', score: 5, test: /both fill your discard from your hand/},
  {label: 'other same-axis', score: 5, test: /both go in a Self-Discard deck/},
];

const LABELS = {
  enabler: 'enabler (loot / discard-hand / discard-cost)',
  reanimator:
    'reanimator ("from your discard", minus self-contained, named-card and forced deck-bottom clauses)',
  'state-payoff': 'state-payoff (discarded this turn / Hellbent / STONE BY DAY)',
  'zone-payoff': 'zone-payoff (count / card-type / put-this-turn)',
  mill: 'mill (deck-side filler)',
};

const discardRoles = (coverage) => coverage.roles(coverage.engine.getSelfDiscardRoles, ROLES);

/** The pairs at `score` whose explanation matches `pattern`. */
const pairsLike = (pairs, pattern, score) =>
  pairs.filter((pair) => pair.score === score && pattern.test(pair.explanation));

export default {
  doc: 'SELF_DISCARD_RULE.md',
  blocks: {
    distribution: (coverage) => {
      const roles = discardRoles(coverage);
      const pairs = coverage.pairs('self-discard');
      const counts = ROLES.map((role) => `${fmt(roles.get(role).length)} ${role}`).join(', ');
      return section(
        poolLine(coverage),
        `**${fmt(holders(roles).length)} tagged cards** (${counts}; roles overlap on multi-role cards). ` +
          `${pairsLead(pairs)}:`,
        shapeTable(pairs, SHAPES),
      );
    },
    coverage: (coverage) => {
      const roles = discardRoles(coverage);
      const pairs = coverage.pairs('self-discard');
      const unlocks = pairsLike(pairs, UNLOCK, 7);
      const outlets = namedIn(unlocks, 0).filter((card) => roles.get('enabler').includes(card));
      const facts = [
        [
          'Reanimators that fire on the discard (8 with an outlet)',
          countWithNames(namedIn(pairsLike(pairs, REPLAY, 8), 1), 6),
        ],
        [
          "State payoffs an outlet's discard switches on (8)",
          countWithNames(namedIn(pairsLike(pairs, SWITCH, 8), 1), 6),
        ],
        ['STONE BY DAY payoffs an outlet unlocks (7)', countWithNames(namedIn(unlocks, 1), 6)],
        ['Outlets that shrink the hand enough to unlock one (7)', countWithNames(outlets, 6)],
      ];
      return section(
        roleTable(roles, {labels: LABELS, inks: coverage.inks}),
        table(['Read from the pairs', 'Cards'], facts),
        roleChart(roles, {
          enabler: 'Enabler',
          reanimator: 'Reanimator',
          'state-payoff': 'State-payoff',
          'zone-payoff': 'Zone-payoff',
          mill: 'Mill',
        }),
      );
    },
  },
};
