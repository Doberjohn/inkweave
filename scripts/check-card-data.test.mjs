import {describe, it, expect} from 'vitest';
import {cardDataProblems} from './check-card-data.mjs';

/**
 * Stand-in for the engine's transformCard, no engine dist needed: like it, it reads the text from
 * `fullText` or the sections, and never the image links, which only the web app's loader reads.
 */
const transformCard = (card) => ({
  name: card.fullName,
  text: card.fullText ?? card.fullTextSections?.join('\n'),
  printings: (card.variants ?? []).map((v) => v.rarity),
});

const ART = {full: 'https://example.test/full.jpg', thumbnail: 'https://example.test/thumb.jpg'};
const PRINTING_ART = {full: 'https://example.test/enchanted.jpg'};
const PROMO_ART = {full: 'https://example.test/promo.jpg'};

/** The repo's full copy: the text twice over, links on the card, its printing and the promo. */
const repo = () => ({
  'allCards.json': {
    cards: [
      {
        id: 1,
        fullName: 'Ariel - Spectacular Singer',
        fullText: 'Singer 5\nDraw a card.',
        fullTextSections: ['Singer 5', 'Draw a card.'],
        images: ART,
        variants: [{id: 2, rarity: 'Enchanted', images: PRINTING_ART}],
      },
    ],
  },
  'collection/promos.json': [{id: 3, rarity: 'Special', baseId: 1, images: PROMO_ART}],
});

/** The local-images build's copy: the text once, as sections, and no links anywhere. */
const built = () => ({
  'allCards.json': {
    cards: [
      {
        id: 1,
        fullName: 'Ariel - Spectacular Singer',
        fullTextSections: ['Singer 5', 'Draw a card.'],
        variants: [{id: 2, rarity: 'Enchanted'}],
      },
    ],
  },
  'collection/promos.json': [{id: 3, rarity: 'Special', baseId: 1}],
});

const record = () => ({1: ART, 2: PRINTING_ART, 3: PROMO_ART});

describe('cardDataProblems', () => {
  it('passes a build whose cards transform the same and whose links all moved into the record', () => {
    expect(cardDataProblems({repo: repo(), built: built(), record: record(), transformCard})).toEqual([]);
  });

  it('passes a build without the record whose card files keep their links', () => {
    const kept = built();
    kept['allCards.json'].cards[0].images = ART;
    kept['allCards.json'].cards[0].variants[0].images = PRINTING_ART;
    kept['collection/promos.json'][0].images = PROMO_ART;
    expect(cardDataProblems({repo: repo(), built: kept, record: null, transformCard})).toEqual([]);
  });

  it('reports a link a build without the record dropped', () => {
    const dropped = built();
    dropped['allCards.json'].cards[0].images = ART;
    dropped['collection/promos.json'][0].images = PROMO_ART;
    expect(cardDataProblems({repo: repo(), built: dropped, record: null, transformCard})).toEqual([
      "allCards.json: its built entry lacks 2's image links",
    ]);
  });

  it('reports a card whose text the build lost', () => {
    const lost = built();
    delete lost['allCards.json'].cards[0].fullTextSections;
    expect(cardDataProblems({repo: repo(), built: lost, record: record(), transformCard})).toEqual([
      'allCards.json: card 1 (Ariel - Spectacular Singer) transforms otherwise once built',
    ]);
  });

  it('reports a file whose built copy holds another number of cards', () => {
    const fewer = built();
    fewer['allCards.json'].cards = [];
    expect(cardDataProblems({repo: repo(), built: fewer, record: record(), transformCard})).toEqual([
      "allCards.json: 0 built cards, 1 in the repo's copy",
    ]);
  });

  it('reports a card file missing from the build', () => {
    const missing = built();
    delete missing['collection/promos.json'];
    expect(cardDataProblems({repo: repo(), built: missing, record: record(), transformCard})).toEqual([
      'collection/promos.json: missing from the build',
    ]);
  });

  it('reports a printing that still carries its links once the build keeps a record', () => {
    const left = built();
    left['allCards.json'].cards[0].variants[0].images = PRINTING_ART;
    expect(cardDataProblems({repo: repo(), built: left, record: record(), transformCard})).toContain(
      'allCards.json: 2 still carries its image links',
    );
  });

  it("reports a link the record lacks, promos.json's included", () => {
    const partial = record();
    delete partial[3];
    expect(cardDataProblems({repo: repo(), built: built(), record: partial, transformCard})).toEqual([
      "collection/promos.json: image-sources.json lacks 3's image links",
    ]);
  });

  it("reports a record whose links differ from the repo's", () => {
    const wrong = {...record(), 1: {full: 'https://example.test/other.jpg'}};
    expect(cardDataProblems({repo: repo(), built: built(), record: wrong, transformCard})).toEqual([
      "allCards.json: image-sources.json lacks 1's image links",
    ]);
  });

  it('reports a build without the record when the deploy expects one', () => {
    const kept = built();
    kept['allCards.json'].cards[0].images = ART;
    kept['allCards.json'].cards[0].variants[0].images = PRINTING_ART;
    kept['collection/promos.json'][0].images = PROMO_ART;
    expect(cardDataProblems({repo: repo(), built: kept, record: null, transformCard, expectRecord: true})).toEqual([
      'image-sources.json: missing from the build',
    ]);
  });

  it('reports a repo with no card files, which would check nothing', () => {
    expect(cardDataProblems({repo: {}, built: {}, record: null, transformCard})).toEqual([
      "no card files in the repo's data",
    ]);
  });

  it('never transforms promos.json, whose printings carry no text of their own', () => {
    const throwing = (card) => {
      if (card.baseId !== undefined) throw new Error('transformed a promo printing');
      return transformCard(card);
    };
    expect(cardDataProblems({repo: repo(), built: built(), record: record(), transformCard: throwing})).toEqual([]);
  });
});
