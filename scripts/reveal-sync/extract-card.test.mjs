import {describe, it, expect} from 'vitest';
import {parseCardLines, SiteRecordError} from './extract-card.mjs';
import {
  HARBOR_LOCATION,
  LIONHEART,
  ON_THE_OPEN_ROAD,
  TEST_CAPTAIN,
  TEST_INVENTOR,
  page,
} from './__fixtures__/cards.mjs';

const parse = (card, patch) =>
  parseCardLines(page(card, patch), {slug: card.slug, imageFile: card.imageFile});

describe('parseCardLines', () => {
  it('reads a character page into a site record', () => {
    expect(parse(LIONHEART)).toMatchObject({
      slug: 'lionheart-cleaning-up-the-city',
      name: 'Lionheart',
      version: 'Cleaning Up the City',
      type: 'Character',
      cost: 4,
      inkwell: true,
      strength: 3,
      willpower: 5,
      lore: 1,
      inks: ['Sapphire'],
      rarity: 'Uncommon',
      collector: {number: 147, total: 204},
      set: 'Hyperia City',
      keywordsField: 'Alert Heal',
      subtypes: ['Storyborn'],
      franchise: 'Zootopia',
    });
  });

  it('keeps ability lines in house style, including the glyph and the em dash', () => {
    expect(parse(LIONHEART).text).toEqual([
      'Alert (This character can challenge as if they had Evasive.)',
      'CIVIC DUTY 6 ⬡ — Remove all damage from chosen character or location.',
    ]);
  });

  it('never captures flavour text', () => {
    expect(JSON.stringify(parse(LIONHEART))).not.toContain('placeholder flavour line');
  });

  it("repairs the site's known rendering gaps", () => {
    expect(parse(TEST_INVENTOR).text[0]).toMatch(/^Shift 5 ⬡ \(/);
    expect(parse(TEST_INVENTOR).text[1]).toMatch(/pay 1 ⬡\.\)$/);
  });

  it('reads an action song with no version or stats', () => {
    expect(parse(ON_THE_OPEN_ROAD)).toMatchObject({
      type: 'Action',
      version: null,
      strength: null,
      willpower: null,
      subtypes: ['Song'],
      inkwell: false,
    });
  });

  it('reads a location, which has willpower and a move cost but no strength', () => {
    expect(parse(HARBOR_LOCATION)).toMatchObject({
      type: 'Location',
      strength: null,
      willpower: 7,
      lore: 1,
      moveCost: 1,
      subtypes: [],
    });
  });

  it('reads a dual-ink card in printed order', () => {
    expect(parse(LIONHEART, {'Ink Color': 'Amber / Amethyst'}).inks).toEqual(['Amber', 'Amethyst']);
  });

  it('reports a missing collector number and empty text as absent rather than guessing', () => {
    expect(parse(TEST_CAPTAIN)).toMatchObject({collector: null, text: [], keywordsField: 'None'});
  });

  it('throws when a label every card carries is missing: the markup changed', () => {
    expect(() => parse(LIONHEART, {'Card Text': undefined})).toThrow(SiteRecordError);
    expect(() => parse(LIONHEART, {'Card Text': undefined})).toThrow(/Card Text/);
  });

  it('throws when a label its card type requires is missing', () => {
    expect(() => parse(LIONHEART, {Strength: undefined})).toThrow(/Strength/);
  });

  it('throws on a card type it does not recognise', () => {
    expect(() => parse(LIONHEART, {'Card Type': 'Mystery'})).toThrow(/card type/);
  });
});
