/**
 * The shared shapes of a coverage block (#479): the pair lead, the score and pair-shape tables,
 * the role table and the charts. The doc specs in specs/ compose them.
 */
import {
  bars,
  doughnut,
  fmt,
  nameList,
  pct,
  plural,
  table,
  tally,
  tallyText,
  tierColor,
  tierName,
} from './render.mjs';
import {holders, scoreCounts} from './stats.mjs';

/** Markdown parts as paragraphs, empty ones left out. */
export const section = (...parts) => parts.filter(Boolean).join('\n\n');

/** The line that opens a doc's coverage: where the numbers come from and which cards they count. */
export const poolLine = (coverage) =>
  `Counted by \`pnpm refresh-rule-coverage\` over the ${fmt(coverage.pool.cards.length)} Core cards ` +
  `in the synergy pool (${coverage.pool.label}).`;

/** "**1,234 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`)". */
export const pairsLead = (pairs) =>
  `**${plural(pairs.length, 'unique pair')}** after the engine's ink-compatibility filter (\`canShareDeck\`)`;

/** Score | Pairs | Share, highest score first. */
export function scoreTable(pairs) {
  const rows = scoreCounts(pairs).map(([score, n]) => [score, fmt(n), pct(n, pairs.length)]);
  return table(['Score', 'Pairs', 'Share'], rows);
}

/** Pairs per display tier, weakest first: "0 Weak / 75 Moderate / 46 Strong / 3 Perfect". */
export function tierSplit(pairs) {
  const counts = new Map(tally(pairs.map((pair) => tierName(pair.score))));
  return ['Weak', 'Moderate', 'Strong', 'Perfect']
    .map((tier) => `${fmt(counts.get(tier) ?? 0)} ${tier}`)
    .join(' / ');
}

/** The pairs lead, then the score table. */
export const pairsAndScores = (pairs) => section(`${pairsLead(pairs)}:`, scoreTable(pairs));

function shapeMatches(shape, pair) {
  if (shape.score !== pair.score) return false;
  if (!shape.test) return true;
  return shape.test instanceof RegExp ? shape.test.test(pair.explanation) : shape.test(pair);
}

/**
 * Pairs counted by shape. A pair takes the first shape with its score whose `test`, when given,
 * passes; a pair no shape takes fails the run, so a new explanation can't go uncounted.
 *
 * @param {object[]} pairs
 * @param {Array<{label: string, score: number, test?: RegExp | ((pair: object) => boolean)}>} shapes
 *   in display order; `test` is a pattern on the explanation, or a check of the whole pair
 * @param {{hideEmpty?: boolean}} [options] - leave out shapes with no pairs
 */
export function shapeTable(pairs, shapes, {hideEmpty = false} = {}) {
  const counts = new Map(shapes.map((shape) => [shape, 0]));
  for (const pair of pairs) {
    const shape = shapes.find((s) => shapeMatches(s, pair));
    if (!shape)
      throw new Error(
        `no pair shape for a ${pair.ruleId} pair at ${pair.score}: ${pair.explanation}`,
      );
    counts.set(shape, counts.get(shape) + 1);
  }
  const rows = shapes
    .filter((shape) => !hideEmpty || counts.get(shape) > 0)
    .map((shape) => [
      shape.label,
      fmt(counts.get(shape)),
      shape.score,
      pct(counts.get(shape), pairs.length),
    ]);
  return table(['Pair shape', 'Pairs', 'Score', 'Share'], rows);
}

/** A count, with the cards named when there are at most `names` of them. */
export const countWithNames = (cards, names) =>
  cards.length > 0 && cards.length <= names
    ? `${fmt(cards.length)} (${nameList(cards)})`
    : fmt(cards.length);

/**
 * Role | Cards [| Cards per ink].
 *
 * @param {Map<string, object[]>} groups - from coverage.roles
 * @param {object} [options]
 * @param {number} [options.names] - name the cards of a role with at most this many
 * @param {(card: object) => string[]} [options.inks] - add a column counting each role's cards per
 *   ink (coverage.inks); a dual-ink card counts under both of its inks
 * @param {Record<string, string>} [options.labels] - a role's display name
 * @param {boolean} [options.hideEmpty] - leave out roles no card holds
 */
export function roleTable(groups, {names = 0, inks, labels = {}, hideEmpty = false} = {}) {
  const rows = [...groups]
    .filter(([, cards]) => !hideEmpty || cards.length > 0)
    .map(([role, cards]) => [
      labels[role] ?? role,
      countWithNames(cards, names),
      ...(inks ? [tallyText(cards.flatMap(inks))] : []),
    ]);
  return table(['Role', 'Cards', ...(inks ? ['Cards per ink'] : [])], rows);
}

/** The cards that hold more than one of the roles. */
export function multiRole(groups) {
  const counts = new Map();
  for (const card of [...groups.values()].flat()) counts.set(card, (counts.get(card) ?? 0) + 1);
  return holders(groups).filter((card) => counts.get(card) > 1);
}

/** "Cards with a role: 10. Cards with more than one: 2 (A, B)." */
export const holdersLine = (groups, names = 6) =>
  `Cards with a role: ${fmt(holders(groups).length)}. ` +
  `Cards with more than one: ${countWithNames(multiRole(groups), names)}.`;

/**
 * "- **7 self-banish cards** (Ruby 5, Emerald 2): A, B", the cards named when there are at most
 * `names`, the inks counted when `inks` is given.
 *
 * @param {string} noun - singular: "self-banish card"
 * @param {object[]} cards
 * @param {{inks?: (card: object) => string[], names?: number}} [options]
 */
export function roleBullet(noun, cards, {inks, names = 0} = {}) {
  const inkText = inks ? ` (${tallyText(cards.flatMap(inks))})` : '';
  const nameText = cards.length > 0 && cards.length <= names ? `: ${nameList(cards)}` : '';
  return `- **${plural(cards.length, noun)}**${inkText}${nameText}`;
}

/** Card | Set, one row per card, the set by name. */
export const cardSetTable = (coverage, cards) =>
  table(
    ['Card', 'Set'],
    cards.map((card) => [card.fullName, coverage.pool.setName(card.setCode)]),
  );

/** "5-7": the lowest and highest score among the pairs. */
export function scoreRange(pairs) {
  const scores = pairs.map((pair) => pair.score);
  const [low, high] = [Math.min(...scores), Math.max(...scores)];
  return low === high ? String(low) : `${low}-${high}`;
}

/** A doughnut of role sizes. */
export const roleChart = (title, groups, labels = {}) =>
  doughnut(
    title,
    [...groups].map(([role, cards]) => [labels[role] ?? role, cards.length]),
  );

/** Pairs per score as bars coloured by display tier, lowest score first. */
export function scoreChart(title, pairs) {
  const counts = scoreCounts(pairs).reverse();
  return bars({
    title,
    label: 'Pairs',
    bars: counts.map(([score, n]) => [String(score), n]),
    colors: counts.map(([score]) => tierColor(score)),
  });
}

/**
 * How many cards list how many partners, in buckets: [[1, 4], [5, 9], [10, 14], [15, Infinity]].
 *
 * @param {Map<string, Set<string>>} partners - from coverage.partners
 * @param {string} noun - "targets", "matches"
 */
export function partnerBuckets(partners, noun) {
  const sizes = [...partners.values()].map((ids) => ids.size);
  const buckets = [
    [1, 4],
    [5, 9],
    [10, 14],
    [15, Infinity],
  ];
  return buckets.map(([low, high]) => [
    high === Infinity ? `${low}+ ${noun}` : `${low}-${high} ${noun}`,
    sizes.filter((n) => n >= low && n <= high).length,
  ]);
}
