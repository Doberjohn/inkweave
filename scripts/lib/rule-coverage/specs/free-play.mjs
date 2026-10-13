import {pairsLead, poolLine, section} from '../blocks.mjs';
import {fmt, nameList, table, tallyText} from '../render.mjs';
import {namedIn, namedOrder, scoreCounts} from '../stats.mjs';

// "{anchor} plays {payoff} for free": an explanation names the anchor first.
const anchorOf = (pair) => namedOrder(pair)[0];

/** An anchor's row: its inks, its payoffs, their scores and their inks. */
function anchorRow(coverage, anchor, pairs) {
  const own = pairs.filter((pair) => anchorOf(pair) === anchor);
  const payoffs = namedIn(own, 1);
  const scores = scoreCounts(own)
    .reverse()
    .map(([score, n]) => `${score}: ${fmt(n)}`)
    .join(', ');
  return [
    anchor.fullName,
    coverage.inks(anchor).join('-'),
    fmt(payoffs.length),
    scores,
    tallyText(payoffs.flatMap(coverage.inks)),
  ];
}

export default {
  doc: 'FREE_PLAY_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const pairs = coverage.pairs('free-play');
      const anchors = namedIn(pairs, 0);
      const top = Math.max(...pairs.map((pair) => pair.score));
      const strong = namedIn(
        pairs.filter((pair) => pair.score === top),
        1,
      );
      return section(
        poolLine(coverage),
        `- **${fmt(anchors.length)} anchors**: ${nameList(anchors)}\n- ${pairsLead(pairs)}`,
        table(
          ['Anchor', 'Ink', 'Deck-compatible payoffs', 'Pairs per score', 'Payoffs per ink'],
          anchors.map((anchor) => anchorRow(coverage, anchor, pairs)),
        ),
        `The ${fmt(strong.length)} cost-1 characters that score ${top}, for an on-play effect the free play also ` +
          `triggers: ${nameList(strong)}.`,
      );
    },
  },
};
