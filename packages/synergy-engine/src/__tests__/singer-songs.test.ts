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
