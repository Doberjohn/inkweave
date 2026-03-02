import {describe, it, expect} from 'vitest';
import {getDominantScore, getStrengthTier} from '../scoreUtils';
import type {SynergyMatchDisplay} from '../../types';
import type {LorcanaCard} from 'lorcana-synergy-engine';

describe('scoreUtils', () => {
  describe('getStrengthTier', () => {
    it('should return Build-around for scores >= 9.5', () => {
      expect(getStrengthTier(9.5).label).toBe('Build-around');
      expect(getStrengthTier(10).label).toBe('Build-around');
    });

    it('should return Strong for scores 7-9.4', () => {
      expect(getStrengthTier(7).label).toBe('Strong');
      expect(getStrengthTier(9).label).toBe('Strong');
      expect(getStrengthTier(9.4).label).toBe('Strong');
    });

    it('should return Moderate for scores 4-6', () => {
      expect(getStrengthTier(4).label).toBe('Moderate');
      expect(getStrengthTier(5).label).toBe('Moderate');
      expect(getStrengthTier(6).label).toBe('Moderate');
    });

    it('should return Weak for scores < 4', () => {
      expect(getStrengthTier(1).label).toBe('Weak');
      expect(getStrengthTier(3).label).toBe('Weak');
    });

    it('should handle decimal scores from community voting', () => {
      expect(getStrengthTier(6.9).label).toBe('Moderate');
      expect(getStrengthTier(7.0).label).toBe('Strong');
      expect(getStrengthTier(3.9).label).toBe('Weak');
    });

    it('should return correct colors for each tier', () => {
      const buildAround = getStrengthTier(10);
      expect(buildAround.color).toBe('#fbbf24');
      expect(buildAround.bg).toBe('#3d3010');

      const strong = getStrengthTier(9);
      expect(strong.color).toBe('#6ee7a0');
      expect(strong.bg).toBe('#1a3d1a');

      const moderate = getStrengthTier(5);
      expect(moderate.color).toBe('#f5d560');
      expect(moderate.bg).toBe('#3d3010');

      const weak = getStrengthTier(1);
      expect(weak.color).toBe('#f59090');
      expect(weak.bg).toBe('#3d1a1a');
    });

    it('should return abbreviated shortLabels for each tier', () => {
      expect(getStrengthTier(10).shortLabel).toBe('Build');
      expect(getStrengthTier(8).shortLabel).toBe('Strong');
      expect(getStrengthTier(5).shortLabel).toBe('Mod');
      expect(getStrengthTier(2).shortLabel).toBe('Weak');
    });
  });

  describe('getDominantScore', () => {
    const createMockSynergy = (score: number): SynergyMatchDisplay =>
      ({
        card: {} as LorcanaCard,
        score,
        explanation: 'Test explanation',
      }) as SynergyMatchDisplay;

    it('should return highest score from a list', () => {
      const synergies = [createMockSynergy(3), createMockSynergy(7), createMockSynergy(5)];
      expect(getDominantScore(synergies)).toBe(7);
    });

    it('should return the score for a single synergy', () => {
      expect(getDominantScore([createMockSynergy(5)])).toBe(5);
    });

    it('should return highest when all scores are the same', () => {
      const synergies = [createMockSynergy(7), createMockSynergy(7)];
      expect(getDominantScore(synergies)).toBe(7);
    });
  });
});
