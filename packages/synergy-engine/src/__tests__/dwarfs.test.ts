import {describe, it, expect} from 'vitest';
import {getDwarfsRoles, isDwarfsCard} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';

describe('Dwarfs Tribal', () => {
  const dwarfsRule = getRuleById('dwarfs')!;

  // Members — Seven Dwarfs subtype.
  const plainMemberA = createCard({
    id: 'dopey-music',
    fullName: 'Dopey - Drawn to Music',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
    text: 'TONGUE-TIED This character can’t ⟳ to sing songs.',
  });
  const plainMemberB = createCard({
    id: 'happy-adventurer',
    fullName: 'Happy - Joyful Adventurer',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
    text: '',
  });
  const docTakingNotes = createCard({
    id: 'doc-taking-notes',
    fullName: 'Doc - Taking Notes',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
    text: 'SHARE KNOWLEDGE When you play this character, if you have another Seven Dwarfs character or a Princess character in play, draw a card.',
  });

  // Payoffs — reference Seven Dwarfs in text but are NOT members.
  const snowWhiteMerry = createCard({
    id: 'snow-white-merry',
    fullName: 'Snow White - Merry as the Morning',
    ink: 'Amethyst',
    classifications: ['Dreamborn', 'Hero', 'Princess'],
    text: 'CLARION CALL Whenever this character quests, you may return chosen Seven Dwarfs character of yours to your hand to draw a card.',
  });
  const rightBehindYou = createCard({
    id: 'right-behind-you',
    fullName: 'Right Behind You',
    ink: 'Amethyst',
    type: 'Action',
    text: 'Draw a card. If you have a Seven Dwarfs character and a Princess character in play, you may play a Seven Dwarfs character for free.',
  });
  const dontBeNervous = createCard({
    id: 'dont-be-nervous',
    fullName: "Don't Be Nervous",
    ink: 'Amethyst',
    type: 'Action',
    text: 'Search your deck for a Princess character card, reveal that card to all players, and put it into your hand. Then, shuffle your deck. If you have 2 or more Seven Dwarfs characters in play, draw 2 cards and gain 2 lore.',
  });

  // Excluded — a Princess with no Seven Dwarfs text reference.
  const princessOnly = createCard({
    id: 'cinderella',
    fullName: 'Cinderella - Gentle and Kind',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Hero', 'Princess'],
    text: 'When you play this character, gain 1 lore.',
  });

  describe('getDwarfsRoles', () => {
    it('detects member from the Seven Dwarfs classification', () => {
      expect(getDwarfsRoles(plainMemberA)).toEqual(['member']);
    });

    it('detects member + density for a Dwarf with a density payoff', () => {
      expect(getDwarfsRoles(docTakingNotes)).toEqual(['member', 'density']);
    });

    it('detects density on a non-member action', () => {
      expect(getDwarfsRoles(dontBeNervous)).toEqual(['density']);
    });

    it('detects density + recruit on Right Behind You', () => {
      expect(getDwarfsRoles(rightBehindYou)).toEqual(['density', 'recruit']);
    });

    it('detects return on Snow White - Merry as the Morning', () => {
      expect(getDwarfsRoles(snowWhiteMerry)).toEqual(['return']);
    });

    it('excludes a Princess card with no Seven Dwarfs text', () => {
      expect(getDwarfsRoles(princessOnly)).toEqual([]);
      expect(isDwarfsCard(princessOnly)).toBe(false);
    });
  });

  describe('rule matching', () => {
    it('matches members and Seven Dwarfs payoffs, not Princess-only cards', () => {
      expect(dwarfsRule.matches(plainMemberA)).toBe(true);
      expect(dwarfsRule.matches(rightBehindYou)).toBe(true);
      expect(dwarfsRule.matches(princessOnly)).toBe(false);
    });
  });

  describe('rule scoring', () => {
    const allCards = [
      plainMemberA,
      plainMemberB,
      docTakingNotes,
      snowWhiteMerry,
      rightBehindYou,
      dontBeNervous,
      princessOnly,
    ];
    const findScore = (selected: typeof plainMemberA, partnerId: string): number =>
      dwarfsRule.findSynergies(selected, allCards).find((s) => s.card.id === partnerId)?.score ?? -1;

    it('member ↔ member scores 5 (density baseline)', () => {
      expect(findScore(plainMemberA, 'happy-adventurer')).toBe(5);
    });

    it('recruit ↔ member scores 8, and precedence beats the density tier', () => {
      // Right Behind You is BOTH recruit and density; vs a member, recruit (8) wins over density (7).
      expect(findScore(rightBehindYou, 'dopey-music')).toBe(8);
    });

    it('recruit ↔ density scores 8', () => {
      expect(findScore(rightBehindYou, 'dont-be-nervous')).toBe(8);
    });

    it('density ↔ member scores 7 (member feeds the payoff)', () => {
      expect(findScore(docTakingNotes, 'dopey-music')).toBe(7);
    });

    it('density ↔ density scores 7 (payoffs compound)', () => {
      expect(findScore(docTakingNotes, 'dont-be-nervous')).toBe(7);
    });

    it('return ↔ member scores 7 (bounce re-buys the enter-play ability)', () => {
      expect(findScore(snowWhiteMerry, 'dopey-music')).toBe(7);
    });
  });
});
