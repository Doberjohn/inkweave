import {describe, it, expect} from 'vitest';
import {isDualInk, getInks, canShareDeck, getShiftType, hasAnyShift} from '../utils';
import {createCard} from './fixtures.js';

describe('shift type utilities', () => {
  describe('getShiftType', () => {
    it('returns null for cards without Shift', () => {
      const card = createCard({keywords: ['Bodyguard']});
      expect(getShiftType(card)).toBeNull();
    });

    it('returns null for cards with no keywords', () => {
      const card = createCard({});
      expect(getShiftType(card)).toBeNull();
    });

    it('returns standard with cost for regular Shift', () => {
      const card = createCard({keywords: ['Shift 5']});
      expect(getShiftType(card)).toEqual({kind: 'standard', cost: 5});
    });

    it('returns classification with cost for Puppy Shift', () => {
      const card = createCard({keywords: ['Puppy Shift 3']});
      expect(getShiftType(card)).toEqual({
        kind: 'classification',
        classification: 'Puppy',
        cost: 3,
      });
    });

    it('returns universal with cost for Universal Shift', () => {
      const card = createCard({keywords: ['Universal Shift 4']});
      expect(getShiftType(card)).toEqual({kind: 'universal', cost: 4});
    });
  });

  describe('hasAnyShift', () => {
    it('returns true for any Shift variant', () => {
      expect(hasAnyShift(createCard({keywords: ['Shift 5']}))).toBe(true);
      expect(hasAnyShift(createCard({keywords: ['Puppy Shift 3']}))).toBe(true);
      expect(hasAnyShift(createCard({keywords: ['Universal Shift 4']}))).toBe(true);
    });

    it('returns false for non-Shift cards', () => {
      expect(hasAnyShift(createCard({keywords: ['Bodyguard']}))).toBe(false);
      expect(hasAnyShift(createCard({}))).toBe(false);
    });
  });
});

describe('ink compatibility utilities', () => {
  describe('isDualInk', () => {
    it('returns false for single-ink cards', () => {
      const card = createCard({ink: 'Amethyst'});
      expect(isDualInk(card)).toBe(false);
    });

    it('returns true for dual-ink cards', () => {
      const card = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      expect(isDualInk(card)).toBe(true);
    });
  });

  describe('getInks', () => {
    it('returns single ink in array for single-ink card', () => {
      const card = createCard({ink: 'Ruby'});
      expect(getInks(card)).toEqual(['Ruby']);
    });

    it('returns both inks for dual-ink card', () => {
      const card = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(getInks(card)).toEqual(['Emerald', 'Sapphire']);
    });
  });

  describe('canShareDeck', () => {
    it('two single-ink cards can always share a deck', () => {
      const amber = createCard({ink: 'Amber'});
      const steel = createCard({ink: 'Steel'});
      expect(canShareDeck(amber, steel)).toBe(true);
    });

    it('single-ink card compatible with dual-ink when its ink is in the pair', () => {
      const dual = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      const single = createCard({ink: 'Sapphire'});
      expect(canShareDeck(dual, single)).toBe(true);
      expect(canShareDeck(single, dual)).toBe(true); // order-independent
    });

    it('single-ink card incompatible with dual-ink when its ink is NOT in the pair', () => {
      const dual = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      const single = createCard({ink: 'Ruby'});
      expect(canShareDeck(dual, single)).toBe(false);
      expect(canShareDeck(single, dual)).toBe(false);
    });

    it('two dual-ink cards with same pair are compatible', () => {
      const a = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      const b = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(canShareDeck(a, b)).toBe(true);
    });

    it('two dual-ink cards with same pair in reversed order are compatible', () => {
      const a = createCard({ink: 'Sapphire', ink2: 'Emerald'});
      const b = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(canShareDeck(a, b)).toBe(true);
    });

    it('two dual-ink cards with different pairs are incompatible', () => {
      const a = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      const b = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(canShareDeck(a, b)).toBe(false);
    });
  });
});
