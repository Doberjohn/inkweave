import {describe, it, expect} from 'vitest';
import {validateRevealCardForm} from '../validateForm';
import type {RevealCardForm} from '../buildPreviewCard';

function form(overrides: Partial<RevealCardForm> = {}): RevealCardForm {
  return {
    collectorNumber: '50',
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

describe('validateRevealCardForm', () => {
  it('passes a complete character with an image', () => {
    const r = validateRevealCardForm(form(), NO_IDS, 'mei.png');
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  it('flags a duplicate id', () => {
    const r = validateRevealCardForm(form(), new Set([13050]), 'mei.png');
    expect(r.ok).toBe(false);
    expect(r.errors.collectorNumber).toMatch(/already exists/);
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
});
