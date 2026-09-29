import {describe, it, expect} from 'vitest';
import {validateRevealCardForm} from '../validateForm';
import type {RevealCardForm} from '../buildPreviewCard';
import {REVEAL_ID_BASE, SET_TOTAL, inkBlock} from '../../../shared/constants';

// Taken from the season's constants so these fixtures stay valid every season.
const RUBY_NUMBER = inkBlock('Ruby').first;

function form(overrides: Partial<RevealCardForm> = {}): RevealCardForm {
  return {
    collectorNumber: String(RUBY_NUMBER),
    name: 'Mei',
    version: 'Red Panda',
    rarity: 'Rare',
    franchise: '',
    cost: '4',
    ink: 'Ruby',
    ink2: '',
    inkwell: true,
    type: 'Character',
    strength: '3',
    willpower: '5',
    lore: '2',
    moveCost: '',
    subtypes: '',
    keywords: '',
    fullText: '',
    ...overrides,
  };
}

const NO_IDS = new Set<number>();

/** The Card Text error for this text, on an otherwise valid form. */
function fullTextError(fullText: string): string | undefined {
  return validateRevealCardForm(form({fullText}), NO_IDS, 'mei.png').errors.fullText;
}

describe('validateRevealCardForm', () => {
  it('passes a complete character with an image', () => {
    const r = validateRevealCardForm(form(), NO_IDS, 'mei.png');
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  it('flags a duplicate id', () => {
    const r = validateRevealCardForm(form(), new Set([REVEAL_ID_BASE + RUBY_NUMBER]), 'mei.png');
    expect(r.ok).toBe(false);
    expect(r.errors.collectorNumber).toMatch(/already exists/);
  });

  // A set is numbered ink by ink, so the number implies the ink. Both wrong-ink
  // publishes last season were the form's default ink left unchanged.
  it('rejects an ink that does not own the collector number, naming the one that does', () => {
    const r = validateRevealCardForm(form({ink: 'Amber'}), NO_IDS, 'mei.png');
    expect(r.ok).toBe(false);
    expect(r.errors.ink).toMatch(/Ruby block/);
  });

  it('checks a dual-ink card against its first ink only', () => {
    expect(validateRevealCardForm(form({ink2: 'Sapphire'}), NO_IDS, 'mei.png').ok).toBe(true);
    expect(validateRevealCardForm(form({ink: 'Sapphire', ink2: 'Ruby'}), NO_IDS, 'mei.png').errors.ink).toBeDefined();
  });

  it('skips the ink check past the numbered set (promos, enchanteds)', () => {
    const r = validateRevealCardForm(form({ink: 'Amber', collectorNumber: String(SET_TOTAL + 5)}), NO_IDS, 'mei.png');
    expect(r.ok).toBe(true);
  });

  it('requires a positive collector number', () => {
    const r = validateRevealCardForm(form({collectorNumber: '0'}), NO_IDS, 'mei.png');
    expect(r.errors.collectorNumber).toBeDefined();
  });

  it('requires strength/willpower/lore for characters but not for items', () => {
    const char = validateRevealCardForm(form({strength: '', willpower: '', lore: ''}), NO_IDS, 'x.png');
    expect(char.errors.strength).toBeDefined();
    const item = validateRevealCardForm(
      form({type: 'Item', strength: '', willpower: '', lore: ''}),
      NO_IDS,
      'x.png',
    );
    expect(item.errors.strength).toBeUndefined();
    expect(item.ok).toBe(true);
  });

  it('requires an image with a valid extension', () => {
    expect(validateRevealCardForm(form(), NO_IDS, null).errors.image).toBeDefined();
    expect(validateRevealCardForm(form(), NO_IDS, 'mei.gif').errors.image).toBeDefined();
  });

  it('rejects a second ink equal to the first', () => {
    const r = validateRevealCardForm(form({ink2: 'Ruby'}), NO_IDS, 'mei.png');
    expect(r.errors.ink2).toBeDefined();
  });

  // House style (#635): a word the build cannot turn into a glyph must not reach the data.
  it('refuses a capitalized glyph word house style cannot place, naming it', () => {
    const r = validateRevealCardForm(form({fullText: 'Your Strength wins.'}), NO_IDS, 'mei.png');
    expect(r.ok).toBe(false);
    expect(r.errors.fullText).toMatch(/"Strength"/);
  });

  it('accepts glyph words the build rewrites, such as "pay 1 Ink less"', () => {
    expect(fullTextError('you pay 1 Ink less for the next item.')).toBeUndefined();
  });

  it('accepts a card name that holds a glyph word', () => {
    expect(fullTextError('Play an item named Ink Amplifier.')).toBeUndefined();
  });

  // "gain 2 ◊" would pass every check and read as no lore gain; released text says "gain 2 lore".
  it('points a capitalized gained Lore to the lowercase word, not the glyph', () => {
    expect(fullTextError('Gain 2 Lore.')).toMatch(/"gain 2 lore"/);
  });
});
