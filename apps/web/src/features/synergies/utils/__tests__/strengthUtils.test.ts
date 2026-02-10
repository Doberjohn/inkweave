import {describe, it, expect} from 'vitest';
import {STRENGTH_ORDER, getDominantStrength} from '../strengthUtils';
import type {SynergyMatchDisplay} from '../../types';

describe('strengthUtils', () => {
  describe('STRENGTH_ORDER', () => {
    it('should define correct strength priorities', () => {
      expect(STRENGTH_ORDER.strong).toBe(3);
      expect(STRENGTH_ORDER.moderate).toBe(2);
      expect(STRENGTH_ORDER.weak).toBe(1);
    });

    it('should have strong > moderate > weak', () => {
      expect(STRENGTH_ORDER.strong).toBeGreaterThan(STRENGTH_ORDER.moderate);
      expect(STRENGTH_ORDER.moderate).toBeGreaterThan(STRENGTH_ORDER.weak);
    });
  });

  describe('getDominantStrength', () => {
    const createMockSynergy = (strength: 'weak' | 'moderate' | 'strong'): SynergyMatchDisplay =>
      ({
        card: {} as any, // Mock card - only strength matters for this test
        strength,
        explanation: 'Test explanation',
      }) as SynergyMatchDisplay;

    it('should return weak when all synergies are weak', () => {
      const synergies = [createMockSynergy('weak'), createMockSynergy('weak')];
      expect(getDominantStrength(synergies)).toBe('weak');
    });

    it('should return moderate when all synergies are moderate', () => {
      const synergies = [createMockSynergy('moderate'), createMockSynergy('moderate')];
      expect(getDominantStrength(synergies)).toBe('moderate');
    });

    it('should return strong when all synergies are strong', () => {
      const synergies = [createMockSynergy('strong'), createMockSynergy('strong')];
      expect(getDominantStrength(synergies)).toBe('strong');
    });

    it('should return strongest when synergies are mixed', () => {
      const synergies = [
        createMockSynergy('weak'),
        createMockSynergy('moderate'),
        createMockSynergy('strong'),
      ];
      expect(getDominantStrength(synergies)).toBe('strong');
    });

    it('should return moderate when weak and moderate are mixed', () => {
      const synergies = [createMockSynergy('weak'), createMockSynergy('moderate')];
      expect(getDominantStrength(synergies)).toBe('moderate');
    });

    it('should return strong when moderate and strong are mixed', () => {
      const synergies = [createMockSynergy('moderate'), createMockSynergy('strong')];
      expect(getDominantStrength(synergies)).toBe('strong');
    });

    it('should return weak for single weak synergy', () => {
      const synergies = [createMockSynergy('weak')];
      expect(getDominantStrength(synergies)).toBe('weak');
    });

    it('should return strong for single strong synergy', () => {
      const synergies = [createMockSynergy('strong')];
      expect(getDominantStrength(synergies)).toBe('strong');
    });
  });
});
