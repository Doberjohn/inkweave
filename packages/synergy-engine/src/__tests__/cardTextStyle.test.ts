import {describe, it, expect} from 'vitest';
import {
  canonicalizeCardLine,
  canonicalizeCardFullText,
  findGlyphWords,
  findSpelledGlyphWords,
} from '../utils';

describe('canonicalizeCardLine', () => {
  it('writes the ink glyph in a Shift header and its reminder (Kit Cloudkicker 14192)', () => {
    expect(
      canonicalizeCardLine(
        'Shift 3 (You may pay 3 Ink to play this on top of one of your characters named Kit Cloudkicker.)',
      ),
    ).toBe(
      'Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of one of your characters named Kit Cloudkicker.)',
    );
  });

  it('writes stat glyphs for Strength and Willpower, signed or not', () => {
    expect(canonicalizeCardLine('get +1 Strength and +1 Willpower.')).toBe('get +1 ¤ and +1 ⛉.');
    expect(canonicalizeCardLine('with 2 Strength or less.')).toBe('with 2 ¤ or less.');
  });

  it('writes the lore glyph for a signed Lore, but keeps "gain N lore" a word', () => {
    expect(canonicalizeCardLine('gets +1 Lore this turn.')).toBe('gets +1 ◊ this turn.');
    expect(canonicalizeCardLine('gain 2 lore.')).toBe('gain 2 lore.');
  });

  it('keeps lowercase "ink drops", the Set 14 mechanic word', () => {
    expect(canonicalizeCardLine('get 2 ink drops.')).toBe('get 2 ink drops.');
  });

  it('writes an exert cost as the ⟳ glyph (Pirate Plane 14202)', () => {
    expect(canonicalizeCardLine('BARREL ROLL Exert, 1 ⬡ — Chosen character gains Alert this turn.')).toBe(
      'BARREL ROLL ⟳, 1 ⬡ — Chosen character gains Alert this turn.',
    );
    expect(canonicalizeCardLine('FREEZE Exert — Exert chosen opposing character.')).toBe(
      'FREEZE ⟳ — Exert chosen opposing character.',
    );
    expect(canonicalizeCardLine('LOOK Exert, 2 Ink - Draw a card.')).toBe('LOOK ⟳, 2 ⬡ — Draw a card.');
  });

  it('keeps Exert a word where it is the verb, not the cost', () => {
    for (const line of [
      'Exert chosen opposing character.',
      'ERRATIC SCREAMS ⟳, 2 ⬡ — Exert all cards in your inkwell.',
      'When you play this character, exert chosen character.',
    ]) {
      expect(canonicalizeCardLine(line)).toBe(line);
    }
  });

  it('maps near-miss glyphs and strips the invisible U+FE0F a pasted glyph carries', () => {
    const selector = String.fromCodePoint(0xfe0f);
    expect(canonicalizeCardLine('pay 2 ⬢ less')).toBe('pay 2 ⬡ less');
    expect(canonicalizeCardLine(`gets +2 ⚔${selector}.`)).toBe('gets +2 ¤.');
  });

  it('passes canonical text through unchanged', () => {
    const canonical =
      'SHOCKING BREAKTHROUGH Whenever this character quests, you pay 1 ⬡ less for the next item you play this turn.';
    expect(canonicalizeCardLine(canonical)).toBe(canonical);
  });
});

describe('canonicalizeCardFullText', () => {
  it('canonicalizes every line and keeps the blank line between abilities', () => {
    expect(canonicalizeCardFullText('Rush\r\n\r\nNIFTY TECH this character gets +1 Lore.')).toBe(
      'Rush\n\nNIFTY TECH this character gets +1 ◊.',
    );
  });
});

describe('findGlyphWords', () => {
  it('reports a capitalized glyph word no rule rewrites', () => {
    expect(findGlyphWords('Your Strength wins.')).toEqual(['Strength']);
  });

  it('ignores the words of a card name in a "named X" reference', () => {
    expect(findGlyphWords('Search your deck for an item named Ink Amplifier.')).toEqual([]);
  });

  it('reports nothing once the known shapes are rewritten', () => {
    expect(findGlyphWords('Shift 3 (You may pay 3 Ink to play this.)')).toEqual([]);
  });

  it('still reports a glyph word later in the clause than the card name', () => {
    const text = 'Search for an item named Ink Amplifier and your Strength wins.';
    expect(findGlyphWords(text)).toEqual(['Strength']);
  });
});

describe('findSpelledGlyphWords', () => {
  it('reports glyph words as written, with no rewrite first', () => {
    expect(findGlyphWords('Shift 3 Ink')).toEqual([]);
    expect(findSpelledGlyphWords('Shift 3 Ink')).toEqual(['Ink']);
  });
});
