import {describe, it, expect} from 'vitest';
import {getTribalRoles, isTribalCard, TRIBAL_SPECS} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Classification tribes detection', () => {
  const P = TRIBAL_SPECS.princess;
  const memberOnly = createCard({id: 'aurora', name: 'Aurora', cost: 4, classifications: ['Princess'], text: 'Quests for 2 lore.'});
  const teamBuff = createCard({id: 'beast', name: 'Beast', cost: 6, classifications: ['Prince'], text: 'FULL DANCE CARD Your Princess characters get +1 ¤ and +1 ⛉.'});
  const targetBuff = createCard({id: 'wand', name: "Fairy Godmother's Wand", type: 'Item', cost: 2, text: 'Chosen Princess character of yours gains Ward until the start of your next turn.'});
  const trigger = createCard({id: 'vanellope', name: 'Vanellope', cost: 4, classifications: ['Princess'], text: 'Whenever you play another Princess character, all opposing characters get -1 ¤ this turn.'});
  const search = createCard({id: 'nervous', name: "Don't Be Nervous", type: 'Action', cost: 2, text: 'Search your deck for a Princess character card, reveal that card, and put it into your hand.'});
  const check = createCard({id: 'hans', name: 'Hans', cost: 3, classifications: ['Prince'], text: 'When you play this character, if a Princess or Queen character is in play, gain 1 lore.'});

  it('tags a member with no payoff text as member only', () => {
    expect(getTribalRoles(memberOnly, P)).toEqual(['member']);
  });
  it('detects a team buff on a non-member payoff', () => {
    expect(getTribalRoles(teamBuff, P)).toEqual(['buff']);
  });
  it('detects a single-target buff with an "of yours" gap', () => {
    expect(getTribalRoles(targetBuff, P)).toEqual(['buff']);
  });
  it('detects the "whenever you play a Princess" trigger', () => {
    expect(getTribalRoles(trigger, P)).toEqual(['member', 'trigger']);
  });
  it('detects a deck search', () => {
    expect(getTribalRoles(search, P)).toEqual(['search']);
  });
  it('detects an in-play check where the tribe is the second option', () => {
    expect(getTribalRoles(check, P)).toEqual(['in-play-check']);
  });
  it('keeps Royalty disjoint from Princess (a Prince is not a Princess member)', () => {
    const phillip = createCard({id: 'phillip', name: 'Prince Phillip', cost: 4, classifications: ['Hero', 'Prince'], text: 'Bodyguard.'});
    expect(getTribalRoles(phillip, TRIBAL_SPECS.royalty)).toEqual(['member']);
    expect(isTribalCard(phillip, TRIBAL_SPECS.princess)).toBe(false);
  });
});

describe('Classification tribes rule (payoff-anchored)', () => {
  const rule = getRuleById('princess')!;
  const member = createCard({id: 'aurora', name: 'Aurora', cost: 4, classifications: ['Princess'], text: 'Quests for 2.'});
  const member2 = createCard({id: 'belle', name: 'Belle', cost: 3, classifications: ['Princess'], text: 'Has Ward.'});
  const teamBuff = createCard({id: 'beast', name: 'Beast', cost: 6, classifications: ['Prince'], text: 'Your Princess characters get +1 ¤ and +1 ⛉.'});
  const trigger = createCard({id: 'vanellope', name: 'Vanellope', cost: 4, classifications: ['Princess'], text: 'Whenever you play another Princess character, draw a card.'});
  const search = createCard({id: 'nervous', name: "Don't Be Nervous", type: 'Action', cost: 2, text: 'Search your deck for a Princess character card and put it into your hand.'});
  const check = createCard({id: 'hans', name: 'Hans', cost: 3, classifications: ['Prince'], text: 'When you play this character, if a Princess character is in play, gain 1 lore.'});
  const scoreWith = (a, b) => rule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  it('scores search + member at 8', () => { expect(scoreWith(search, member)?.score).toBe(8); });
  it('scores trigger + member at 7', () => { expect(scoreWith(trigger, member)?.score).toBe(7); });
  it('scores payoff + payoff at 6 when only one helps the other', () => { expect(scoreWith(teamBuff, trigger)?.score).toBe(6); });
  it('scores buff + member at 6', () => { expect(scoreWith(teamBuff, member)?.score).toBe(6); });
  it('scores in-play-check + member at 6', () => { expect(scoreWith(check, member)?.score).toBe(6); });
  it('drops member + member (payoff-anchored)', () => { expect(scoreWith(member, member2)).toBeUndefined(); });
});
describe('Detectives detection', () => {
  const D = TRIBAL_SPECS.detective;
  const memberOnly = createCard({id: 'basil-dt', name: 'Basil', fullName: 'Basil - Practiced Detective', cost: 3, classifications: ['Detective'], text: 'Quests for 2 lore.'});
  const teamBuff = createCard({id: 'judy-lead', name: 'Judy Hopps', fullName: 'Judy Hopps - Lead Detective', cost: 5, classifications: ['Detective'], text: 'THE CASE IS AFOOT Your Detective characters get +1 ⛉.'});
  const trigger = createCard({id: 'basil-ten', name: 'Basil', fullName: 'Basil - Tenacious Mouse', cost: 4, classifications: ['Detective'], text: 'WORKING THEORY Whenever one of your Detective characters quests, you may draw a card.'});
  const search = createCard({id: 'judy-clues', name: 'Judy Hopps', fullName: 'Judy Hopps - Uncovering Clues', cost: 4, classifications: ['Detective'], text: 'FOLLOW THE CLUES When you play this character, you may search your deck for a Detective character card, reveal it, and put it into your hand.'});
  const check = createCard({id: 'pluto', name: 'Pluto', fullName: 'Pluto - Clever Cluefinder', cost: 3, text: 'SNIFF THEM OUT While you have a Detective character in play, this character gets +1 ◊.'});
  // Give-form single-target buff on a NON-member payoff (Flash - Records Specialist).
  const giveBuff = createCard({id: 'flash', name: 'Flash', fullName: 'Flash - Records Specialist', cost: 3, text: 'DEEP RESEARCH Whenever this character quests, you may give chosen Detective character +2 ¤ this turn.'});

  it('tags a member with no payoff text as member only', () => {
    expect(getTribalRoles(memberOnly, D)).toEqual(['member']);
  });
  it('detects a give-form "+N" single-target buff (Flash - Records Specialist)', () => {
    expect(getTribalRoles(giveBuff, D)).toEqual(['buff']);
  });
  it('detects a team buff on a Detective member', () => {
    expect(getTribalRoles(teamBuff, D)).toEqual(['member', 'buff']);
  });
  it('detects the tribal quest trigger', () => {
    expect(getTribalRoles(trigger, D)).toEqual(['member', 'trigger']);
  });
  it('detects a deck search', () => {
    expect(getTribalRoles(search, D)).toEqual(['member', 'search']);
  });
  it('detects an in-play check on a non-member', () => {
    expect(getTribalRoles(check, D)).toEqual(['in-play-check']);
  });
});

describe('Detectives rule (payoff-anchored)', () => {
  const rule = getRuleById('detective')!;
  const member = createCard({id: 'basil-dt', name: 'Basil', classifications: ['Detective'], text: 'Quests for 2.'});
  const member2 = createCard({id: 'dawson', name: 'Dawson', classifications: ['Detective'], text: 'Has Ward.'});
  const teamBuff = createCard({id: 'judy-lead', name: 'Judy Hopps', classifications: ['Detective'], text: 'Your Detective characters get +1 ⛉.'});
  const trigger = createCard({id: 'basil-ten', name: 'Basil', classifications: ['Detective'], text: 'Whenever one of your Detective characters quests, draw a card.'});
  const search = createCard({id: 'clues', name: 'Search for Clues', type: 'Action', cost: 2, text: 'Search your deck for a Detective character card and put it into your hand.'});
  const check = createCard({id: 'pluto', name: 'Pluto', cost: 3, text: 'While you have a Detective character in play, this character gets +1 ◊.'});
  const scoreWith = (a, b) => rule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  it('scores search + member at 8', () => { expect(scoreWith(search, member)?.score).toBe(8); });
  it('scores trigger + member at 7', () => { expect(scoreWith(trigger, member)?.score).toBe(7); });
  it('scores payoff + payoff at 7', () => { expect(scoreWith(teamBuff, trigger)?.score).toBe(7); });
  it('scores buff + member at 6', () => { expect(scoreWith(teamBuff, member)?.score).toBe(6); });
  it('scores in-play-check + member at 6', () => { expect(scoreWith(check, member)?.score).toBe(6); });
  it('drops member + member (payoff-anchored)', () => { expect(scoreWith(member, member2)).toBeUndefined(); });
});

describe('Gargoyles detection', () => {
  const G = TRIBAL_SPECS.gargoyle;
  const memberOnly = createCard({id: 'brooklyn', name: 'Brooklyn', fullName: 'Brooklyn - Second in Command', cost: 2, classifications: ['Gargoyle'], text: 'Evasive STONE BY DAY If you have 3 or more cards in your hand, this character can\'t ready.'});
  const trigger = createCard({id: 'goliath', name: 'Goliath', fullName: 'Goliath - Guardian of Castle Wyvern', cost: 4, classifications: ['Hero', 'Gargoyle'], text: 'BE CAREFUL, ALL OF YOU Whenever one of your Gargoyle characters challenges another character, gain 1 lore.'});
  const targetBuff = createCard({id: 'demona', name: 'Demona', fullName: 'Demona - Imperious Spellcaster', cost: 3, classifications: ['Villain', 'Gargoyle'], text: 'IMPETUS IMPROVISUS Choose and discard a card — Chosen Gargoyle character gains Rush and Evasive until the start of your next turn.'});
  // "lose" team buff: shedding the tribe's Stone by Day drawback (Angela - Night Warrior).
  const loseBuff = createCard({id: 'angela', name: 'Angela', fullName: 'Angela - Night Warrior', cost: 3, classifications: ['Ally', 'Gargoyle'], text: 'ETERNAL NIGHT Your Gargoyle characters lose the Stone by Day ability.'});
  const discardCheck = createCard({id: 'coldstone', name: 'Coldstone', fullName: 'Coldstone - Reincarnated Cyborg', cost: 5, classifications: ['Ally', 'Gargoyle'], text: 'THE CANTRIPS HAVE BEEN SPOKEN When you play this character, if you have 2 or more Gargoyle character cards in your discard, gain 2 lore.'});

  it('tags a Stone by Day body with no payoff text as member only', () => {
    expect(getTribalRoles(memberOnly, G)).toEqual(['member']);
  });
  it('detects the tribal challenge trigger', () => {
    expect(getTribalRoles(trigger, G)).toEqual(['member', 'trigger']);
  });
  it('detects a single-target keyword grant', () => {
    expect(getTribalRoles(targetBuff, G)).toEqual(['member', 'buff']);
  });
  it('detects a "lose" team buff that strips the tribal drawback', () => {
    expect(getTribalRoles(loseBuff, G)).toEqual(['member', 'buff']);
  });
  it('detects the Gargoyles-in-discard count as an in-play check', () => {
    expect(getTribalRoles(discardCheck, G)).toEqual(['member', 'in-play-check']);
  });
});

describe('Gargoyles rule (payoff-anchored)', () => {
  const rule = getRuleById('gargoyle')!;
  const member = createCard({id: 'brooklyn', name: 'Brooklyn', classifications: ['Gargoyle'], text: 'Evasive.'});
  const member2 = createCard({id: 'lexington', name: 'Lexington', classifications: ['Gargoyle'], text: 'Alert.'});
  const trigger = createCard({id: 'goliath', name: 'Goliath', classifications: ['Gargoyle'], text: 'Whenever one of your Gargoyle characters challenges another character, gain 1 lore.'});
  const loseBuff = createCard({id: 'angela', name: 'Angela', classifications: ['Gargoyle'], text: 'Your Gargoyle characters lose the Stone by Day ability.'});
  const scoreWith = (a, b) => rule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  it('scores trigger + member at 7', () => { expect(scoreWith(trigger, member)?.score).toBe(7); });
  it('scores payoff + payoff at 7', () => { expect(scoreWith(loseBuff, trigger)?.score).toBe(7); });
  it('scores buff + member at 6', () => { expect(scoreWith(loseBuff, member)?.score).toBe(6); });
  it('drops member + member (payoff-anchored)', () => { expect(scoreWith(member, member2)).toBeUndefined(); });
});

describe('Madrigals detection', () => {
  const M = TRIBAL_SPECS.madrigal;
  const memberOnly = createCard({id: 'luisa', name: 'Luisa Madrigal', fullName: 'Luisa Madrigal - Pushing Through', cost: 1, classifications: ['Ally', 'Madrigal'], text: 'Challenger +2 (While challenging, this character gets +2 ¤.)'});
  const check = createCard({id: 'alma', name: 'Alma Madrigal', fullName: 'Alma Madrigal - Leading the Way', cost: 2, classifications: ['Mentor', 'Madrigal'], text: 'PROTECTING THE FAMILY When you play this character, if you have another Madrigal character in play, you may exert chosen opposing character.'});
  const itemCheck = createCard({id: 'arepas', name: "Julieta's Arepas", type: 'Item', cost: 1, text: 'FLAVORFUL CURE At the start of your turn, if you have a Madrigal character in play, remove up to 2 damage from chosen character.'});
  // "named Isabela Madrigal" is a Shift name reference, not a classification payoff.
  const namedShift = createCard({id: 'isabela', name: 'Isabela Madrigal', fullName: 'Isabela Madrigal - Caring Cultivator', cost: 6, classifications: ['Floodborn', 'Ally', 'Madrigal'], text: 'Shift 4 ⬡ (You may pay 4 ⬡ to play this on top of one of your characters named Isabela Madrigal.)'});

  it('tags a member with no payoff text as member only', () => {
    expect(getTribalRoles(memberOnly, M)).toEqual(['member']);
  });
  it('detects the "another Madrigal in play" check on a member', () => {
    expect(getTribalRoles(check, M)).toEqual(['member', 'in-play-check']);
  });
  it('detects the in-play check on a non-member item', () => {
    expect(getTribalRoles(itemCheck, M)).toEqual(['in-play-check']);
  });
  it('ignores a "named X Madrigal" Shift reference', () => {
    expect(getTribalRoles(namedShift, M)).toEqual(['member']);
  });
  it('ignores a name ending in the tribe word inside an in-play clause', () => {
    const namedCheck = createCard({id: 'named-mirabel', name: 'Antonio', cost: 2, text: 'If you have a character named Mirabel Madrigal in play, draw a card.'});
    expect(getTribalRoles(namedCheck, M)).toEqual([]);
  });
});

describe('Madrigals rule (payoff-anchored)', () => {
  const rule = getRuleById('madrigal')!;
  const member = createCard({id: 'luisa', name: 'Luisa Madrigal', classifications: ['Madrigal'], text: 'Challenger +2.'});
  const member2 = createCard({id: 'bruno', name: 'Bruno Madrigal', classifications: ['Madrigal'], text: 'Evasive.'});
  const check = createCard({id: 'alma', name: 'Alma Madrigal', classifications: ['Madrigal'], text: 'When you play this character, if you have another Madrigal character in play, you may exert chosen opposing character.'});
  const itemCheck = createCard({id: 'arepas', name: "Julieta's Arepas", type: 'Item', cost: 1, text: 'At the start of your turn, if you have a Madrigal character in play, remove up to 2 damage from chosen character.'});
  const scoreWith = (a, b) => rule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  it('scores in-play-check + member at 6', () => { expect(scoreWith(itemCheck, member)?.score).toBe(6); });
  it('scores payoff + payoff at 6 when only one helps the other', () => { expect(scoreWith(check, itemCheck)?.score).toBe(6); });
  it('drops member + member (payoff-anchored)', () => { expect(scoreWith(member, member2)).toBeUndefined(); });
});

describe('Villains detection', () => {
  const V = TRIBAL_SPECS.villain;
  const memberBuff = createCard({id: 'qoh', name: 'Queen of Hearts', fullName: 'Queen of Hearts - Wonderland Empress', cost: 3, classifications: ['Dreamborn', 'Villain', 'Queen'], text: 'ALL WAYS HERE ARE MY WAYS Whenever this character quests, your other Villain characters get +1 ◊ this turn.'});
  const nonMemberPayoff = createCard({id: 'diablo', name: 'Diablo', fullName: 'Diablo - Stone Servant', cost: 2, classifications: ['Dreamborn', 'Ally'], text: "CRUEL INTENT While you have a Villain character in play, this character gets +2 ¤ and +1 ◊. VILLAINOUS BOND While this character is exerted, your Villain characters can't be challenged."});

  it('detects the team buff on a member', () => {
    expect(getTribalRoles(memberBuff, V)).toEqual(['member', 'buff']);
  });
  it('detects the in-play check and team buff on a non-member', () => {
    expect(getTribalRoles(nonMemberPayoff, V)).toEqual(['buff', 'in-play-check']);
  });
  // Hero-side cards that hurt opposing Villains are hate, not payoffs for a Villain deck.
  it('ignores removal aimed at Villains', () => {
    const hate = createCard({id: 'little-john', name: 'Little John', cost: 2, text: 'When you play this character, choose one: • Chosen Hero character gains Resist +2 this turn. • Deal 2 damage to chosen Villain character.'});
    expect(getTribalRoles(hate, V)).toEqual([]);
  });
});

describe('Villains rule (payoff-anchored)', () => {
  const rule = getRuleById('villain')!;
  const member = createCard({id: 'ursula', name: 'Ursula', classifications: ['Villain'], text: 'Evasive.'});
  const member2 = createCard({id: 'jafar', name: 'Jafar', classifications: ['Villain'], text: 'Ward.'});
  const buff = createCard({id: 'qoh', name: 'Queen of Hearts', classifications: ['Villain'], text: 'Whenever this character quests, your other Villain characters get +1 ◊ this turn.'});
  const check = createCard({id: 'diablo', name: 'Diablo', text: 'While you have a Villain character in play, this character gets +2 ¤ and +1 ◊.'});
  const scoreWith = (a, b) => rule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  it('scores buff + member at 6', () => { expect(scoreWith(buff, member)?.score).toBe(6); });
  it('scores payoff + payoff at 6 when only one helps the other', () => { expect(scoreWith(buff, check)?.score).toBe(6); });
  it('drops member + member (payoff-anchored)', () => { expect(scoreWith(member, member2)).toBeUndefined(); });
});

// Fixes from the 2026-10-14 misread review. Real card text.

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

const royaltyRule = getRuleById('royalty')!;
/** The Royalty pair `card` finds with `partner`, or undefined when they do not pair. */
const royaltyPair = (card: LorcanaCard, partner: LorcanaCard) =>
  royaltyRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Payoffs that check for one rank, and members of each rank.
const agnarr = createCard({
  id: 'agnarr-king-of-arendelle',
  name: 'Agnarr',
  fullName: 'Agnarr - King of Arendelle',
  ink: 'Ruby',
  classifications: ['Storyborn', 'Mentor', 'King'],
  text: 'PROTECTIVE INSTINCT While you have a Queen\ncharacter in play, this character gets +2 ¤.',
});
const hans = createCard({
  id: 'hans-noble-scoundrel',
  name: 'Hans',
  fullName: 'Hans - Noble Scoundrel',
  ink: 'Sapphire',
  classifications: ['Storyborn', 'Villain', 'Prince'],
  text: 'ROYAL SCHEMES When you play this character, if a\nPrincess or Queen character is in play, gain 1 lore.',
});
const theQueen = createCard({
  id: 'the-queen-regal-monarch',
  name: 'The Queen',
  fullName: 'The Queen - Regal Monarch',
  cost: 1,
  classifications: ['Storyborn', 'Villain', 'Queen'],
  text: '',
});
const belleAndBeast = createCard({
  id: 'belle-and-beast-certain-as-the-sun',
  name: 'Belle & Beast',
  fullName: 'Belle & Beast - Certain as the Sun',
  ink: 'Ruby',
  ink2: 'Sapphire',
  cost: 8,
  classifications: ['Storyborn', 'Team', 'Hero', 'Prince', 'Princess'],
  text: "Shift 6 ⬡ (You may pay 6 ⬡ to play this on top of\none of your characters named Belle or Beast.)\nINSPIRING DANCE Whenever this character quests,\nready all cards in your inkwell.\nAPPRECIATIVE AUDIENCE 6 ⬡ — Ready your other\ncharacters. They can't quest for the rest of this turn.",
});

describe('Tribes: a payoff that names one rank', () => {
  it('pairs it only with members of a rank its text names, from either side', () => {
    expect(royaltyPair(agnarr, theQueen)?.score).toBe(6);
    expect(royaltyPair(hans, belleAndBeast)?.score).toBe(6);
    expect(royaltyPair(agnarr, beast)).toBeUndefined();
    expect(royaltyPair(beast, hans)).toBeUndefined();
  });

  it('scores two payoffs that neither switches on at the same-deck 5', () => {
    expect(royaltyPair(agnarr, hans)).toMatchObject({
      score: 5,
      explanation: '{A} and {B} both go in a Royalty deck.',
    });
  });
});

const heroRule = getRuleById('hero')!;
/** The Heroes pair `card` finds with `partner`, or undefined when they do not pair. */
const heroPair = (card: LorcanaCard, partner: LorcanaCard) =>
  heroRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Two Hero payoffs that aren't Heroes, and a Hero whose buff counts only other Heroes.
const littleJohn = createCard({
  id: 'little-john-sir-reginald',
  name: 'Little John',
  fullName: 'Little John - Sir Reginald',
  ink: 'Steel',
  cost: 2,
  classifications: ['Storyborn', 'Ally'],
  text: 'WHAT A BEAUTIFUL BRAWL! When you play this\ncharacter, choose one:\n• Chosen Hero character gains Resist +2 this turn.\n(Damage dealt to them is reduced by 2.)\n• Deal 2 damage to chosen Villain character.',
});
const oneLastHope = createCard({
  id: 'one-last-hope',
  name: 'One Last Hope',
  fullName: 'One Last Hope',
  type: 'Action',
  ink: 'Steel',
  cost: 3,
  text: '(A character with cost 3 or more can ⟳ to sing this\nsong for free.)\nChosen character gains Resist +2 until the start of your\nnext turn. If a Hero character is chosen, they can also\nchallenge ready characters this turn. (Damage dealt to\nthem is reduced by 2.)',
});
const princePhillip = createCard({
  id: 'prince-phillip-warden-of-the-woods',
  name: 'Prince Phillip',
  fullName: 'Prince Phillip - Warden of the Woods',
  ink: 'Emerald',
  cost: 4,
  classifications: ['Dreamborn', 'Hero', 'Prince'],
  text: "SHINING BEACON Your other Hero characters\ngain Ward. (Opponents can't choose them except\nto challenge.)",
});

describe('Tribes: two payoffs score what each gives the other', () => {
  it('scores two that help neither at the same-deck 5, from either side', () => {
    for (const [card, partner] of [
      [littleJohn, oneLastHope],
      [oneLastHope, littleJohn],
    ]) {
      expect(heroPair(card, partner)).toMatchObject({
        score: 5,
        explanation: '{A} and {B} both go in a Hero deck.',
      });
    }
  });

  it("scores one that helps the other at its own member pair's 6", () => {
    expect(heroPair(littleJohn, princePhillip)).toMatchObject({
      score: 6,
      explanation: "{A}'s Hero buff powers up {B}.",
    });
    expect(heroPair(princePhillip, littleJohn)?.score).toBe(6);
  });
});
