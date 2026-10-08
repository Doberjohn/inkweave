import {describe, it, expect} from 'vitest';
import {SynergyEngine} from '../engine';
import {getLocationRoles} from '../utils';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Location Control fixes: a buff (#628) or a move limited to one location classification
// ("Your Hyperia City locations get +2 ⛉.", "move him to a Hyperia City location") reaches only
// locations of that classification. Kept out of rules.test.ts (CodeScene: function count).
// Named cards use their real text.

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
    const russell = createCard({
      id: 'russell-senior-wilderness-explorer',
      name: 'Russell',
      fullName: 'Russell - Senior Wilderness Explorer',
      ink: 'Emerald',
      text: 'Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of\none of your characters named Russell.)\nBASE CAMP Your characters at locations get +1 ¤.\nGOOD LEADERSHIP Whenever one of your\ncharacters with 4 ¤ or more quests, gain 1 lore.',
    });
    const mixed = createCard({
      id: 'mixed-buff',
      type: 'Item',
      text: 'Your Hyperia City locations get +2 ⛉. Your locations gain Resist +1.',
    });
    expect(locationScore(village, plainLocation)).toBe(7);
    expect(locationScore(russell, plainLocation)).toBe(7);
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

  it('keeps a buff that gives an effect "to your locations"', () => {
    const giveBuff = createCard({id: 'give-to-locations', type: 'Item', text: 'Give Resist +1 to your locations.'});
    expect(getLocationRoles(giveBuff)).toEqual(['buff']);
    expect(locationScore(giveBuff, plainLocation)).toBe(7);
  });

  it('keeps a location move written after a damage-moving clause', () => {
    const both = createCard({
      id: 'damage-then-move',
      text: 'Move 1 damage counter from chosen character to chosen opposing character. Move him to one of your locations for free.',
    });
    expect(getLocationRoles(both)).toContain('move');
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
