import {describe, it, expect} from 'vitest';
import {buildPreviewCard, parseKeyword, type RevealCardForm} from '../buildPreviewCard';
import {REVEAL_ID_BASE, REVEAL_SET_CODE} from '../../../shared/constants';

function form(overrides: Partial<RevealCardForm> = {}): RevealCardForm {
  return {
    collectorNumber: '50',
    name: 'Mei',
    version: 'Red Panda',
    rarity: 'Rare',
    franchise: 'Turning Red',
    cost: '4',
    ink: 'Ruby',
    ink2: '',
    inkwell: true,
    type: 'Character',
    strength: '3',
    willpower: '5',
    lore: '2',
    moveCost: '',
    subtypes: 'Hero, Red Panda',
    keywords: 'Singer 5\nResist +1',
    fullText: 'PANDA POWER When you play this character, draw a card.',
    ...overrides,
  };
}

describe('parseKeyword', () => {
  it('splits a trailing numeric value', () => {
    expect(parseKeyword('Singer 5')).toEqual({keyword: 'Singer', keywordValue: '5'});
  });
  it('keeps multi-word keyword names', () => {
    expect(parseKeyword('Sing Together 7')).toEqual({keyword: 'Sing Together', keywordValue: '7'});
  });
  it('handles signed values', () => {
    expect(parseKeyword('Resist +1')).toEqual({keyword: 'Resist', keywordValue: '+1'});
  });
  it('returns no value for bare keywords', () => {
    expect(parseKeyword('Evasive')).toEqual({keyword: 'Evasive'});
  });
});

describe('buildPreviewCard', () => {
  it('derives id, fullName, color, sections and keyword abilities', () => {
    const card = buildPreviewCard(form());
    expect(card.id).toBe(REVEAL_ID_BASE + 50);
    expect(card.number).toBe(50);
    expect(card.setCode).toBe(REVEAL_SET_CODE);
    expect(card.fullName).toBe('Mei - Red Panda');
    expect(card.color).toBe('Ruby');
    expect(card.subtypes).toEqual(['Hero', 'Red Panda']);
    expect(card.fullTextSections).toEqual(['PANDA POWER When you play this character, draw a card.']);
    expect(card.abilities).toEqual([
      {type: 'keyword', keyword: 'Singer', keywordValue: '5', fullText: 'Singer 5'},
      {type: 'keyword', keyword: 'Resist', keywordValue: '+1', fullText: 'Resist +1'},
    ]);
    expect(card.strength).toBe(3);
    expect(card.willpower).toBe(5);
    expect(card.lore).toBe(2);
  });

  it('joins dual ink and omits version from fullName when blank', () => {
    const card = buildPreviewCard(form({version: '', ink: 'Amethyst', ink2: 'Sapphire'}));
    expect(card.color).toBe('Amethyst-Sapphire');
    expect(card.fullName).toBe('Mei');
    expect(card.version).toBeUndefined();
  });

  it('omits stat/text fields when blank (vanilla / non-character)', () => {
    const card = buildPreviewCard(
      form({type: 'Item', strength: '', willpower: '', lore: '', keywords: '', fullText: '', subtypes: ''}),
    );
    expect(card.strength).toBeUndefined();
    expect(card.abilities).toBeUndefined();
    expect(card.fullText).toBeUndefined();
    expect(card.fullTextSections).toBeUndefined();
    expect(card.subtypes).toBeUndefined();
  });

  it('normalizes CRLF in fullText before splitting into sections', () => {
    const card = buildPreviewCard(form({fullText: 'LINE ONE\r\nLINE TWO'}));
    expect(card.fullTextSections).toEqual(['LINE ONE', 'LINE TWO']);
  });

  // Kit Cloudkicker - Sure Shot (14192) as it was typed in; the engine reads glyphs only (#635).
  it('writes card text in house style, glyphs for the words', () => {
    const card = buildPreviewCard(
      form({
        fullText:
          'Shift 3 (You may pay 3 Ink to play this on top of one of your characters named Kit Cloudkicker.)',
      }),
    );
    const canonical =
      'Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of one of your characters named Kit Cloudkicker.)';
    expect(card.fullText).toBe(canonical);
    expect(card.fullTextSections).toEqual([canonical]);
  });
});
