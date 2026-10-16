import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Free Play', () => {
  const freePlayRule = getRuleById('free-play')!;

  const anchor = createCard({
    id: 'pocahontas',
    name: 'Pocahontas',
    fullName: 'Pocahontas - Guiding the Tribe',
    ink: 'Amber',
    cost: 2,
    type: 'Character',
    text: 'STAY CLOSE When you play this character, you may play a character with cost 1 for free.',
  });

  const oneDrop = (id: string, etb = false) =>
    createCard({
      id,
      name: 'Cheap',
      fullName: 'Cheap - Body',
      ink: 'Amber',
      cost: 1,
      type: 'Character',
      text: etb ? 'GREETING When you play this character, draw a card.' : '',
    });

  it('matches the anchor by ability text', () => {
    expect(freePlayRule.matches(anchor)).toBe(true);
  });

  it('matches a cost-1 character as a payoff', () => {
    expect(freePlayRule.matches(oneDrop('a'))).toBe(true);
  });

  it('does not match a cost-2 character or a cost-1 non-character', () => {
    const twoDrop = createCard({id: 'two', name: 'Two', cost: 2, type: 'Character', text: ''});
    const oneItem = createCard({id: 'item', name: 'Trinket', cost: 1, type: 'Item', text: ''});
    expect(freePlayRule.matches(twoDrop)).toBe(false);
    expect(freePlayRule.matches(oneItem)).toBe(false);
  });

  it('forward: anchor finds cost-1 characters, excludes pricier bodies and itself', () => {
    const ok = oneDrop('ok');
    const two = createCard({id: 'two', name: 'Two', cost: 2, type: 'Character', text: ''});
    const synergies = freePlayRule.findSynergies(anchor, [anchor, ok, two]);
    expect(synergies.map((s) => s.card.id)).toEqual(['ok']);
  });

  it('reverse: a cost-1 character finds the anchor', () => {
    const payoff = oneDrop('p');
    const synergies = freePlayRule.findSynergies(payoff, [payoff, anchor]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].card.id).toBe('pocahontas');
  });

  it('scores a plain body 6 and an on-play body 8', () => {
    const plain = freePlayRule.findSynergies(anchor, [anchor, oneDrop('plain')])[0];
    const etb = freePlayRule.findSynergies(anchor, [anchor, oneDrop('etb', true)])[0];
    expect(plain.score).toBe(6);
    expect(etb.score).toBe(8);
  });

  it('frames the anchor as the enabler in both directions (token-swap) and notes the on-play effect', () => {
    const payoff = oneDrop('etb', true);
    const fwd = freePlayRule.findSynergies(anchor, [anchor, payoff])[0];
    const rev = freePlayRule.findSynergies(payoff, [payoff, anchor])[0];
    expect(fwd.explanation).toContain('{A} plays {B}');
    expect(rev.explanation).toContain('{B} plays {A}');
    expect(fwd.explanation).toContain('triggering its on-play effect');
  });

  it('marks synergies as bidirectional', () => {
    const synergies = freePlayRule.findSynergies(anchor, [anchor, oneDrop('x')]);
    expect(synergies.every((s) => s.bidirectional)).toBe(true);
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const freePlayRule = getRuleById('free-play')!;
/** The Free Play pair `card` finds with `partner`, or undefined when they do not pair. */
const freePlayPair = (card: LorcanaCard, partner: LorcanaCard) =>
  freePlayRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

const pocahontas = createCard({
  id: 'pocahontas-guiding-the-tribe',
  name: 'Pocahontas',
  fullName: 'Pocahontas - Guiding the Tribe',
  cost: 2,
  classifications: ['Storyborn', 'Hero', 'Princess'],
  text: 'STAY CLOSE When you play this character, you\nmay play a character with cost 1 for free.',
});
// An on-play drawback, and an on-play effect.
const gantu = createCard({
  id: 'gantu-hamsterviels-accomplice',
  name: 'Gantu',
  fullName: "Gantu - Hamsterviel's Accomplice",
  ink: 'Steel',
  cost: 1,
  classifications: ['Storyborn', 'Alien', 'Captain'],
  text: 'EASY TARGET When you play this character,\nchoose and discard a card.',
});
const berlioz = createCard({
  id: 'berlioz-tiny-rascal',
  name: 'Berlioz',
  fullName: 'Berlioz - Tiny Rascal',
  ink: 'Steel',
  cost: 1,
  classifications: ['Storyborn', 'Ally'],
  text: 'SHARP LITTLE CLAWS When you play this character,\nyou may deal 1 damage to chosen character.',
});

describe('Free Play: an on-play clause that only costs you', () => {
  it('scores the free body at 6, not as a two-for-one, from either side', () => {
    for (const pair of [freePlayPair(pocahontas, gantu), freePlayPair(gantu, pocahontas)]) {
      expect(pair?.score).toBe(6);
    }
    expect(freePlayPair(pocahontas, gantu)?.explanation).toBe('{A} plays {B} for free.');
  });

  it('keeps the 8 for an on-play effect', () => {
    expect(freePlayPair(pocahontas, berlioz)?.score).toBe(8);
  });
});
