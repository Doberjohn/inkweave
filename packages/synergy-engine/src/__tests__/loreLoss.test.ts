import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';

describe('Lore Loss', () => {
  const loreLossRule = getRuleById('lore-loss')!;

  // Steal: opponent loses lore AND you gain lore (matches LORE_STEAL_PATTERNS)
  const thievery = createCard({
    id: 'thievery',
    name: 'Thievery',
    type: 'Action',
    ink: 'Ruby',
    cost: 1,
    text: 'Chosen opponent loses 1 lore. Gain 1 lore.',
  });

  const lorePirate = createCard({
    id: 'lore-pirate',
    name: 'Lore Pirate',
    type: 'Character',
    ink: 'Amethyst',
    cost: 4,
    text: 'When you play this character, chosen opponent loses 2 lore and you gain 2 lore.',
  });

  // Burn: opponent loses lore only, no transfer
  const jasmine = createCard({
    id: 'jasmine-rebellious',
    name: 'Jasmine',
    ink: 'Ruby',
    cost: 3,
    text: 'Whenever this character quests, each opponent loses 1 lore.',
  });

  const flotilla = createCard({
    id: 'flotilla',
    name: 'Flotilla',
    type: 'Location',
    ink: 'Ruby',
    cost: 2,
    text: 'At the start of your turn, if you have a character here, all opponents lose 1 lore.',
  });

  const unrelatedCard = createCard({id: 'anna-1', name: 'Anna', cost: 3, text: 'Draw a card.'});

  it('should match cards with lore loss text', () => {
    expect(loreLossRule.matches(thievery)).toBe(true);
    expect(loreLossRule.matches(jasmine)).toBe(true);
    expect(loreLossRule.matches(flotilla)).toBe(true);
  });

  it('should not match cards without lore loss text', () => {
    expect(loreLossRule.matches(unrelatedCard)).toBe(false);
    expect(loreLossRule.matches(createCard({}))).toBe(false);
  });

  it('should match lore loss without numeric amount', () => {
    const card = createCard({
      text: 'Each opponent loses lore equal to the damage on chosen character.',
    });
    expect(loreLossRule.matches(card)).toBe(true);
  });

  it('burn ↔ burn pair scores 5 (parallel pressure, no compounding)', () => {
    const synergies = loreLossRule.findSynergies(jasmine, [jasmine, flotilla, unrelatedCard]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].score).toBe(5);
    expect(synergies[0].card.id).toBe('flotilla');
  });

  it('burn ↔ steal pair scores 6 (complementary pressure + race-close)', () => {
    const synergies = loreLossRule.findSynergies(thievery, [thievery, jasmine, flotilla]);
    expect(synergies).toHaveLength(2);
    expect(synergies.every((s) => s.score === 6)).toBe(true);
  });

  it('steal ↔ steal pair scores 7 (double swing engine)', () => {
    const synergies = loreLossRule.findSynergies(thievery, [thievery, lorePirate]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].score).toBe(7);
    expect(synergies[0].card.id).toBe('lore-pirate');
  });

  it('should not include the selected card itself', () => {
    const synergies = loreLossRule.findSynergies(thievery, [thievery, jasmine]);
    expect(synergies.find((s) => s.card.id === 'thievery')).toBeUndefined();
  });

  it('should mark synergies as bidirectional', () => {
    const synergies = loreLossRule.findSynergies(thievery, [thievery, jasmine]);
    expect(synergies[0].bidirectional).toBe(true);
  });
});
