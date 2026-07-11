import {describe, it, expect} from 'vitest';
import {analyzeDeck} from './analyzeDeck';
import type {Deck, LorcanaCard} from '../types';
import type {HoserEntry} from './vulnerabilities';
import type {PairScore} from './deckSynergy';
import {createCard} from '../../../shared/test-utils';

function resolver(cards: LorcanaCard[]) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (id: string) => byId.get(id);
}

function deckOf(cards: LorcanaCard[], qty = 4): Deck {
  return {
    id: 'd',
    name: 'Test',
    cards: cards.map((c) => ({cardId: c.id, quantity: qty})),
    inks: [],
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
  };
}

const lowStrengthHoser: HoserEntry[] = [
  {
    cardId: 'hoser-1',
    name: 'Low Sweeper',
    ink: 'Sapphire',
    condition: {type: 'low-strength', threshold: 2},
    scope: 'mass',
    text: 'Banish all opposing characters with 2 strength or less.',
  },
];

const noSynergy: PairScore = () => 0;

describe('analyzeDeck (advisor orchestrator)', () => {
  it('composes stats, archetype, analyzers, synergy density and a quality score', () => {
    const cards = Array.from({length: 15}, (_, i) =>
      createCard({
        id: `c${i}`,
        fullName: `Card ${i}`,
        ink: 'Amber',
        cost: (i % 4) + 1,
        strength: 3,
        willpower: 3,
        lore: 2,
        type: 'Character',
        inkwell: true,
      }),
    );
    const analysis = analyzeDeck(deckOf(cards), resolver(cards), {getPairScore: noSynergy, hosers: []});

    expect(analysis.stats.totalCards).toBe(60);
    // 10 composition analyzers + the synergy-density indicator
    expect(analysis.health.analyzers).toHaveLength(11);
    expect(analysis.health.analyzers.map((a) => a.id)).toContain('synergyDensity');
    expect(analysis.quality.score).toBeGreaterThanOrEqual(0);
    expect(analysis.quality.score).toBeLessThanOrEqual(100);
    // overall health is the quality score (single source of truth for the UI)
    expect(analysis.health.overall).toBe(analysis.quality.score);
  });

  it('lets a declared gameplan override the auto-detected archetype', () => {
    const cards = Array.from({length: 15}, (_, i) =>
      createCard({id: `g${i}`, fullName: `G ${i}`, ink: 'Amethyst', cost: 2, strength: 3, willpower: 3, type: 'Character', inkwell: true}),
    );
    const analysis = analyzeDeck(deckOf(cards), resolver(cards), {
      getPairScore: noSynergy,
      hosers: [],
      gameplan: 'control',
    });

    expect(analysis.health.archetype).toBe('control');
    expect(analysis.health.archetypeConfidence).toBe(1);
  });

  it('surfaces a low-strength vulnerability from the hoser catalog', () => {
    const fragile = Array.from({length: 15}, (_, i) =>
      createCard({id: `f${i}`, fullName: `F ${i}`, ink: 'Amber', cost: 2, strength: 1, willpower: 2, type: 'Character', inkwell: true}),
    );
    const analysis = analyzeDeck(deckOf(fragile), resolver(fragile), {getPairScore: noSynergy, hosers: lowStrengthHoser});

    const lowStrength = analysis.health.vulnerabilities.find((v) => v.conditionType === 'low-strength');
    expect(lowStrength).toBeDefined();
    expect(lowStrength?.severity).toBe('high');
  });
});
