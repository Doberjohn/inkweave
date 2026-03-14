import {describe, it, expect} from 'vitest';
import {
  isDualInk,
  getInks,
  canShareDeck,
  getShiftType,
  hasAnyShift,
  getNamedReferences,
  classifyNamedEffect,
  NAMED_EFFECT_SCORES,
} from '../utils';
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

describe('named companion utilities', () => {
  describe('getNamedReferences', () => {
    it('returns empty for cards with no text', () => {
      expect(getNamedReferences(createCard({}))).toEqual([]);
    });

    it('returns empty for text without "named"', () => {
      expect(getNamedReferences(createCard({text: 'Draw a card.'}))).toEqual([]);
    });

    it('extracts a simple single-word name', () => {
      const card = createCard({
        text: 'While you have a character named Anna in play, draw a card.',
      });
      expect(getNamedReferences(card)).toEqual(['Anna']);
    });

    it('extracts multi-word names', () => {
      const card = createCard({
        text: 'If you have a character named Prince John in play, you pay 1 less.',
      });
      expect(getNamedReferences(card)).toEqual(['Prince John']);
    });

    it('extracts names with periods (Mr. Smee)', () => {
      const card = createCard({
        text: 'While you have a character named Mr. Smee in play, this character gains Resist +1.',
      });
      expect(getNamedReferences(card)).toEqual(['Mr. Smee']);
    });

    it('extracts names with lowercase articles (Queen of Hearts)', () => {
      const card = createCard({
        text: 'While you have a character named Queen of Hearts in play, draw a card.',
      });
      expect(getNamedReferences(card)).toEqual(['Queen of Hearts']);
    });

    it('extracts names with "The" prefix (The Headless Horseman)', () => {
      const card = createCard({
        text: 'Your characters named The Headless Horseman get +1 strength.',
      });
      expect(getNamedReferences(card)).toEqual(['The Headless Horseman']);
    });

    it('extracts names ending with exclamation mark', () => {
      const card = createCard({
        text: 'If you have a card named Pull the Lever! in your discard, draw a card.',
      });
      expect(getNamedReferences(card)).toEqual(['Pull the Lever!']);
    });

    it('handles "both X and Y" conjunction', () => {
      const card = createCard({
        text: 'If you have a character named both Chip and Dale in play, draw 3 cards.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Chip');
      expect(refs).toContain('Dale');
      expect(refs).toHaveLength(2);
    });

    it('handles "X or Y" conjunction', () => {
      const card = createCard({
        text: 'While you have a character named Miss Bianca or Bernard in play, gain Evasive.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Miss Bianca');
      expect(refs).toContain('Bernard');
    });

    it('handles "X and Y" conjunction without "both"', () => {
      const card = createCard({
        text: 'Whenever you quest with characters named Dewey and Louie in play, draw.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Dewey');
      expect(refs).toContain('Louie');
    });

    it('extracts multiple named references from the same card', () => {
      const card = createCard({
        text: 'If you have a card named Pull the Lever! in your discard, you may search your deck for a card named Wrong Lever! and reveal that card.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Pull the Lever!');
      expect(refs).toContain('Wrong Lever!');
      expect(refs).toHaveLength(2);
    });

    it('strips Shift parentheticals before scanning', () => {
      const card = createCard({
        text: 'Shift 5 (You may pay 5 to play this on top of one of your characters named Elsa.) ICE POWER Draw a card.',
      });
      // "named Elsa" is inside the Shift parenthetical — should be stripped
      expect(getNamedReferences(card)).toEqual([]);
    });

    it('filters out generic game terms like "card"', () => {
      const card = createCard({
        text: 'Name a card, then reveal the top card of your deck. If it is the named card, put it into your hand.',
      });
      expect(getNamedReferences(card)).toEqual([]);
    });

    it('handles comma-terminated names (named Pete, you may)', () => {
      const card = createCard({
        text: "Reveal the top card of your deck. If it's a character card named Pete, you may play it for free.",
      });
      expect(getNamedReferences(card)).toEqual(['Pete']);
    });

    it("handles possessive names (Maurice's Machine)", () => {
      const card = createCard({
        text: "If the banished item is named Maurice's Machine, you may also banish chosen character.",
      });
      expect(getNamedReferences(card)).toEqual(["Maurice's Machine"]);
    });

    it('deduplicates repeated references', () => {
      const card = createCard({
        text: 'Your characters named Elsa get +1 lore. Characters named Elsa gain Resist +1.',
      });
      expect(getNamedReferences(card)).toEqual(['Elsa']);
    });

    it('handles names with hyphens (Fix-It Felix)', () => {
      const card = createCard({
        text: 'While you have a character named Fix-It Felix in play, gain +1 lore.',
      });
      expect(getNamedReferences(card)).toEqual(['Fix-It Felix']);
    });
  });

  describe('classifyNamedEffect', () => {
    it('returns minor for cards with no text', () => {
      expect(classifyNamedEffect(createCard({}))).toBe('minor');
    });

    it('detects game-winning: free play', () => {
      const card = createCard({
        text: "If it's a character card named Pete, you may play it for free.",
      });
      expect(classifyNamedEffect(card)).toBe('game-winning');
    });

    it('detects game-winning: draw multiple cards', () => {
      const card = createCard({
        text: 'If you have characters named Dewey and Louie in play, draw 3 cards.',
      });
      expect(classifyNamedEffect(card)).toBe('game-winning');
    });

    it('detects game-winning: deck search', () => {
      const card = createCard({
        text: 'Search your deck for a card named Wrong Lever! and put it into your hand.',
      });
      expect(classifyNamedEffect(card)).toBe('game-winning');
    });

    it('detects strong: cost reduction (costs X less)', () => {
      const card = createCard({
        text: 'Characters named Elsa cost 2 less to play.',
      });
      expect(classifyNamedEffect(card)).toBe('strong');
    });

    it('detects strong: cost reduction (pay X less)', () => {
      const card = createCard({
        text: 'If you have a character named Prince John in play, you pay 1 less to play this item.',
      });
      expect(classifyNamedEffect(card)).toBe('strong');
    });

    it('detects strong: keyword grants', () => {
      const card = createCard({
        text: 'While you have a character named Elsa in play, this character gains Rush.',
      });
      expect(classifyNamedEffect(card)).toBe('strong');
    });

    it('detects moderate: stat boosts', () => {
      const card = createCard({
        text: 'Your characters named Darkwing Duck get +2 strength.',
      });
      expect(classifyNamedEffect(card)).toBe('moderate');
    });

    it('detects moderate: Resist', () => {
      const card = createCard({
        text: 'While you have a character named Mr. Smee in play, this character gains Resist +1.',
      });
      expect(classifyNamedEffect(card)).toBe('moderate');
    });

    it('detects hostile: banish near named (same clause)', () => {
      const card = createCard({
        text: 'You may banish chosen character named Elsa.',
      });
      expect(classifyNamedEffect(card)).toBe('hostile');
    });

    it('does not false-positive hostile when banish and named are far apart', () => {
      const card = createCard({
        text: 'When you play this character, you may banish chosen item of yours to draw a card. ABILITY TWO Your characters named Darkwing Duck get +1 lore.',
      });
      // "banish" and "named" are >40 chars apart — should NOT be hostile
      expect(classifyNamedEffect(card)).not.toBe('hostile');
    });

    it('returns minor for generic effects', () => {
      const card = createCard({
        text: 'While you have a character named Stitch in play, this character can quest.',
      });
      expect(classifyNamedEffect(card)).toBe('minor');
    });
  });

  describe('NAMED_EFFECT_SCORES', () => {
    it('maps tiers to correct numeric scores', () => {
      expect(NAMED_EFFECT_SCORES['game-winning']).toBe(8);
      expect(NAMED_EFFECT_SCORES.strong).toBe(7);
      expect(NAMED_EFFECT_SCORES.moderate).toBe(6);
      expect(NAMED_EFFECT_SCORES.minor).toBe(5);
      expect(NAMED_EFFECT_SCORES.hostile).toBe(4);
    });
  });
});
