import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';

describe('Merida Archer', () => {
  const meridaRule = getRuleById('merida-archer')!;

  const anchor = createCard({
    id: 'merida',
    name: 'Merida',
    fullName: 'Merida - Formidable Archer',
    ink: 'Steel',
    text: 'STEADY AIM Whenever one of your actions deals damage to an opposing character, deal 2 damage to that character.',
  });

  const smash = createCard({
    id: 'smash',
    name: 'Smash',
    fullName: 'Smash',
    type: 'Action',
    ink: 'Steel',
    text: 'Deal 3 damage to chosen character.',
  });

  const mobSong = createCard({
    id: 'mob-song',
    name: 'The Mob Song',
    fullName: 'The Mob Song',
    type: 'Action',
    ink: 'Steel',
    text: 'Deal 3 damage to up to 3 chosen characters and/or locations.',
  });

  // Break Free — self-only removal (damage to YOUR OWN character), must be excluded.
  const breakFree = createCard({
    id: 'break-free',
    name: 'Break Free',
    fullName: 'Break Free',
    type: 'Action',
    ink: 'Steel',
    text: 'Deal 1 damage to chosen character of yours. They gain Rush and get +1 ¤ this turn.',
  });

  // Food Fight! — grants a damage ability to characters, must be excluded.
  const foodFight = createCard({
    id: 'food-fight',
    name: 'Food Fight!',
    fullName: 'Food Fight!',
    type: 'Action',
    ink: 'Steel',
    text: 'Your characters gain “⟳, 1 ⬡ — Deal 1 damage to chosen character” this turn.',
  });

  it('matches the STEADY AIM anchor by ability text', () => {
    expect(meridaRule.matches(anchor)).toBe(true);
  });

  it('matches a damage-dealing action', () => {
    expect(meridaRule.matches(smash)).toBe(true);
  });

  it('does not match self-only removal (Break Free) or granted-ability damage (Food Fight!)', () => {
    expect(meridaRule.matches(breakFree)).toBe(false);
    expect(meridaRule.matches(foodFight)).toBe(false);
  });

  it('forward: anchor finds damage actions, excludes non-payoffs and itself', () => {
    const synergies = meridaRule.findSynergies(anchor, [anchor, smash, breakFree, foodFight]);
    expect(synergies.map((s) => s.card.id)).toEqual(['smash']);
  });

  it('reverse: a damage action finds the anchor', () => {
    const synergies = meridaRule.findSynergies(smash, [smash, anchor]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].card.id).toBe('merida');
  });

  it.each([
    ['1-damage single → 6 (floor)', 'Deal 1 damage to chosen character.', 6],
    ['3-damage single (Smash) → 8', 'Deal 3 damage to chosen character.', 8],
    ['3-damage multi (Mob Song) → 9', 'Deal 3 damage to up to 3 chosen characters and/or locations.', 9],
    ['1-damage multi → 7', 'Deal 1 damage each to up to 2 chosen characters.', 7],
    ['4-damage single caps at 8 (min(dmg,3))', 'Deal 4 damage to chosen character.', 8],
  ] as const)('scores %s', (_label, text, expected) => {
    const action = createCard({id: 'a', type: 'Action', ink: 'Steel', text});
    const synergies = meridaRule.findSynergies(anchor, [anchor, action]);
    expect(synergies[0].score).toBe(expected);
  });

  it('frames Merida as the enabler in both directions (token-swap)', () => {
    const fwd = meridaRule.findSynergies(anchor, [anchor, smash])[0];
    const rev = meridaRule.findSynergies(smash, [smash, anchor])[0];
    // Forward: anchor is the searcher → {A}; action is {B}
    expect(fwd.explanation).toContain("{A}'s STEADY AIM adds 2 damage to {B}");
    // Reverse: action is the searcher → {A}; Merida swaps to {B} but stays the actor
    expect(rev.explanation).toContain("{B}'s STEADY AIM adds 2 damage to {A}");
  });

  it('marks synergies as bidirectional', () => {
    const synergies = meridaRule.findSynergies(anchor, [anchor, smash, mobSong]);
    expect(synergies.every((s) => s.bidirectional)).toBe(true);
  });
});
