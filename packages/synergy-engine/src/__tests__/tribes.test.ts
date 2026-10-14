import {describe, it, expect} from 'vitest';
import {getTribalRoles, TRIBAL_SPECS} from '../utils';
import {createCard} from './fixtures';

// Classification-tribe fixes from the 2026-10-14 misread review, kept out of rules.test.ts
// (CodeScene: function count). Real card text.

// A Princess buff on a Prince.
const beast = createCard({
  id: 'beast-gracious-prince',
  name: 'Beast',
  fullName: 'Beast - Gracious Prince',
  cost: 5,
  classifications: ['Storyborn', 'Hero', 'Prince'],
  text: 'FULL DANCE CARD Your Princess characters get\n+1 ¤ and +1 ⛉.',
});

describe('Tribes: a tribe word inside a longer one', () => {
  it('reads "Your Princess characters" as a Princess buff, not a Prince one', () => {
    expect(getTribalRoles(beast, TRIBAL_SPECS.princess)).toEqual(['buff']);
    expect(getTribalRoles(beast, TRIBAL_SPECS.royalty)).toEqual(['member']);
  });
});
