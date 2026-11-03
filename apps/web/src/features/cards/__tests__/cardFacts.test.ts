import {describe, it, expect} from 'vitest';
import {cardFacts} from '../cardFacts';
import {createCard} from '../../../shared/test-utils';

describe('cardFacts', () => {
  it('states a character with its classifications, stats, set and inkwell', () => {
    const sven = createCard({
      fullName: 'Sven - Official Ice Deliverer',
      cost: 6,
      ink: 'Amethyst',
      classifications: ['Storyborn', 'Ally'],
      strength: 5,
      willpower: 7,
      lore: 1,
      setCode: '9',
      setNumber: 56,
    });
    expect(cardFacts(sven)).toBe(
      'Sven - Official Ice Deliverer is a 6-cost Amethyst Character (Storyborn, Ally) with 5 strength, 7 willpower and 1 lore, from Fabled, card 56. It can go into the inkwell.',
    );
  });

  it('calls a song an Action song and an uninkable card uninkable', () => {
    const song = createCard({
      fullName: 'Circle of Life',
      cost: 8,
      type: 'Action',
      isSong: true,
      inkwell: false,
      setCode: '9',
      setNumber: 26,
    });
    expect(cardFacts(song)).toBe(
      'Circle of Life is an 8-cost Amber Action song from Fabled, card 26. It cannot go into the inkwell.',
    );
  });

  it('gives a location its willpower and move cost, and leaves out lore it lacks', () => {
    const location = createCard({
      fullName: 'Atlantica - Concert Hall',
      cost: 1,
      type: 'Location',
      willpower: 6,
      lore: 0,
      moveCost: 2,
      setCode: '9',
      setNumber: 34,
    });
    expect(cardFacts(location)).toBe(
      'Atlantica - Concert Hall is a 1-cost Amber Location with 6 willpower and a move cost of 2, from Fabled, card 34. It can go into the inkwell.',
    );
  });

  it('names both inks of a dual-ink item', () => {
    const item = createCard({
      fullName: 'Lantern',
      cost: 2,
      type: 'Item',
      ink2: 'Steel',
      setCode: '14',
      setNumber: 3,
    });
    expect(cardFacts(item)).toBe(
      'Lantern is a 2-cost Amber and Steel Item from Hyperia City, card 3. It can go into the inkwell.',
    );
  });

  it('says "an" before an 11-cost card and names an unlisted set by its code', () => {
    const card = createCard({fullName: 'Big Card', cost: 11, type: 'Action', setCode: '15'});
    expect(cardFacts(card)).toBe(
      'Big Card is an 11-cost Amber Action from Set 15. It can go into the inkwell.',
    );
  });
});
