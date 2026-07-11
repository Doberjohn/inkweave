import {describe, it, expect} from 'vitest';
import {getRemovalRoles, getRemovalCondition, isRemovalCard} from '../utils';
import {createCard} from './fixtures.js';

// Real Core-pool card texts (ids noted) so the patterns are exercised against
// wording that actually ships, not synthetic strings.

describe('getRemovalRoles', () => {
  it('tags a hard, ungated banisher (Dragon Fire 2322)', () => {
    const card = createCard({id: '2322', type: 'Action', text: 'Banish chosen character.'});
    expect(getRemovalRoles(card)).toEqual(['banish']);
  });

  it('tags a stat-gated banisher as conditional-banish (Red Alert 3106)', () => {
    const card = createCard({
      id: '3106',
      type: 'Action',
      text: 'Banish chosen character with 3 ¤ or less. If you have a Monster character in play, chosen opponent loses 1 lore.',
    });
    expect(getRemovalRoles(card)).toEqual(['conditional-banish']);
  });

  it('tags a damage action (Smash 2134)', () => {
    const card = createCard({id: '2134', type: 'Action', text: 'Deal 3 damage to chosen character.'});
    expect(getRemovalRoles(card)).toEqual(['damage']);
  });

  it('tags a stat debuff (Maid Marian 2094)', () => {
    const card = createCard({
      id: '2094',
      text: 'HIGHBORN LADY When you play this character, chosen character gets -2 ¤ this turn.',
    });
    expect(getRemovalRoles(card)).toEqual(['debuff']);
  });

  it('does NOT tag a self-banish (Sacrifice) card as removal (Time to Go! 2320)', () => {
    const card = createCard({
      id: '2320',
      type: 'Action',
      text: 'Banish chosen character of yours to draw 2 cards. If that character had a card under them, draw 3 cards instead.',
    });
    expect(getRemovalRoles(card)).toEqual([]);
    expect(isRemovalCard(card)).toBe(false);
  });

  it('tags an opponent bounce via the Bounce detector, not as a banish (The Claw 2814)', () => {
    const card = createCard({
      id: '2814',
      type: 'Item',
      text: "THE CLAW CHOOSES ⟳, 2 ⬡, Banish one of your characters — Return chosen opposing character to their player's hand.",
    });
    // Self-banish clause is excluded; the opponent-return clause makes it removal via bounce.
    expect(getRemovalRoles(card)).toEqual(['bounce']);
  });

  it('returns no roles for a vanilla non-removal card', () => {
    const card = createCard({text: 'Bodyguard Support'});
    expect(getRemovalRoles(card)).toEqual([]);
  });
});

describe('getRemovalCondition', () => {
  it('extracts low-strength with threshold from an "N or less" gate (Red Alert 3106)', () => {
    const card = createCard({
      id: '3106',
      type: 'Action',
      text: 'Banish chosen character with 3 ¤ or less. If you have a Monster character in play, chosen opponent loses 1 lore.',
    });
    expect(getRemovalCondition(card)).toEqual({type: 'low-strength', threshold: 3});
  });

  it('reads the real "N or more" gate, not a Singer song reminder\'s cost (World\'s Greatest Criminal Mind 1966)', () => {
    const card = createCard({
      id: '1966',
      type: 'Action',
      text: '(A character with cost 3 or more can ⟳ to sing this song for free.) Banish chosen character with 5 ¤ or more.',
    });
    // The stripped reminder\'s "cost 3 or more" must not win over the real "5 ¤ or more".
    expect(getRemovalCondition(card)).toEqual({type: 'high-cost', threshold: 5});
  });

  it('keys on the damaged target restriction (Education or Elimination 2560)', () => {
    const card = createCard({
      id: '2560',
      type: 'Action',
      text: '(A character with cost 4 or more can ⟳ to sing this song for free.) Choose one: • Draw a card. Chosen character of yours gets +1 ◊ and gains Evasive until the start of your next turn. (Only characters with Evasive can challenge them.) • Banish chosen damaged character.',
    });
    expect(getRemovalRoles(card)).toEqual(['banish']);
    expect(getRemovalCondition(card)).toEqual({type: 'damaged'});
  });

  it('keys on an Evasive-gated target (The Horseman Strikes! 2218)', () => {
    const card = createCard({
      id: '2218',
      type: 'Action',
      text: 'Draw a card. You may banish chosen character with Evasive.',
    });
    expect(getRemovalCondition(card)).toEqual({type: 'evasive'});
  });

  it('is not fooled by the Evasive keyword reminder into a false evasive gate (Sisu 2055)', () => {
    const card = createCard({
      id: '2055',
      text: 'Evasive (Only characters with Evasive can challenge this character.) BRING ON THE HEAT! When you play this character, banish chosen opposing character with 1 ¤ or less.',
    });
    expect(getRemovalCondition(card)).toEqual({type: 'low-strength', threshold: 1});
  });

  it('reports unconditional for ungated removal (Dragon Fire 2322)', () => {
    const card = createCard({id: '2322', type: 'Action', text: 'Banish chosen character.'});
    expect(getRemovalCondition(card)).toEqual({type: 'unconditional'});
  });

  it('returns null for a non-removal card', () => {
    const card = createCard({text: 'Bodyguard Support'});
    expect(getRemovalCondition(card)).toBeNull();
  });
});
