import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it, expect} from 'vitest';
import {
  baseType,
  canonicalizeLine,
  comparableName,
  comparableText,
  deriveKeywords,
  parseCollector,
  parseInks,
  parseSubtypes,
  readClassifications,
  fullName,
  toInt,
} from './text.mjs';

const DATA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../apps/web/public/data',
);
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const realCards = () => {
  const all = readJson('allCards.json');
  return [...(Array.isArray(all) ? all : all.cards), ...readJson('previewCards.json').cards];
};

describe('canonicalizeLine', () => {
  it('restores the ink glyph lorcanaplayer drops from a Shift header', () => {
    expect(
      canonicalizeLine(
        'Shift 5 (You may pay 5 ⬡ to play this on top of one of your characters named Test Inventor.)',
      ),
    ).toBe(
      'Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your characters named Test Inventor.)',
    );
  });

  it('turns the spaced en dash of an activated ability into the em dash the data uses', () => {
    expect(
      canonicalizeLine('CIVIC DUTY 6 ⬡ – Remove all damage from chosen character or location.'),
    ).toBe('CIVIC DUTY 6 ⬡ — Remove all damage from chosen character or location.');
  });

  it('closes the gap an inlined glyph leaves before punctuation', () => {
    expect(canonicalizeLine('this character gets +1 ◊ .')).toBe('this character gets +1 ◊.');
    expect(canonicalizeLine('SPEAK! ⟳ , 4 ⬡ — Draw a card.')).toBe('SPEAK! ⟳, 4 ⬡ — Draw a card.');
  });

  it("maps a vision reader's near-miss glyphs to the data's glyphs", () => {
    expect(canonicalizeLine('gets +1 ◆.')).toBe('gets +1 ◊.');
    expect(canonicalizeLine('gets +1 ◇.')).toBe('gets +1 ◊.');
  });

  it('leaves every line of the shipped card data unchanged (house style is a fixed point)', () => {
    const changed = realCards()
      .flatMap((c) => (c.fullText ?? '').split('\n'))
      .filter((line) => canonicalizeLine(line) !== line.trim());
    expect(changed).toEqual([]);
  });
});

describe('comparable keys', () => {
  it('treats glyph variants, dashes and spacing artifacts as the same text', () => {
    const site = [
      'TOP THE CHARTS While an opponent has a song card in their discard, this character gets +1 ◊ .',
    ];
    const reader = [
      'TOP THE CHARTS While an opponent has a song card in their discard, this character gets +1 ◆.',
    ];
    expect(comparableText(site)).toBe(comparableText(reader));
  });

  it('tolerates the same text split across different lines', () => {
    expect(comparableText(['Alert (reminder.)', 'CIVIC DUTY text.'])).toBe(
      comparableText(['Alert (reminder.) CIVIC DUTY text.']),
    );
  });

  it('still tells genuinely different text apart', () => {
    expect(comparableText(['gets +1 ◊.'])).not.toBe(comparableText(['gets +2 ◊.']));
  });

  it('compares names without accents, case or curly apostrophes', () => {
    expect(comparableName('Héctor Rivera')).toBe(comparableName('HECTOR RIVERA'));
    expect(comparableName('Imelda’s Right Hand')).toBe(comparableName("Imelda's Right Hand"));
    expect(comparableName('Super Capable')).not.toBe(comparableName('Exceptionally Capable'));
  });
});

describe('deriveKeywords', () => {
  it('reads keywords and their values from ability lines, ignoring named abilities', () => {
    expect(
      deriveKeywords([
        'Singer 5 (This character counts as cost 5 to sing songs.)',
        'TOP THE CHARTS While an opponent has a song card in their discard, this character gets +1 ◊.',
        'Alert (This character can challenge as if they had Evasive.)',
        'Resist +1 (Damage dealt to this character is reduced by 1.)',
        'Temporary Red Panda Shift 3 ⬡ (reminder.)',
      ]),
    ).toEqual(['Singer 5', 'Alert', 'Resist +1', 'Temporary Red Panda Shift 3']);
  });

  it('does not mistake an action effect for a keyword', () => {
    expect(
      deriveKeywords(['Chosen opponent reveals their hand and discards all non-character cards.']),
    ).toEqual([]);
  });

  it("reproduces every real card's keyword abilities from its ability text", () => {
    const mismatches = realCards()
      .filter((c) => c.abilities?.length)
      .filter((c) => {
        const derived = deriveKeywords(
          c.abilities.map((a) => (a.fullText ?? '').replace(/\n/g, ' ')),
        );
        const expected = c.abilities
          .filter((a) => a.type === 'keyword')
          .map((a) => (a.keywordValue ? `${a.keyword} ${a.keywordValue}` : a.keyword));
        return JSON.stringify(derived) !== JSON.stringify(expected);
      })
      .map((c) => c.fullName);
    expect(mismatches).toEqual([]);
  });
});

describe('field parsers', () => {
  it('reads inks in printed order from any separator', () => {
    expect(parseInks('Amber / Amethyst')).toEqual(['Amber', 'Amethyst']);
    expect(parseInks('Amber-Amethyst')).toEqual(['Amber', 'Amethyst']);
    expect(parseInks(['Ruby'])).toEqual(['Ruby']);
    expect(parseInks('')).toEqual([]);
  });

  it('reduces a card type line to its base type', () => {
    expect(baseType('Action • Song')).toBe('Action');
    expect(baseType('Location')).toBe('Location');
    expect(baseType('Mystery')).toBeNull();
  });

  it('drops the card type and unreadable placeholders from the classification line', () => {
    expect(parseSubtypes('Action • Song')).toEqual(['Song']);
    expect(parseSubtypes('Dreamborn • Super • Hero • [4th term illegible]')).toEqual([
      'Dreamborn',
      'Super',
      'Hero',
    ]);
    expect(parseSubtypes(['Dreamborn', 'Hero', 'Princess'])).toEqual([
      'Dreamborn',
      'Hero',
      'Princess',
    ]);
  });

  it('parses collector numbers and rejects a missing one', () => {
    expect(parseCollector('118/204')).toEqual({number: 118, total: 204});
    expect(parseCollector('118')).toEqual({number: 118, total: null});
    expect(parseCollector('HC')).toBeNull();
    expect(parseCollector(null)).toBeNull();
  });

  it('accepts integers from numbers or strings only', () => {
    expect(toInt('4')).toBe(4);
    expect(toInt(4)).toBe(4);
    expect(toInt('Unknown')).toBeNull();
    expect(toInt(null)).toBeNull();
  });
});

describe('readClassifications', () => {
  it('treats a missing line as no reading at all, which is not the same as an empty line', () => {
    expect(readClassifications(null)).toEqual({terms: null, partial: false});
    expect(readClassifications(undefined)).toEqual({terms: null, partial: false});
    expect(readClassifications('')).toEqual({terms: [], partial: false});
  });

  it('marks a line with an unreadable term as partial', () => {
    expect(readClassifications('Dreamborn • Super • Hero • [4th term illegible]')).toEqual({
      terms: ['Dreamborn', 'Super', 'Hero'],
      partial: true,
    });
    expect(readClassifications(['Storyborn', 'Villain'])).toEqual({
      terms: ['Storyborn', 'Villain'],
      partial: false,
    });
  });
});

describe('fullName', () => {
  it('joins a name and version the way the data does, or keeps a versionless name', () => {
    expect(fullName('Lionheart', 'Cleaning Up the City')).toBe('Lionheart - Cleaning Up the City');
    expect(fullName('On the Open Road', null)).toBe('On the Open Road');
  });
});
