import {describe, it, expect} from 'vitest';
import {MECHANICS, MECHANIC_BY_ID, getCardMechanics} from '../utils';
import {createCard} from './fixtures.js';

describe('mechanics catalog', () => {
  describe('getCardMechanics — new gap mechanics', () => {
    it('detects lore-buff from "+1 ◊ this turn" (Sneezy - Startlingly Loud)', () => {
      const c = createCard({text: 'GESUNDHEIT When you play this character, chosen character gets +1 ◊ this turn.'});
      expect(getCardMechanics(c)).toContain('lore-buff');
    });

    it('detects stat-buff from "+2 ¤"', () => {
      const c = createCard({text: 'Chosen character gets +2 ¤ this turn.'});
      expect(getCardMechanics(c)).toContain('stat-buff');
    });

    it('detects keyword-grant from "gains Evasive"', () => {
      const c = createCard({text: 'During your turn, this character gains Evasive.'});
      expect(getCardMechanics(c)).toContain('keyword-grant');
    });

    it('keyword-grant does NOT match "gain N lore" (false-positive guard)', () => {
      const c = createCard({text: 'Each opponent loses 2 lore. You gain 2 lore.'});
      expect(getCardMechanics(c)).not.toContain('keyword-grant');
    });
  });

  describe('getCardMechanics — delegates to existing role detectors', () => {
    it('detects draw', () => {
      expect(getCardMechanics(createCard({text: 'Draw a card.'}))).toContain('draw');
    });

    it('detects lore-burn from "opponent loses lore"', () => {
      const c = createCard({text: 'When you play this character, each opponent loses 1 lore.'});
      expect(getCardMechanics(c)).toContain('lore-burn');
    });

    it('detects forced discard', () => {
      const c = createCard({text: 'Each opponent chooses and discards a card.'});
      expect(getCardMechanics(c)).toContain('discard-forced');
    });

    it('detects inkwell-ramp', () => {
      const c = createCard({text: 'Put the top card of your deck into your inkwell facedown and exerted.'});
      expect(getCardMechanics(c)).toContain('inkwell-ramp');
    });
  });

  describe('composition + ordering', () => {
    it('returns multiple mechanics in catalog order', () => {
      // Draws AND burns → draw precedes lore-burn in the catalog.
      const c = createCard({text: 'Draw a card. Each opponent loses 1 lore.'});
      expect(getCardMechanics(c)).toEqual(['draw', 'lore-burn']);
    });

    it('returns [] for a vanilla / text-less card', () => {
      expect(getCardMechanics(createCard({text: 'Bodyguard'}))).not.toContain('keyword-grant');
      expect(getCardMechanics(createCard({text: undefined}))).toEqual([]);
    });
  });

  describe('catalog integrity', () => {
    it('has unique ids and a consistent id→mechanic lookup', () => {
      const ids = MECHANICS.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(MECHANIC_BY_ID['draw'].label).toBe('Card Draw');
    });
  });
});
