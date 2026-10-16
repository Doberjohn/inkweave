import {describe, it, expect} from 'vitest';
import {getRuleById, SynergyEngine} from '../engine';
import {getToyRoles, isToyCard} from '../utils';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Toy Tribal', () => {
  const toyRule = getRuleById('toy')!;

  // Real-card-shaped fixtures
  const woodyLeader = createCard({
    id: 'woody-leader',
    name: 'Woody',
    fullName: 'Woody - Leader of the Toys',
    classifications: ['Storyborn', 'Hero', 'Toy'],
    text: 'When you play this character, look at the top 4 cards of your deck. You may reveal a Toy character and put it into your hand. Put the rest on the bottom of your deck in any order.',
  });

  const woodyJungleGuide = createCard({
    id: 'woody-jungle',
    name: 'Woody',
    fullName: 'Woody - Jungle Guide',
    classifications: ['Floodborn', 'Hero', 'Toy'],
    // Both a tribal buff (matches `classifyToyPayoff` moderate tier regex)
    // and a draw effect (so the card has a specific role and enters the playstyle).
    text: 'When you play this character, draw a card. Your other Toy characters get +1 willpower.',
  });

  const sidPhillips = createCard({
    id: 'sid-phillips',
    name: 'Sid Phillips',
    fullName: 'Sid Phillips - Toy Surgeon',
    classifications: ['Storyborn', 'Villain'],
    text: 'During your turn, whenever a Toy character is banished, gain 2 lore.',
  });

  const buzzMember = createCard({
    id: 'buzz-member',
    name: 'Buzz Lightyear',
    fullName: 'Buzz Lightyear - Space Ranger',
    classifications: ['Storyborn', 'Hero', 'Toy'],
    text: '', // member only, no Toy text
  });

  const buzzAbilityName = createCard({
    id: 'buzz-ability-name',
    name: 'Buzz Lightyear',
    fullName: 'Buzz Lightyear - On the Way',
    classifications: ['Storyborn', 'Hero', 'Toy'],
    // Ability NAME contains "TOY" but no actual Toy-tribal effect
    text: "WORLD'S GREATEST TOY Whenever you pay 2 ⬡ or less to play a character, deal 1 damage to chosen opposing damaged character.",
  });

  const handInTheBox = createCard({
    id: 'hand-in-box',
    name: 'Hand-in-the-Box',
    fullName: "Hand-in-the-Box - Sid's Toy",
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: 'You may put a Toy character card from your discard on the bottom of your deck to play this character for free.',
  });

  const windUpFrog = createCard({
    id: 'wind-up-frog',
    name: 'Wind-Up Frog',
    fullName: "Wind-Up Frog - Sid's Toy",
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: 'If one of your Toy characters was banished this turn, you pay 2 ⬡ less to play this character.',
  });

  const bullseye = createCard({
    id: 'bullseye',
    name: 'Bullseye',
    fullName: 'Bullseye - Loyal Horse',
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: 'If you have a character named Woody or Jessie in play, you pay 1 less ⬡ to play this character.',
  });

  const alien = createCard({
    id: 'alien',
    name: 'Alien',
    fullName: 'Alien - True Believer',
    classifications: ['Storyborn', 'Alien', 'Ally', 'Toy'],
    // Self-banish trigger — "when this character is banished" — counted as Toy banish via membership gate.
    text: 'During your turn, when this character is banished, return another character card named Alien from your discard to your hand.',
  });

  const mickey = createCard({
    id: 'mickey-control',
    name: 'Mickey Mouse',
    fullName: 'Mickey Mouse - Brave Little Tailor',
    classifications: ['Storyborn', 'Hero'],
    text: 'When you play this character, gain 1 lore.',
  });

  describe('getToyRoles', () => {
    it('detects member from Toy classification', () => {
      expect(getToyRoles(buzzMember)).toEqual(['member']);
    });

    it('detects banish-trigger from "whenever a Toy character is banished"', () => {
      expect(getToyRoles(sidPhillips)).toEqual(['banish-trigger']);
    });

    it('detects banish-trigger from self-banish ("when this character is banished") on Toy member', () => {
      // Membership gate makes self-banish count as a Toy-banish event.
      // Alien is also a member, so roles include 'member' alongside 'banish-trigger'.
      expect(getToyRoles(alien)).toEqual(['member', 'banish-trigger']);
    });

    it('detects self-discount on Toy member with conditional cost reduction', () => {
      // Wind-Up Frog: "If one of your Toy characters was banished, you pay 2 less"
      // Past tense ("was banished") naturally excludes from banish-trigger.
      expect(getToyRoles(windUpFrog)).toEqual(['member', 'self-discount']);
    });

    it('detects self-discount even when condition is non-Toy (named gate)', () => {
      // Bullseye: condition is "named Woody or Jessie" — still self-discount on a Toy member.
      expect(getToyRoles(bullseye)).toEqual(['member', 'self-discount']);
    });

    it('Hand-in-the-Box (free-play via discard) is self-discount via the "for free" limit case', () => {
      // "play this character for free" = max self-discount (cost = 0).
      // Recursion component (Toy from discard → deck) is a separate mechanic, deferred to Phase 4.
      expect(getToyRoles(handInTheBox)).toEqual(['member', 'self-discount']);
    });

    it('detects member + specific mechanic role for hybrid Toy cards', () => {
      // Woody Leader is a Toy member with a Search effect (look at top 4, reveal a Toy)
      expect(getToyRoles(woodyLeader)).toEqual(['member', 'search']);
    });

    it('skips ability-name false positives (Buzz Lightyear "WORLD\'S GREATEST TOY")', () => {
      expect(getToyRoles(buzzAbilityName)).toEqual(['member']);
    });

    it('returns empty for non-Toy cards', () => {
      expect(getToyRoles(mickey)).toEqual([]);
      expect(isToyCard(mickey)).toBe(false);
    });
  });

  describe('rule scoring', () => {
    const engine = new SynergyEngine();
    const allCards = [
      woodyLeader,
      woodyJungleGuide,
      sidPhillips,
      alien,
      buzzMember,
      handInTheBox,
      mickey,
    ];

    const findToyScore = (selected: typeof woodyLeader, partnerId: string): number => {
      const groups = engine.findSynergies(selected, allCards);
      const toy = groups.find((g) => g.groupKey === 'toy');
      return toy?.synergies.find((s) => s.card.id === partnerId)?.score ?? -1;
    };

    it('pure member ↔ pure member scores 5 (density only)', () => {
      // Both cards have only the 'member' role — neither carries a specific mechanic.
      const plainMemberA = createCard({id: 'rex', classifications: ['Toy'], text: ''});
      const plainMemberB = createCard({id: 'jessie-plain', classifications: ['Toy'], text: ''});
      const groups = engine.findSynergies(plainMemberA, [plainMemberA, plainMemberB]);
      const toy = groups.find((g) => g.groupKey === 'toy');
      expect(toy?.synergies[0]?.score).toBe(5);
    });

    it('member ↔ search scores 8 (search fetches a tribal member)', () => {
      // Buzz (pure member) ↔ Woody — Leader of the Toys (member + search)
      expect(findToyScore(buzzMember, 'woody-leader')).toBe(8);
    });

    it('search ↔ banish-trigger scores 8 (peak tribal chain)', () => {
      // Woody Leader (search) ↔ Sid Phillips (banish-trigger): load board, pay off on banish
      expect(findToyScore(woodyLeader, 'sid-phillips')).toBe(8);
    });

    it('member ↔ banish-trigger scores 7 (member feeds the trigger)', () => {
      expect(findToyScore(buzzMember, 'sid-phillips')).toBe(7);
    });

    it('member ↔ self-discount scores 7 (member activates discount density)', () => {
      // Hand-in-the-Box has self-discount via "play this character for free"
      expect(findToyScore(buzzMember, 'hand-in-box')).toBe(7);
    });

    it('tribal ↔ tribal scores 7 (multiple density rewards compound)', () => {
      // Sid (banish-trigger) ↔ Alien (member + banish-trigger): both tribal payoffs
      expect(findToyScore(sidPhillips, 'alien')).toBe(7);
    });

    it('member ↔ generic mechanic scores 5 (deck-share, no tribal compounding)', () => {
      // Woody Jungle Guide has 'draw' role only (generic, not tribal-specific)
      expect(findToyScore(buzzMember, 'woody-jungle')).toBe(5);
    });

    it('rule does not match non-Toy cards', () => {
      expect(toyRule.matches(mickey)).toBe(false);
    });
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const toyRule = getRuleById('toy')!;
/** The Toy pair `card` finds with `partner`, or undefined when they do not pair. */
const toyPair = (card: LorcanaCard, partner: LorcanaCard) =>
  toyRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Toy payoff roles for the card's own banish, which counts no other Toy.
const rex = createCard({
  id: 'rex-protective-dinosaur',
  name: 'Rex',
  fullName: 'Rex - Protective Dinosaur',
  cost: 2,
  classifications: ['Storyborn', 'Ally', 'Dinosaur', 'Toy'],
  text: "Bodyguard (This character may enter play\nexerted. An opposing character who challenges\none of your characters must choose one with\nBodyguard if able.)\nRUN AWAY! During an opponent's turn, when this\ncharacter is banished, gain 1 lore.",
});
const pterodactyl = createCard({
  id: 'pterodactyl-janie-doll-sids-toy',
  name: 'Pterodactyl Janie Doll',
  fullName: "Pterodactyl Janie Doll - Sid's Toy",
  ink: 'Ruby',
  cost: 1,
  classifications: ['Storyborn', 'Ally', 'Toy'],
  text: 'DOUBLE TRANSPLANT During your turn, when this\ncharacter is banished, each opponent loses 1 lore\nand you gain 1 lore.',
});
// Counts every other Toy.
const alien = createCard({
  id: 'alien-true-believer',
  name: 'Alien',
  fullName: 'Alien - True Believer',
  ink: 'Emerald',
  cost: 1,
  classifications: ['Storyborn', 'Ally', 'Alien', 'Toy'],
  text: 'WE ARE ONE This character gets +1 ¤ for each\nother Toy character you have in play.\nHE HAS BEEN CHOSEN During your turn, when\nthis character is banished, return another\ncharacter card named Alien from your discard to\nyour hand.',
});
const hamm = createCard({
  id: 'hamm-piggy-bank',
  name: 'Hamm',
  fullName: 'Hamm - Piggy Bank',
  cost: 2,
  classifications: ['Storyborn', 'Ally', 'Toy'],
  text: 'LOOSE CHANGE ⟳ — You pay 1 ⬡ less for the\nnext character you play this turn.',
});

describe('Toys: a payoff that counts no other Toy', () => {
  it('scores it at the same-deck 5 with a member or another such payoff, from either side', () => {
    const pairs = [hamm, pterodactyl].flatMap((partner) => [
      toyPair(rex, partner),
      toyPair(partner, rex),
    ]);
    for (const pair of pairs) {
      expect(pair).toMatchObject({score: 5, explanation: '{A} and {B} both go in a Toys deck.'});
    }
  });

  it('keeps the 7 for a payoff that counts the other Toys', () => {
    expect(toyPair(alien, hamm)).toMatchObject({
      score: 7,
      explanation: "{B} can activate {A}'s Toy ability.",
    });
  });
});
