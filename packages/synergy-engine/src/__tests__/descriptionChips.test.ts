import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import type {LorcanaCard} from '../types';
import {createCard} from './fixtures.js';

// Every synergy line names its cards with chip tokens: {A} is the card whose page shows the tile,
// {B} its partner. These cases pin the lines whose words follow which card holds which role, read
// from both pages where the direction matters. Named cards use their real text.

/** The line `card`'s page shows on `partner`'s tile for one rule, or undefined when they don't pair. */
function line(ruleId: string, card: LorcanaCard, partner: LorcanaCard): string | undefined {
  return getRuleById(ruleId)!
    .findSynergies(card, [card, partner])
    .find((m) => m.card.id === partner.id)?.explanation;
}

interface LineCase {
  name: string;
  card: LorcanaCard;
  partner: LorcanaCard;
  expected: string;
}

describe('Classification tribes', () => {
  const aurora = createCard({
    id: 'aurora',
    name: 'Aurora',
    classifications: ['Princess'],
    text: 'Quests for 2.',
  });
  const beast = createCard({
    id: 'beast',
    name: 'Beast',
    classifications: ['Prince'],
    text: 'Your Princess characters get +1 ¤ and +1 ⛉.',
  });
  const hans = createCard({
    id: 'hans',
    name: 'Hans',
    classifications: ['Prince'],
    text: 'When you play this character, if a Princess character is in play, gain 1 lore.',
  });
  const vanellope = createCard({
    id: 'vanellope',
    name: 'Vanellope',
    classifications: ['Princess'],
    text: 'Whenever you play another Princess character, draw a card.',
  });
  const tiana = createCard({
    id: 'tiana',
    name: 'Tiana',
    classifications: ['Princess'],
    text: 'Whenever you play another Princess character, gain 1 lore.',
  });
  const jasmine = createCard({
    id: 'jasmine',
    name: 'Jasmine',
    classifications: ['Princess'],
    text: 'When you play this character, if you have another Princess character in play, gain 1 lore.',
  });
  const belle = createCard({
    id: 'belle',
    name: 'Belle',
    classifications: ['Princess'],
    text: 'When you play this character, if you have another Princess character in play, draw a card.',
  });
  const nervous = createCard({
    id: 'nervous',
    name: "Don't Be Nervous",
    type: 'Action',
    text: 'Search your deck for a Princess character card, reveal that card to all players, and put it into your hand.',
  });

  it.each<LineCase>([
    {
      name: 'a buff, from the payoff',
      card: beast,
      partner: aurora,
      expected: "{A}'s Princess buff powers up {B}.",
    },
    {
      name: 'a buff, from the member',
      card: aurora,
      partner: beast,
      expected: "{B}'s Princess buff powers up {A}.",
    },
    {
      name: 'an in-play check',
      card: hans,
      partner: aurora,
      expected: "{B} can make {A}'s Princess ability trigger.",
    },
    {
      name: 'a trigger',
      card: aurora,
      partner: vanellope,
      expected: "{A} triggers {B}'s Princess ability.",
    },
    {
      name: 'two triggers',
      card: vanellope,
      partner: tiana,
      expected: "{A} and {B} trigger each other's Princess abilities.",
    },
    {
      name: 'a search, from the search',
      card: nervous,
      partner: aurora,
      expected: '{A} can reveal {B} from your deck.',
    },
    {
      name: 'a search, from the member',
      card: aurora,
      partner: nervous,
      expected: '{B} can reveal {A} from your deck.',
    },
    {
      name: 'a search beside a payoff',
      card: beast,
      partner: nervous,
      expected: '{B} can reveal Princess characters for {A}.',
    },
  ])('names each card by its role: $name', ({card, partner, expected}) => {
    expect(line('princess', card, partner)).toBe(expected);
  });

  it.each<LineCase>([
    {
      name: 'neither',
      card: beast,
      partner: hans,
      expected: '{A} and {B} both go in a Princess deck.',
    },
    {name: 'one', card: beast, partner: jasmine, expected: "{A}'s Princess buff powers up {B}."},
    {
      name: 'each',
      card: jasmine,
      partner: belle,
      expected: "{A} and {B} are both Princess characters, and each one's ability helps the other.",
    },
  ])('splits two payoffs by whose ability counts the other: $name', ({card, partner, expected}) => {
    expect(line('princess', card, partner)).toBe(expected);
  });
});

describe('Items, Floodborns and Hunny', () => {
  const lantern = createCard({
    id: 'lantern',
    name: 'Lantern',
    type: 'Item',
    text: 'The next character you play this turn costs 1 ⬡ less.',
  });
  const norton = createCard({
    id: 'norton',
    name: 'Norton Nimnul',
    text: 'Once during your turn, whenever you play an item, chosen opposing character gets -2 ¤ this turn.',
  });
  const dug = createCard({
    id: 'dug',
    name: 'Dug',
    text: 'When you play this character, if you have an item in play, draw a card.',
  });
  const gadget = createCard({
    id: 'gadget',
    name: 'Gadget Hackwrench',
    text: 'When you play this character, you may play an item with cost 3 or less for free.',
  });

  const liShang = createCard({
    id: 'li-shang',
    name: 'Li Shang',
    fullName: 'Li Shang - Valiant Leader',
    cost: 7,
    classifications: ['Floodborn', 'Hero', 'Captain'],
    keywords: ['Shift 4'],
    text: 'Shift 4 ⬡ (You may pay 4 ⬡ to play this on top of one of your characters named Li Shang.)',
  });
  const gaston = createCard({
    id: 'gaston',
    name: 'Gaston',
    fullName: 'Gaston - Created by the Vine',
    cost: 2,
    classifications: ['Floodborn', 'Vineling'],
    text: 'DRAWING STRENGTH Your Floodborn characters get +1 ¤.',
  });
  const hera = createCard({
    id: 'hera',
    name: 'Hera',
    fullName: 'Hera - Created by the Vine',
    cost: 5,
    classifications: ['Floodborn', 'Queen', 'Deity', 'Vineling'],
    text: 'MYSTICAL BOON Whenever you play this or another Floodborn character, gain 1 lore.',
  });
  const ringOfStones = createCard({
    id: 'ring-of-stones',
    name: 'Ring of Stones',
    fullName: 'Ring of Stones - Taken by the Vine',
    type: 'Location',
    cost: 4,
    text: 'DEEP WISDOM Your Floodborn characters get +1 ◊.',
  });

  const kanga = createCard({
    id: 'kanga',
    name: 'Kanga',
    fullName: 'Kanga - Hunny Bard',
    classifications: ['Dreamborn', 'Ally', 'Hunny'],
    keywords: ['Singer 5'],
    text: 'Singer 5 (This character counts as cost 5 to sing songs.)',
  });
  const winnie = createCard({
    id: 'winnie',
    name: 'Winnie the Pooh',
    fullName: 'Winnie the Pooh - Hunny Archmage',
    cost: 2,
    classifications: ['Dreamborn', 'Hero', 'Sorcerer', 'Hunny'],
    text: 'STICK TOGETHER While you have 2 or more other Hunny characters in play, this character gets +2 ◊.',
  });
  const gopher = createCard({
    id: 'gopher',
    name: 'Gopher',
    fullName: 'Gopher - Hunny Cook',
    cost: 2,
    classifications: ['Dreamborn', 'Ally', 'Hunny'],
    text: "DOWN THE HOLE This character may enter play exerted. FORTIFYING MEAL During an opponent's turn, while this character is exerted, your other Hunny characters gain Resist +1.",
  });
  const rabbit = createCard({
    id: 'rabbit',
    name: 'Rabbit',
    fullName: 'Rabbit - Hunny Paladin',
    cost: 4,
    classifications: ['Dreamborn', 'Ally', 'Knight', 'Hunny'],
    text: 'HUNNY AURA When you play this character, chosen Hunny character gets +1 ◊ this turn.',
  });
  const piglet = createCard({
    id: 'piglet',
    name: 'Piglet',
    cost: 2,
    classifications: ['Hunny'],
    text: 'When you play this character, chosen Hunny character gains Evasive this turn.',
  });

  it.each<LineCase & {rule: string}>([
    {
      rule: 'items',
      name: 'an item engine, from the engine',
      card: gadget,
      partner: norton,
      expected: '{A} helps you play more items, and they activate {B}.',
    },
    {
      rule: 'items',
      name: 'an item engine, from the payoff',
      card: norton,
      partner: gadget,
      expected: '{B} helps you play more items, and they activate {A}.',
    },
    {
      rule: 'items',
      name: 'an item beside a trigger',
      card: lantern,
      partner: norton,
      expected: 'Playing {A} triggers {B}\'s "whenever you play an item" ability.',
    },
    {
      rule: 'items',
      name: 'an item beside an in-play check',
      card: dug,
      partner: lantern,
      expected: "{B} can activate {A}'s item ability.",
    },
    {
      rule: 'floodborn',
      name: 'a Floodborn buff',
      card: gaston,
      partner: liShang,
      expected: "{A}'s Floodborn buff powers up {B}.",
    },
    {
      rule: 'floodborn',
      name: 'a Floodborn trigger',
      card: liShang,
      partner: hera,
      expected: "{A} triggers {B}'s Floodborn ability.",
    },
    {
      rule: 'floodborn',
      name: 'two Floodborn payoffs, one counting the other',
      card: gaston,
      partner: ringOfStones,
      expected: "{B}'s Floodborn buff powers up {A}.",
    },
    {
      rule: 'floodborn',
      name: 'two Floodborn payoffs, each counting the other',
      card: gaston,
      partner: hera,
      expected:
        "{A} and {B} are both Floodborn characters, and each one's ability helps the other.",
    },
    {
      rule: 'hunny',
      name: 'a Hunny density payoff',
      card: winnie,
      partner: kanga,
      expected: "{B} activates {A}'s Hunny ability.",
    },
    {
      rule: 'hunny',
      name: 'a Hunny team buff',
      card: kanga,
      partner: gopher,
      expected: "{B}'s Hunny buff powers up {A}.",
    },
    {
      rule: 'hunny',
      name: 'two Hunny buffs',
      card: rabbit,
      partner: piglet,
      expected: '{A} and {B} can each buff the other.',
    },
  ])('$name', ({rule, card, partner, expected}) => {
    expect(line(rule, card, partner)).toBe(expected);
  });
});

describe('Toys and Seven Dwarfs', () => {
  const woody = createCard({
    id: 'woody',
    name: 'Woody',
    fullName: 'Woody - Leader of the Toys',
    cost: 4,
    classifications: ['Storyborn', 'Hero', 'Toy'],
    text: "LET'S GO HOME When you play this character, look at the top 4 cards of your deck. You may reveal a Toy character card or a location card named Andy's Room and put it into your hand. Put the rest on the bottom of your deck in any order.",
  });
  const friend = createCard({
    id: 'friend',
    name: "You've Got a Friend in Me",
    type: 'Action',
    cost: 3,
    classifications: ['Song'],
    text: '(A character with cost 3 or more can ⟳ to sing this song for free.) Look at the top 4 cards of your deck. You may reveal up to 2 Toy character cards and put them into your hand. Put the rest on the bottom of your deck in any order.',
  });
  const bullseye = createCard({
    id: 'bullseye',
    name: 'Bullseye',
    fullName: 'Bullseye - Loyal Horse',
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: "LET'S RIDE If you have a character named Woody or Jessie in play, you pay 1 ⬡ less to play this character.",
  });
  const bestBuddies = createCard({
    id: 'best-buddies',
    name: 'Woody & Buzz Lightyear',
    fullName: 'Woody & Buzz Lightyear - Best Buddies',
    cost: 7,
    classifications: ['Storyborn', 'Team', 'Hero', 'Toy', 'Captain'],
    keywords: ['Shift 5'],
    text: 'Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your characters named Woody or Buzz Lightyear.)',
  });
  const rex = createCard({
    id: 'rex',
    name: 'Rex',
    fullName: 'Rex - Protective Dinosaur',
    cost: 2,
    classifications: ['Storyborn', 'Ally', 'Dinosaur', 'Toy'],
    text: "RUN AWAY! During an opponent's turn, when this character is banished, gain 1 lore.",
  });
  const jingleJoe = createCard({
    id: 'jingle-joe',
    name: 'Jingle Joe',
    fullName: "Jingle Joe - Sid's Toy",
    cost: 2,
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: 'TURN OUT THE LIGHT During your turn, whenever one of your other Toy characters is banished, chosen character of yours gains Evasive until the start of your next turn.',
  });

  const grumpy = createCard({
    id: 'grumpy',
    name: 'Grumpy',
    fullName: 'Grumpy - Soreheaded Miner',
    cost: 7,
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
  });
  const doc = createCard({
    id: 'doc',
    name: 'Doc',
    fullName: 'Doc - Taking Notes',
    cost: 4,
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
    text: 'SHARE KNOWLEDGE When you play this character, if you have another Seven Dwarfs character or a Princess character in play, draw a card.',
  });
  const rightBehindYou = createCard({
    id: 'right-behind-you',
    name: 'Right Behind You',
    type: 'Action',
    text: 'Draw a card. If you have a Seven Dwarfs character and a Princess character in play, you may play a Seven Dwarfs character for free.',
  });
  const dontBeNervous = createCard({
    id: 'dont-be-nervous',
    name: "Don't Be Nervous",
    type: 'Action',
    cost: 5,
    text: 'Search your deck for a Princess character card, reveal that card to all players, and put it into your hand. Then, shuffle your deck. If you have 2 or more Seven Dwarfs characters in play, draw 2 cards and gain 2 lore.',
  });
  const snowWhite = createCard({
    id: 'snow-white',
    name: 'Snow White',
    fullName: 'Snow White - Merry as the Morning',
    classifications: ['Dreamborn', 'Hero', 'Princess'],
    text: 'CLARION CALL Whenever this character quests, you may return chosen Seven Dwarfs character of yours to your hand to draw a card.',
  });

  it('names the Toy a search fetches, even when that Toy has a search of its own', () => {
    expect(line('toy', woody, friend)).toBe('{B} fetches {A} from the deck. Direct tribal access.');
    expect(line('toy', friend, woody)).toBe('{A} fetches {B} from the deck. Direct tribal access.');
  });

  it("reads a Toy payoff by what its text counts: a team card meets Bullseye's Woody through its first half", () => {
    expect(line('toy', bullseye, bestBuddies)).toBe("{B} can activate {A}'s Toy ability.");
    expect(line('toy', bestBuddies, bullseye)).toBe("{A} can activate {B}'s Toy ability.");
  });

  it("reads two Toy payoffs as one-way when only one card's text counts the other", () => {
    expect(line('toy', rex, jingleJoe)).toBe("{A} can activate {B}'s Toy ability.");
  });

  it.each<LineCase>([
    {
      name: 'a recruit, from the recruit',
      card: rightBehindYou,
      partner: grumpy,
      expected: '{A} can play {B} for free.',
    },
    {
      name: 'a recruit, from the Dwarf',
      card: grumpy,
      partner: rightBehindYou,
      expected: '{B} can play {A} for free.',
    },
    {
      name: 'a recruit beside a payoff that is not a Dwarf',
      card: rightBehindYou,
      partner: dontBeNervous,
      expected: '{A} can play a Seven Dwarfs character for free, which helps activate {B}.',
    },
    {
      name: 'a density payoff',
      card: grumpy,
      partner: doc,
      expected: "{A} activates {B}'s Seven Dwarfs ability.",
    },
    {
      name: 'a return',
      card: snowWhite,
      partner: grumpy,
      expected: '{A} returns {B} to your hand and draws a card, so you can replay it.',
    },
  ])('Seven Dwarfs: $name', ({card, partner, expected}) => {
    expect(line('dwarfs', card, partner)).toBe(expected);
  });
});

describe('Location Control and Ramp', () => {
  const transportPod = createCard({
    id: 'transport-pod',
    name: 'Transport Pod',
    type: 'Item',
    cost: 1,
    text: "GIVE 'EM A SHOW At the start of your turn, you may move a character of yours to a location for free.",
  });
  const agrabah = createCard({
    id: 'agrabah',
    name: 'Agrabah',
    fullName: 'Agrabah - Marketplace',
    type: 'Location',
    cost: 3,
  });
  const heiHei = createCard({
    id: 'heihei',
    name: 'HeiHei',
    fullName: 'HeiHei - At the Crosswalk',
    cost: 2,
    text: 'AIMLESS WANDERING Once during your turn, if this character is at a location, you may move him to another location for free. If you do, gain 1 lore.',
  });
  const chiefTui = createCard({
    id: 'chief-tui',
    name: 'Chief Tui',
    fullName: 'Chief Tui - Weaving a Tale',
    cost: 5,
    text: 'AND THEN... Once during your turn, whenever a card is put into your inkwell, look at the top card of your deck. You may put it on either the top or the bottom of your deck.',
  });
  const pluto = createCard({
    id: 'pluto',
    name: 'Pluto',
    fullName: 'Pluto - Friendly Pooch',
    cost: 1,
    text: 'GOOD DOG ⟳ — You pay 1 ⬡ less for the next character you play this turn.',
  });

  it.each<LineCase & {rule: string}>([
    {
      rule: 'location-move',
      name: 'a support beside a location, from the support',
      card: transportPod,
      partner: agrabah,
      expected: '{A} moves characters to {B}.',
    },
    {
      rule: 'location-move',
      name: 'a support beside a location, from the location',
      card: agrabah,
      partner: transportPod,
      expected: '{B} moves characters to {A}.',
    },
    {
      rule: 'location-at-payoff',
      name: 'two supports, only the searcher in this role',
      card: heiHei,
      partner: transportPod,
      expected: '{A} rewards having characters at locations.',
    },
    {
      rule: 'location-move',
      name: 'two supports, both in this role',
      card: transportPod,
      partner: heiHei,
      expected: '{A} and {B} both move characters to locations.',
    },
    {
      rule: 'ramp',
      name: 'an inkwell trigger beside a discount, from the trigger',
      card: chiefTui,
      partner: pluto,
      expected: '{A} rewards cards going into your inkwell, and {B} gives ink discounts.',
    },
    {
      rule: 'ramp',
      name: 'an inkwell trigger beside a discount, from the discount',
      card: pluto,
      partner: chiefTui,
      expected: '{B} rewards cards going into your inkwell, and {A} gives ink discounts.',
    },
  ])('$name ($rule)', ({rule, card, partner, expected}) => {
    expect(line(rule, card, partner)).toBe(expected);
  });
});
