import {describe, it, expect} from 'vitest';
import type {LorcanaCard, SynergyGroup} from 'inkweave-synergy-engine';
import {cardSynergySummary} from '../cardSynergySummary';

const card = (id: string, fullName: string) => ({id, fullName}) as LorcanaCard;
const match = (id: string, fullName: string, score: number) => ({
  card: card(id, fullName),
  score,
  explanation: '',
});
const group = (
  label: string,
  category: 'direct' | 'playstyle',
  matches: ReturnType<typeof match>[],
): SynergyGroup =>
  ({groupKey: label, category, label, tagline: '', description: '', synergies: matches}) as SynergyGroup;

const subject = card('1', 'Elsa - Spirit of Winter');

describe('cardSynergySummary', () => {
  it('returns empty for a card with no synergy groups', () => {
    expect(cardSynergySummary(subject, [])).toBe('');
  });

  it('names the card, the unique partner count, and the highest-scoring pairing', () => {
    const s = cardSynergySummary(subject, [
      group('Ramp', 'playstyle', [match('2', 'Maui', 7), match('3', 'Moana', 9)]),
    ]);
    expect(s).toContain('Elsa - Spirit of Winter');
    expect(s).toContain('2 cards');
    expect(s).toContain('anchored by Moana (9/10)');
  });

  it('dedupes a partner that appears in more than one group', () => {
    const shared = match('2', 'Maui', 8);
    const s = cardSynergySummary(subject, [
      group('Ramp', 'playstyle', [shared]),
      group('Shift Targets', 'direct', [shared]),
    ]);
    expect(s).toContain('1 card');
  });

  it('phrases one/two/many archetypes and omits archetypes for direct-only cards', () => {
    const m = [match('2', 'X', 6)];
    expect(cardSynergySummary(subject, [group('Ramp', 'playstyle', m)])).toContain(
      'within the Ramp archetype',
    );
    expect(
      cardSynergySummary(subject, [group('Ramp', 'playstyle', m), group('Toys', 'playstyle', m)]),
    ).toContain('across the ');
    expect(cardSynergySummary(subject, [group('Singer + Songs', 'direct', m)])).not.toContain(
      'archetype',
    );
  });

  it('sheds detail, longest first, to stay within 160 characters', () => {
    const long = card('1', 'Lyle Tiberius Rourke - Crystallized Commander');
    const partner = [match('2', 'Darkwing Duck & Launchpad - St. Canard\'s Finest', 8)];
    const groups = ['Self-Discard', 'Floodborns', 'Lore Denial'].map((label) =>
      group(label, 'playstyle', partner),
    );
    const s = cardSynergySummary(long, groups);
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s).toBe(
      'In Core Lorcana, Lyle Tiberius Rourke - Crystallized Commander pairs with 1 card across 3 archetypes, chiefly Self-Discard and Floodborns.',
    );
  });

  it('drops only "across N archetypes" when that is enough', () => {
    const groups = ['Self-Discard', 'Royalty', 'Ramp'].map((label) =>
      group(label, 'playstyle', [match('2', 'Aladdin - Created by the Vine', 7)]),
    );
    expect(cardSynergySummary(card('1', 'The Queen - Conceited Ruler'), groups)).toBe(
      'In Core Lorcana, The Queen - Conceited Ruler pairs with 1 card, chiefly Self-Discard and Royalty, anchored by Aladdin - Created by the Vine (7/10).',
    );
  });

  it('produces different summaries for different cards', () => {
    const g = [group('Ramp', 'playstyle', [match('9', 'Z', 5)])];
    expect(cardSynergySummary(card('1', 'Elsa'), g)).not.toBe(cardSynergySummary(card('2', 'Anna'), g));
  });
});
