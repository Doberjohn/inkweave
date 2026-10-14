import {describe, it, expect} from 'vitest';
import {getRuleById, SynergyEngine} from '../engine';
import {getLocationRoles} from '../utils';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Location Control fixes: a buff (#628) or a move limited to one location classification
// ("Your Hyperia City locations get +2 ⛉.", "move him to a Hyperia City location") reaches only
// locations of that classification, and the clear misreads from the 2026-10-14 review stay
// fixed. Kept out of rules.test.ts (CodeScene: function count). Named cards use their real text.

const engine = new SynergyEngine();
/** The pair's Location Control score with `card` as the searcher, or undefined when they do not pair. */
const locationScore = (card: LorcanaCard, partner: LorcanaCard) =>
  engine
    .findSynergies(card, [card, partner])
    .find((g) => g.groupKey === 'location-control')
    ?.synergies.find((s) => s.card.id === partner.id)?.score;

const express = createCard({
  id: 'hyperia-city-express',
  name: 'Hyperia City Express',
  fullName: 'Hyperia City Express',
  type: 'Item',
  ink: 'Steel',
  text: 'EASY COMMUTE ⟳ — Move a character of yours to a location for free.\nSTYLISH CONVENIENCE Your Hyperia City locations get +2 ⛉.',
});
const hyperiaLocation = createCard({
  id: 'port-authority-center-hub',
  name: 'Port Authority',
  fullName: 'Port Authority - Center Hub',
  type: 'Location',
  ink: 'Amber',
  classifications: ['Hyperia City'],
  text: 'WELCOME TO TOWN Once during your turn, whenever a character moves here, each player gets 1 ink drop and gains 1 lore. (Each ink drop may be removed to pay 1 ⬡.)',
});
const plainLocation = createCard({
  id: 'plain-location',
  name: 'Quiet Corner',
  fullName: 'Quiet Corner - Anywhere',
  type: 'Location',
  ink: 'Amber',
  text: 'RESTFUL Characters get +1 ◊ while here.',
});

describe('Location Control: a buff limited to one location classification', () => {
  it('scores the buff 7 with a location of that classification, from both sides', () => {
    expect(locationScore(express, hyperiaLocation)).toBe(7);
    expect(locationScore(hyperiaLocation, express)).toBe(7);
  });

  it('falls back to the move role (5) with any other location, from both sides', () => {
    expect(locationScore(express, plainLocation)).toBe(5);
    expect(locationScore(plainLocation, express)).toBe(5);
  });

  it('gives a buff-only card no match with a location outside its classification', () => {
    const buffOnly = createCard({id: 'hyperia-buff-only', type: 'Item', text: 'Your Hyperia City locations get +1 ◊.'});
    expect(locationScore(buffOnly, plainLocation)).toBeUndefined();
  });

  it('keeps lowercase and mixed buffs reaching every location', () => {
    const village = createCard({
      id: 'well-save-our-village',
      name: "We'll Save Our Village",
      fullName: "We'll Save Our Village",
      type: 'Action',
      ink: 'Steel',
      classifications: ['Song'],
      text: '(A character with cost 2 or more can ⟳ to sing this\nsong for free.)\nYour characters and locations gain Resist +1 until\nthe start of your next turn. (Damage dealt to them is\nreduced by 1.)',
    });
    const mixed = createCard({
      id: 'mixed-buff',
      type: 'Item',
      text: 'Your Hyperia City locations get +2 ⛉. Your locations gain Resist +1.',
    });
    expect(locationScore(village, plainLocation)).toBe(7);
    expect(locationScore(mixed, plainLocation)).toBe(7);
  });
});

// A move named by pronoun ("move him to ...") is a move, and a move limited to one location
// classification ("a Hyperia City location") reaches only locations of that classification.
describe('Location Control: pronoun moves and a move limited to one location classification', () => {
  const bogo = createCard({
    id: 'chief-bogo-police-commissioner',
    name: 'Chief Bogo',
    fullName: 'Chief Bogo - Police Commissioner',
    ink: 'Steel',
    text: 'I KNOW THESE STREETS Whenever this character quests, you may move him to a Hyperia City location for free.\nSTOP RIGHT THERE 6 ⬡ — Chosen opposing character can’t challenge until the start of your next turn.',
  });
  const hathi = createCard({
    id: 'colonel-hathi-on-the-march',
    name: 'Colonel Hathi',
    fullName: 'Colonel Hathi - On the March',
    ink: 'Ruby',
    text: 'HUP, TWO, THREE, FOUR Whenever this character\nquests, you may move him to one of your locations\nfor free.',
  });

  it('pairs a classified move (5) with a location of that classification, from both sides', () => {
    expect(locationScore(bogo, hyperiaLocation)).toBe(5);
    expect(locationScore(hyperiaLocation, bogo)).toBe(5);
  });

  it('gives a classified move no match with a location outside its classification', () => {
    expect(getLocationRoles(bogo)).toEqual(['move']);
    expect(locationScore(bogo, plainLocation)).toBeUndefined();
    expect(locationScore(plainLocation, bogo)).toBeUndefined();
  });

  it('keeps the classification when the same sentence names "that location" again', () => {
    const trailing = createCard({
      id: 'trailing-that-location',
      text: "Whenever this character quests, you may move him to a Hyperia City location for free and gain lore equal to that location's ◊.",
    });
    expect(locationScore(trailing, hyperiaLocation)).toBe(5);
    expect(locationScore(trailing, plainLocation)).toBeUndefined();
  });

  it('reads "move them to that location" as a move', () => {
    const peopleGonnaComeHere = createCard({
      id: 'people-gonna-come-here',
      type: 'Action',
      ink: 'Steel',
      classifications: ['Song'],
      text: '(A character with cost 7 or more can ⟳ to sing this song for free.)\nPlay a location from your hand or discard for free. If a character sang this song, you may move them to that location for free.',
    });
    expect(getLocationRoles(peopleGonnaComeHere)).toContain('move');
  });

  it('reads "move him to one of your locations" as a global move, not a buff', () => {
    expect(getLocationRoles(hathi)).toEqual(['move']);
    expect(locationScore(hathi, plainLocation)).toBe(5);
  });

  it('keeps a move whose card mentions damage outside the move clause', () => {
    const gamesAfoot = createCard({
      id: 'the-games-afoot',
      type: 'Action',
      ink: 'Steel',
      text: 'Move up to 2 of your characters to the same location for free.\nThat location gains Resist +2 until the start of your next turn.\n(Damage dealt to it is reduced by 2.)',
    });
    expect(getLocationRoles(gamesAfoot)).toContain('move');
  });

  it('keeps a buff that gives an effect "to your locations", even after a move in its sentence', () => {
    const giveBuff = createCard({id: 'give-to-locations', type: 'Item', text: 'Give Resist +1 to your locations.'});
    const moveThenBuff = createCard({
      id: 'move-then-give',
      text: 'Move him to one of your locations, then give Resist +1 to your locations.',
    });
    expect(getLocationRoles(giveBuff)).toEqual(['buff']);
    expect(locationScore(giveBuff, plainLocation)).toBe(7);
    expect(getLocationRoles(moveThenBuff)).toEqual(['move', 'buff']);
  });

  it('keeps a location move written after a damage-moving clause, in the next sentence or the same one', () => {
    const nextSentence = createCard({
      id: 'damage-then-move',
      text: 'Move 1 damage counter from chosen character to chosen opposing character. Move him to one of your locations for free.',
    });
    const sameSentence = createCard({
      id: 'damage-then-move-same-sentence',
      text: 'Move 1 damage counter from a character to another character, then move him to a location.',
    });
    expect(getLocationRoles(nextSentence)).toContain('move');
    expect(getLocationRoles(sameSentence)).toContain('move');
  });

  it('never reads a damage-moving clause as a location move', () => {
    const damageOnly = createCard({
      id: 'damage-move-only',
      text: 'Move 1 damage counter from a character at a location to chosen opposing character.',
    });
    expect(getLocationRoles(damageOnly)).not.toContain('move');
  });

  it('reads a move that carries a second character as a move', () => {
    const carl = createCard({
      id: 'carl-fredricksen-on-the-move',
      ink: 'Ruby',
      text: 'MOVING PARTNER Whenever you play a location,\nyou may move this character and up to 1 of your\nother characters to that location for free.',
    });
    expect(getLocationRoles(carl)).toContain('move');
  });
});

// Clear misreads (2026-10-14 false-pairs review): each case uses the card's real text.
describe('Location Control: clauses that reach fewer locations than they seem to', () => {
  const location = (id: string, fields: Partial<LorcanaCard>) =>
    createCard({id, name: id, fullName: id, type: 'Location', ink: 'Ruby', lore: 1, moveCost: 1, ...fields});
  const cheapLocation = location('cheap-location', {cost: 3});
  const dearLocation = location('dear-location', {cost: 4});
  const loreless = location('loreless-location', {lore: 0});
  const freeToMoveTo = location('free-to-move-to', {moveCost: 0});
  const getToSafety = createCard({
    id: 'get-to-safety',
    type: 'Action',
    ink: 'Ruby',
    cost: 1,
    text: 'Play a location with cost 3 or less from your discard for\nfree. Then, if you have a location named Sleepy Hollow\nin play, draw a card.',
  });
  const raksha = createCard({
    id: 'raksha-fearless-mother',
    ink: 'Ruby',
    text: 'ON PATROL Once during your turn, you may pay\n1 ⬡ less to move this character to a location.',
  });
  const shenzi = createCard({
    id: 'shenzi-hyena-pack-leader',
    ink: 'Emerald',
    text: "I'LL HANDLE THIS While this character is at a location,\nshe gets +3 ¤.\nWHAT'S THE HURRY? While this character is at a location,\nwhenever she challenges another character, you may\ndraw a card.",
  });
  const carl = createCard({
    id: 'carl-fredricksen-on-the-move',
    ink: 'Ruby',
    text: "MOVING PARTNER Whenever you play a location,\nyou may move this character and up to 1 of your\nother characters to that location for free.\nADVENTURE AWAITS Whenever this character\nquests while at a location, draw cards equal to\nthat location's ◊.",
  });

  it('reads no location reward from a named location or from a card under one', () => {
    const woody = createCard({
      id: 'woody-leader-of-the-toys',
      text: "LET'S GO HOME When you play this character,\nlook at the top 4 cards of your deck. You may\nreveal a Toy character card or a location card\nnamed Andy's Room and put it into your hand.\nPut the rest on the bottom of your deck in\nany order.",
    });
    const flintheart = createCard({
      id: 'flintheart-glomgold-scheming-billionaire',
      ink: 'Emerald',
      text: "TRY ME While you have a character or location in\nplay with a card under them, this character gains\nWard. (Opponents can't choose them except to\nchallenge.)",
    });
    expect(getLocationRoles(woody)).toEqual([]);
    expect(getLocationRoles(flintheart)).toEqual([]);
    expect(getLocationRoles(getToSafety)).toEqual(['location-ramp']);
    expect(locationScore(woody, plainLocation)).toBeUndefined();
  });

  it('keeps a location play capped by cost to the locations under its cap, from both sides', () => {
    expect(locationScore(getToSafety, cheapLocation)).toBe(7);
    expect(locationScore(cheapLocation, getToSafety)).toBe(7);
    expect(locationScore(getToSafety, dearLocation)).toBeUndefined();
    expect(locationScore(dearLocation, getToSafety)).toBeUndefined();
  });

  it('reads neither a free move after a location play nor a location play as its trigger', () => {
    const fergus = createCard({
      id: 'fergus-outpost-builder',
      ink: 'Steel',
      text: 'JUST THE SPOT During your turn, whenever this\ncharacter becomes exerted, you may play a location\nfrom your hand or discard with cost 4 or less for free.\nHOLD FAST While this character is at a location,\nwhenever a location is challenged and banished, you\nmay deal 4 damage to chosen character.',
    });
    expect(getLocationRoles(carl)).toEqual(['at-payoff', 'move', 'play-trigger']);
    expect(getLocationRoles(fergus)).toEqual(['at-payoff', 'location-ramp']);
  });

  it("reads a discount on a character's own move as a move: no ramp at a free move, no play-ramp partners", () => {
    const raya = createCard({
      id: 'raya-determined-explorer',
      ink: 'Steel',
      text: 'TO THE ENDS OF THE REALM This character gets\n+1 ◊ for each location you have in play.',
    });
    const fatCat = createCard({
      id: 'fat-cat-criminal-businessman',
      ink: 'Steel',
      text: 'WORTHY INVESTMENT Your locations gain Resist\n+1. (Damage dealt to them is reduced by 1.)',
    });
    expect(locationScore(raksha, cheapLocation)).toBe(7);
    expect(locationScore(raksha, freeToMoveTo)).toBe(5);
    expect(locationScore(raksha, raya)).toBeUndefined();
    expect(locationScore(raksha, fatCat)).toBe(5);
  });

  it('links no two clauses that each concern only their own character', () => {
    const arthur = createCard({
      id: 'arthur-merlins-assistant',
      ink: 'Steel',
      text: 'MAGICAL TRAVEL When you play this character, you\nmay move him to a location for free.\nARCANE DELIVERIES Once during your turn, whenever\nthis character moves to a location, get 1 ink drop. (You\nmay remove an ink drop to pay 1 ⬡.)',
    });
    const goofy = createCard({
      id: 'goofy-set-for-adventure',
      ink: 'Emerald',
      text: 'FAMILY VACATION Once during your turn,\nwhenever this character moves to a location,\nyou may move one of your other characters to\nthat location for free. If you do, draw a card.',
    });
    const carlAndRussell = createCard({
      id: 'carl-fredricksen-and-russell-intrepid-explorers',
      ink: 'Emerald',
      text: 'OUTDOOR SKILLS While this character is at a location,\nall characters at that location get +1 ◊ and gain Evasive.\n(Only characters with Evasive can challenge them.)',
    });
    expect(locationScore(arthur, shenzi)).toBeUndefined();
    expect(locationScore(raksha, goofy)).toBeUndefined();
    expect(locationScore(goofy, shenzi)).toBe(5);
    expect(locationScore(arthur, goofy)).toBe(5);
    expect(locationScore(raksha, carlAndRussell)).toBe(5);
  });

  it('keeps cards put under locations "with Boost" to locations that have Boost', () => {
    const recoveredPage = createCard({
      id: 'recovered-page',
      type: 'Item',
      text: 'WHAT IS TO COME When you play this item, look at the top 4\ncards of your deck. You may reveal a character card and put\nit into your hand. Put the rest on the bottom of your deck in\nany order.\nWHISPERED POWER 1 ⬡, Banish this item — Put the top\ncard of your deck facedown under one of your characters or\nlocations with Boost.',
    });
    const bagpipes = createCard({
      id: 'blessed-bagpipes',
      type: 'Item',
      ink: 'Emerald',
      text: 'MCDUCK HEIRLOOM When you play this item, you may\nput the top card of your deck facedown under one of\nyour characters or locations with Boost.\nBATTLE ANTHEM Whenever one of your characters\nor locations with a card under them is challenged,\ngain 1 lore.',
    });
    const graveyard = location('graveyard-of-christmas-future', {
      text: 'NEW ARRIVAL Whenever you move a character here, put the top card of your deck\nunder this location facedown.\nANOTHER CHANCE At the start of your turn, you may put all cards from under this\nlocation into your hand. If you do, banish this location.',
    });
    const countingHouse = location('scrooges-counting-house', {
      keywords: ['Boost 2'],
      text: 'Boost 2 ⬡ (Once during your turn, you may pay 2 ⬡ to put the top card of your\ndeck facedown under this location.)\nGOOD BUSINESS This location gets +1 ⛉ and +1 ◊ for each card under it.',
    });
    expect(locationScore(recoveredPage, graveyard)).toBeUndefined();
    expect(locationScore(graveyard, recoveredPage)).toBeUndefined();
    expect(locationScore(recoveredPage, countingHouse)).toBe(5);
    expect(locationScore(bagpipes, graveyard)).toBe(5);
  });

  it('reads characters at locations getting stronger as a reward for being there, not a buff', () => {
    const russell = createCard({
      id: 'russell-senior-wilderness-explorer',
      ink: 'Emerald',
      text: 'Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of\none of your characters named Russell.)\nBASE CAMP Your characters at locations get +1 ¤.\nGOOD LEADERSHIP Whenever one of your\ncharacters with 4 ¤ or more quests, gain 1 lore.',
    });
    const johnSilver = createCard({
      id: 'john-silver-greedy-treasure-seeker',
      ink: 'Steel',
      text: 'CHART YOUR OWN COURSE For each location you have\nin play, this character gains Resist +1 and gets +1 ◊.\n(Damage dealt to them is reduced by 1.)',
    });
    expect(getLocationRoles(russell)).toEqual(['at-payoff']);
    expect(locationScore(russell, plainLocation)).toBe(7);
    expect(locationScore(russell, johnSilver)).toBeUndefined();
  });

  it("keeps a reward sized by the location's lore off a location without lore", () => {
    const atPayoff = getRuleById('location-at-payoff')!;
    const partners = atPayoff.findSynergies(carl, [carl, cheapLocation, loreless]).map((m) => m.card.id);
    expect(partners).toEqual([cheapLocation.id]);
    expect(atPayoff.findSynergies(loreless, [loreless, carl])).toEqual([]);
  });
});
