import {partnerBuckets, poolLine, scoreChart, section} from '../blocks.mjs';
import {doughnut, fmt} from '../render.mjs';

// Shift scores and explanations are tunable (tuning.json), so this spec reads only the pairs.
export default {
  doc: 'SHIFT_TARGET_RULE.md',
  blocks: {
    groups: (coverage) => {
      const partners = coverage.partners('shift-targets');
      const title = `Cards by number of Shift partners (${fmt(partners.size)} cards)`;
      return section(poolLine(coverage), doughnut(title, partnerBuckets(partners, 'partners')));
    },
    scores: (coverage) => {
      const pairs = coverage.pairs('shift-targets');
      return scoreChart(`Score distribution (${fmt(pairs.length)} unique pairs)`, pairs);
    },
  },
};
