import {describe, it, expect} from 'vitest';
import {canonicalizeCardLine, canonicalizeCardFullText, findGlyphWords} from '../utils';

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
});
