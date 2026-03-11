import {describe, it, expect} from 'vitest';
import {applySynergySortOrder} from '../sortSynergies';
import type {SynergyMatchDisplay} from '../../types';
import {createCard} from '../../../../shared/test-utils';

function createSynergy(
  overrides: Partial<SynergyMatchDisplay> & {card?: Partial<SynergyMatchDisplay['card']>},
): SynergyMatchDisplay {
  return {
    card: createCard(overrides.card),
    score: overrides.score ?? 5,
    explanation: overrides.explanation ?? 'test',
  };
}

describe('applySynergySortOrder', () => {
  const synergies: SynergyMatchDisplay[] = [
    createSynergy({card: {ink: 'Sapphire', cost: 3, fullName: 'Zephyr'}, score: 8}),
    createSynergy({card: {ink: 'Amber', cost: 5, fullName: 'Alpha'}, score: 3}),
    createSynergy({card: {ink: 'Amber', cost: 2, fullName: 'Beta'}, score: 6}),
    createSynergy({card: {ink: 'Emerald', cost: 4, fullName: 'Gamma'}, score: 10}),
  ];

  it('should sort by ink then cost for ink-cost order', () => {
    const sorted = applySynergySortOrder(synergies, 'ink-cost');
    expect(sorted.map((s) => s.card.ink)).toEqual(['Amber', 'Amber', 'Emerald', 'Sapphire']);
    // Within Amber, lower cost first
    expect(sorted[0].card.cost).toBe(2);
    expect(sorted[1].card.cost).toBe(5);
  });

  it('should sort by cost ascending', () => {
    const sorted = applySynergySortOrder(synergies, 'cost-asc');
    expect(sorted.map((s) => s.card.cost)).toEqual([2, 3, 4, 5]);
  });

  it('should sort by cost descending', () => {
    const sorted = applySynergySortOrder(synergies, 'cost-desc');
    expect(sorted.map((s) => s.card.cost)).toEqual([5, 4, 3, 2]);
  });

  it('should sort by score descending', () => {
    const sorted = applySynergySortOrder(synergies, 'strength-desc');
    expect(sorted.map((s) => s.score)).toEqual([10, 8, 6, 3]);
  });

  it('should sort by score ascending', () => {
    const sorted = applySynergySortOrder(synergies, 'strength-asc');
    expect(sorted.map((s) => s.score)).toEqual([3, 6, 8, 10]);
  });

  it('should sort by name A-Z', () => {
    const sorted = applySynergySortOrder(synergies, 'name-asc');
    expect(sorted.map((s) => s.card.fullName)).toEqual(['Alpha', 'Beta', 'Gamma', 'Zephyr']);
  });

  it('should sort by name Z-A', () => {
    const sorted = applySynergySortOrder(synergies, 'name-desc');
    expect(sorted.map((s) => s.card.fullName)).toEqual(['Zephyr', 'Gamma', 'Beta', 'Alpha']);
  });

  it('should not mutate the input array', () => {
    const original = [...synergies];
    applySynergySortOrder(synergies, 'cost-asc');
    expect(synergies).toEqual(original);
  });
});
