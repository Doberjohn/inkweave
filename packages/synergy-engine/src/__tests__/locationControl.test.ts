import {describe, it, expect} from 'vitest';
import {SynergyEngine} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Location Control fix from #628: a buff limited to one location classification ("Your Hyperia
// City locations get +2 ⛉.") reaches only locations of that classification. Kept out of
// rules.test.ts (CodeScene: function count). Named cards use their real text.

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
