import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Singer + Songs fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene:
// function count). Real card text.

const singerRule = getRuleById('singer-songs')!;
/** The Singer + Songs pair `card` finds with `partner`, or undefined when they do not pair. */
const singerPair = (card: LorcanaCard, partner: LorcanaCard) =>
  singerRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A singer barred from songs without Sing Together, a song with it and one without.
const meilinLee = createCard({
  id: 'meilin-lee-lead-vocalist',
  name: 'Meilin Lee',
  fullName: 'Meilin Lee - Lead Vocalist',
  cost: 1,
  classifications: ['Dreamborn', 'Hero', 'Red Panda'],
  keywords: ['Singer 3'],
  text: "Singer 3 (This character counts as cost 3 to sing\nsongs.)\nBAND LOYALTY This character can't sing songs\nwithout Sing Together.",
});
const unPocoLoco = createCard({
  id: 'un-poco-loco',
  name: 'Un Poco Loco',
  fullName: 'Un Poco Loco',
  type: 'Action',
  ink: 'Amethyst',
  keywords: ['Sing Together 3'],
  text: "Sing Together 3 (Any number of your or your teammates'\ncharacters with total cost 3 or more may ⟳ to sing this\nsong for free.)\nChoose 2 characters of yours. If one of them is cost 3\nor less, return both to your hand.",
});
const healWhatHasBeenHurt = createCard({
  id: 'heal-what-has-been-hurt',
  name: 'Heal What Has Been Hurt',
  fullName: 'Heal What Has Been Hurt',
  type: 'Action',
  text: '(A character with cost 3 or more can ⟳ to sing this song for free.)\nRemove up to 3 damage from chosen character. Draw a card.',
});

describe('Singer + Songs: a singer barred from songs without Sing Together', () => {
  it('pairs it only with Sing Together songs, from either side', () => {
    expect(singerPair(meilinLee, unPocoLoco)?.score).toBe(8);
    expect(singerPair(unPocoLoco, meilinLee)?.score).toBe(8);
    expect(singerPair(meilinLee, healWhatHasBeenHurt)).toBeUndefined();
    expect(singerPair(healWhatHasBeenHurt, meilinLee)).toBeUndefined();
  });
});

// A cost-4 Singer 5, a song its own cost already sings and one only Singer reaches.
const fourTown = createCard({
  id: '4town-hottest-band-of-the-year',
  name: '4*Town',
  fullName: '4*Town - Hottest Band of the Year',
  cost: 4,
  strength: 5,
  willpower: 5,
  classifications: ['Storyborn'],
  keywords: ['Singer 5'],
  text: 'Singer 5 (This character counts as cost 5 to sing\nsongs.)\nSTAR PERFORMANCE Whenever this character\nsings a song with Sing Together, draw a card.',
});
const educationOrElimination = createCard({
  id: 'education-or-elimination',
  name: 'Education or Elimination',
  fullName: 'Education or Elimination',
  type: 'Action',
  ink: 'Emerald',
  cost: 4,
  text: '(A character with cost 4 or more can ⟳ to sing this song\nfor free.)\nChoose one:\n• Draw a card. Chosen character of yours gets +1 ◊ and gains\nEvasive until the start of your next turn. (Only characters\nwith Evasive can challenge them.)\n• Banish chosen damaged character.',
});
const letItGo = createCard({
  id: 'let-it-go',
  name: 'Let It Go',
  fullName: 'Let It Go',
  type: 'Action',
  ink: 'Sapphire',
  cost: 5,
  text: "(A character with cost 5 or more can ⟳ to sing this\nsong for free.)\nPut chosen character into their player's inkwell\nfacedown and exerted.",
});

describe("Singer + Songs: only songs above the singer's own cost", () => {
  it('drops a song its printed cost already sings, from either side', () => {
    expect(singerPair(fourTown, educationOrElimination)).toBeUndefined();
    expect(singerPair(educationOrElimination, fourTown)).toBeUndefined();
  });

  it('pairs a song only Singer reaches', () => {
    expect(singerPair(fourTown, letItGo)?.score).toBe(8);
    expect(singerPair(letItGo, fourTown)?.score).toBe(8);
  });
});
