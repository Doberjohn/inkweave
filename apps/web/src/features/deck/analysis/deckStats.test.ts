import {describe, it, expect} from 'vitest';
import {calculateDeckStats} from './deckStats';
import type {Deck, LorcanaCard} from '../types';
import {createCard} from '../../../shared/test-utils';

/** Resolve deck cardIds from a fixed card list; unknown ids return undefined. */
function makeResolver(cards: LorcanaCard[]) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (id: string) => byId.get(id);
}

/** Assemble a minimal Deck from [card, quantity] entries. */
function makeDeck(entries: Array<[LorcanaCard, number]>): Deck {
  return {
    id: 'deck-1',
    name: 'Test Deck',
    cards: entries.map(([card, quantity]) => ({cardId: card.id, quantity})),
    inks: [],
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
  };
}

/** N distinct cards sharing the given overrides (unique id + fullName per index). */
function genCards(n: number, prefix: string, over: Partial<LorcanaCard>): LorcanaCard[] {
  return Array.from({length: n}, (_, i) =>
    createCard({id: `${prefix}-${i}`, fullName: `${prefix} ${i}`, ...over}),
  );
}

describe('calculateDeckStats', () => {
  it('counts a legal 60-card, two-ink deck (totals, inkable, legality)', () => {
    // 8 inkable Amber + 7 uninkable Steel, 4 copies each = 60 cards, 15 unique.
    const amber = genCards(8, 'amber', {ink: 'Amber', inkwell: true});
    const steel = genCards(7, 'steel', {ink: 'Steel', inkwell: false});
    const cards = [...amber, ...steel];
    const deck = makeDeck(cards.map((c) => [c, 4] as [LorcanaCard, number]));

    const stats = calculateDeckStats(deck, makeResolver(cards));

    expect(stats.totalCards).toBe(60);
    expect(stats.uniqueCards).toBe(15);
    expect(stats.inkCount).toBe(2);
    expect(stats.inkableCount).toBe(32); // only the 8 Amber cards x 4
    expect(stats.isLegal).toBe(true);
    expect(stats.legalityErrors).toEqual([]);
  });

  it('buckets costs >= 7 under key 7 and sums the rest', () => {
    const c2 = createCard({id: 'c2', fullName: 'Cost Two', cost: 2});
    const c7 = createCard({id: 'c7', fullName: 'Cost Seven', cost: 7});
    const c9 = createCard({id: 'c9', fullName: 'Cost Nine', cost: 9});
    const deck = makeDeck([
      [c2, 3],
      [c7, 1],
      [c9, 2],
    ]);

    const stats = calculateDeckStats(deck, makeResolver([c2, c7, c9]));

    expect(stats.costCurve).toEqual({2: 3, 7: 3}); // 7 (x1) + 9 (x2) both bucket at 7
  });

  it('builds ink and type distributions', () => {
    const hero = createCard({id: 'h', fullName: 'Hero', ink: 'Amber', type: 'Character'});
    const spell = createCard({id: 's', fullName: 'Spell', ink: 'Amber', type: 'Action'});
    const deck = makeDeck([
      [hero, 4],
      [spell, 2],
    ]);

    const stats = calculateDeckStats(deck, makeResolver([hero, spell]));

    expect(stats.inkDistribution).toEqual({Amber: 6});
    expect(stats.typeDistribution).toEqual({Character: 4, Action: 2});
  });

  it('breaks the cost curve down by ink, counting a dual-ink card toward both', () => {
    const amber2 = createCard({id: 'a2', fullName: 'Amber Two', cost: 2, ink: 'Amber'});
    const emerald2 = createCard({id: 'e2', fullName: 'Emerald Two', cost: 2, ink: 'Emerald'});
    const dual3 = createCard({id: 'd3', fullName: 'Dual Three', cost: 3, ink: 'Amber', ink2: 'Emerald'});
    const deck = makeDeck([
      [amber2, 3],
      [emerald2, 2],
      [dual3, 1],
    ]);

    const stats = calculateDeckStats(deck, makeResolver([amber2, emerald2, dual3]));

    // Cost 2 splits 3 Amber / 2 Emerald; the cost-3 dual card lands in BOTH inks.
    expect(stats.costCurveByInk).toEqual({
      2: {Amber: 3, Emerald: 2},
      3: {Amber: 1, Emerald: 1},
    });
  });

  it('counts a dual-ink card toward both inks while keeping the deck legal at 2 inks', () => {
    const amber = genCards(8, 'amber', {ink: 'Amber'}); // 32
    const steel = genCards(6, 'steel', {ink: 'Steel'}); // 24
    const dual = createCard({id: 'dual', fullName: 'Dual One', ink: 'Amber', ink2: 'Steel'}); // 4
    const cards = [...amber, ...steel, dual];
    const deck = makeDeck(cards.map((c) => [c, 4] as [LorcanaCard, number])); // 60 total

    const stats = calculateDeckStats(deck, makeResolver(cards));

    expect(stats.inkCount).toBe(2); // union stays {Amber, Steel}
    expect(stats.isLegal).toBe(true);
    // dual card's 4 copies land in BOTH inks, so the columns overcount vs totalCards.
    expect(stats.inkDistribution.Amber).toBe(36); // 8*4 + dual 4
    expect(stats.inkDistribution.Steel).toBe(28); // 6*4 + dual 4
  });

  it('flags a deck under 60 cards', () => {
    const cards = genCards(15, 'x', {ink: 'Amber'});
    // 14 cards x4 (56) + 1 card x2 = 58; only the size rule fails.
    const deck = makeDeck(cards.map((c, i) => [c, i < 14 ? 4 : 2] as [LorcanaCard, number]));

    const stats = calculateDeckStats(deck, makeResolver(cards));

    expect(stats.totalCards).toBe(58);
    expect(stats.isLegal).toBe(false);
    expect(stats.legalityErrors).toEqual(['Deck has 58 cards (minimum 60)']);
  });

  it('flags a 5th copy of a single card', () => {
    const cards = genCards(15, 'y', {ink: 'Amber'});
    // 13 x4 (52) + 1 x3 (55) + 1 x5 (60): total is legal, only the copy rule fails.
    const quantities = [...Array(13).fill(4), 3, 5];
    const deck = makeDeck(cards.map((c, i) => [c, quantities[i]] as [LorcanaCard, number]));

    const stats = calculateDeckStats(deck, makeResolver(cards));

    expect(stats.totalCards).toBe(60);
    expect(stats.isLegal).toBe(false);
    expect(stats.legalityErrors).toEqual(['5 copies of y 14 (max 4)']);
  });

  it('flags a 3rd ink with canonical ink ordering', () => {
    const amber = genCards(5, 'a', {ink: 'Amber'});
    const ruby = genCards(5, 'r', {ink: 'Ruby'});
    const steel = genCards(5, 's', {ink: 'Steel'});
    const cards = [...amber, ...ruby, ...steel];
    const deck = makeDeck(cards.map((c) => [c, 4] as [LorcanaCard, number])); // 60, 3 inks

    const stats = calculateDeckStats(deck, makeResolver(cards));

    expect(stats.inkCount).toBe(3);
    expect(stats.isLegal).toBe(false);
    expect(stats.legalityErrors).toEqual(['3 inks: Amber, Ruby, Steel (max 2)']);
  });

  it('skips unresolvable cardIds but keeps them in totals and notes them', () => {
    const known = createCard({id: 'known', fullName: 'Known', ink: 'Amber'});
    const deck: Deck = {
      ...makeDeck([[known, 4]]),
      cards: [
        {cardId: 'known', quantity: 4},
        {cardId: 'ghost', quantity: 2}, // rotated out — resolver returns undefined
      ],
    };

    const stats = calculateDeckStats(deck, makeResolver([known]));

    expect(stats.totalCards).toBe(6); // unresolved copies still count
    expect(stats.uniqueCards).toBe(2);
    expect(stats.inkDistribution).toEqual({Amber: 4}); // ghost contributes nothing
    expect(stats.warnings).toContain('1 unresolved card skipped (rotated out of Core?)');
    expect(stats.legalityErrors).not.toContain('1 unresolved card skipped (rotated out of Core?)');
  });
});
