import {pairsLead, partnerBuckets, poolLine, roleBullet, scoreChart, section} from '../blocks.mjs';
import {doughnut, fmt, nameList} from '../render.mjs';
import {byName} from '../stats.mjs';

/** A Singer keyword the card data states, not one the transformer reads from ability text. */
const printedSinger = (coverage, card) =>
  (coverage.pool.raw.get(card.id)?.abilities ?? []).some(
    (a) => a.type === 'keyword' && a.keyword === 'Singer',
  );

export default {
  doc: 'SINGER_SONGS_RULE.md',
  blocks: {
    scores: (coverage) => {
      const pairs = coverage.pairs('singer-songs');
      return section(
        poolLine(coverage),
        scoreChart(`Score distribution (${fmt(pairs.length)} unique pairs)`, pairs),
      );
    },
    coverage: (coverage) => {
      const {engine} = coverage;
      const singers = coverage.pool.cards
        .filter((card) => engine.hasKeyword(card, 'Singer'))
        .sort(byName);
      const songs = coverage.pool.cards.filter((card) => engine.isSong(card));
      const conditional = singers.filter((card) => !printedSinger(coverage, card));
      const partners = coverage.partners('singer-songs');
      const conditionalText = conditional.length > 0 ? `: ${nameList(conditional)}` : '';
      return section(
        [
          `${roleBullet('Singer', singers, {inks: coverage.inks})}, ${fmt(conditional.length)} of them conditional${conditionalText}`,
          roleBullet('Song', songs, {inks: coverage.inks}),
          `- ${pairsLead(coverage.pairs('singer-songs'))}, scored as the chart under Score Table shows`,
        ].join('\n'),
        doughnut(
          `Cards by number of partners (${fmt(partners.size)} cards)`,
          partnerBuckets(partners, 'partners'),
        ),
      );
    },
  },
};
