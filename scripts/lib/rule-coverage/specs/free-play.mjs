import {pairsLead, poolLine, scoreRange, section} from '../blocks.mjs';
import {fmt, nameList, plural, table, tallyText} from '../render.mjs';
import {namedIn, namedOrder, scoreCounts} from '../stats.mjs';

// "{anchor} plays {payoff} for free": an explanation names the anchor first.
const anchorOf = (pair) => namedOrder(pair)[0];

// The engine's explanation when the payoff's on-play effect fires too.
const ON_PLAY = /triggering its on-play effect\.$/;

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

/** The payoffs whose on-play effect the free play also triggers, and what they score. */
function onPlayLine(pairs) {
  const onPlay = pairs.filter((pair) => ON_PLAY.test(pair.explanation));
  if (onPlay.length === 0) {
    return 'No cost-1 character in the pool has an on-play effect the free play triggers.';
  }
  const payoffs = namedIn(onPlay, 1);
  return (
    `The ${fmt(payoffs.length)} cost-1 characters that score ${scoreRange(onPlay)}, for an on-play ` +
    `effect the free play also triggers: ${nameList(payoffs)}.`
  );
}

export default {
  doc: 'FREE_PLAY_RULE.md',
  blocks: {
    coverage: (coverage) => {
      const pairs = coverage.pairs('free-play');
      const anchors = namedIn(pairs, 0);
      return section(
        poolLine(coverage),
        `- **${plural(anchors.length, 'anchor')}**: ${nameList(anchors)}\n- ${pairsLead(pairs)}`,
        table(
          ['Anchor', 'Ink', 'Deck-compatible payoffs', 'Pairs per score', 'Payoffs per ink'],
          anchors.map((anchor) => anchorRow(coverage, anchor, pairs)),
        ),
        onPlayLine(pairs),
      );
    },
  },
};
