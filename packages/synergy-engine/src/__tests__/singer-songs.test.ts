import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {transformCard} from '../utils';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Singer + Songs', () => {
  const singerRule = getRuleById('singer-songs')!;

  type SingerSongOpts = {
    singerKeyword?: string;
    singerName?: string;
    singerCost?: number;
    songName?: string;
    songCost: number;
    songText?: string;
    songClassifications?: string[];
  };

  function makeSingerSongPair(opts: SingerSongOpts) {
    const singerName = opts.singerName ?? 'Gazelle';
    const songName = opts.songName ?? 'Try Everything';
    const singer = createCard({
      id: 'singer-1',
      name: singerName,
      fullName: `${singerName} - Pop Star`,
      keywords: [opts.singerKeyword ?? 'Singer 5'],
      // Cost 1 by default: a character already sings a song its own cost reaches, so Singer
      // pairs only with songs above it.
      cost: opts.singerCost ?? 1,
    });
    const song = createCard({
      id: 'song-1',
      name: songName,
      fullName: songName,
      type: 'Action',
      cost: opts.songCost,
      text: opts.songText ?? 'A song card',
      ...(opts.songClassifications && {classifications: opts.songClassifications}),
    });
    return {singer, song};
  }

  it('should match characters with Singer keyword', () => {
    const singer = createCard({
      id: 'singer-1',
      name: 'Ariel',
      fullName: 'Ariel - Singing Mermaid',
      keywords: ['Singer 5'],
    });
    expect(singerRule.matches(singer)).toBe(true);
  });

  it('should not match non-Singer characters', () => {
    const regular = createCard({id: 'char-1', name: 'Elsa'});
    expect(singerRule.matches(regular)).toBe(false);
  });

  it('pairs a conditional Singer ("gains Singer 3" in text only) with the songs it can sing', () => {
    const miguel = transformCard({
      id: 14021,
      name: 'Miguel Rivera',
      fullName: 'Miguel Rivera - Street Musician',
      cost: 1,
      color: 'Amber',
      inkwell: true,
      type: 'Character',
      fullText: 'SHARE THE MUSIC While you have a song card in your discard, this character gets +1 ◊ and gains Singer 3.',
    })!;
    const {song} = makeSingerSongPair({songCost: 3});
    const match = singerRule.findSynergies(miguel, [miguel, song]).find((m) => m.card.id === song.id);
    expect(match?.score).toBe(8);
  });

  it('should match Song cards for reverse lookup', () => {
    const song = createCard({
      id: 'song-1',
      name: 'Let It Go',
      type: 'Action',
      text: 'A song card',
    });
    expect(singerRule.matches(song)).toBe(true);
  });

  it('should find songs that cost <= Singer value', () => {
    const {singer} = makeSingerSongPair({songCost: 2});
    const cheapSong = createCard({
      id: 'song-cheap',
      name: 'Be Our Guest',
      fullName: 'Be Our Guest',
      type: 'Action',
      cost: 2,
      text: 'A song card',
    });
    const expensiveSong = createCard({
      id: 'song-expensive',
      name: 'Circle of Life',
      fullName: 'Circle of Life',
      type: 'Action',
      cost: 8,
      text: 'A song card',
    });

    const synergies = singerRule.findSynergies(singer, [singer, cheapSong, expensiveSong]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].card.id).toBe('song-cheap');
  });

  it.each([
    ['perfect fit (diff 0) → 8', 'Singer 5', 5, 8],
    ['near-perfect (diff 1) → 7', 'Singer 5', 4, 7],
    ['good savings (diff 2) → 6', 'Singer 5', 3, 6],
    ['inefficient (diff >= 3) → 5', 'Singer 9', 2, 5],
  ] as const)('should score %s', (_label, singerKeyword, songCost, expected) => {
    const {singer, song} = makeSingerSongPair({singerKeyword, songCost});
    const synergies = singerRule.findSynergies(singer, [singer, song]);
    expect(synergies[0].score).toBe(expected);
  });

  it('should mark synergies as bidirectional', () => {
    const {singer, song} = makeSingerSongPair({songCost: 2});
    const synergies = singerRule.findSynergies(singer, [singer, song]);
    expect(synergies[0].bidirectional).toBe(true);
  });

  it('should find Singers from Song perspective (reverse)', () => {
    const {singer, song} = makeSingerSongPair({songCost: 4});
    const weakSinger = createCard({
      id: 'singer-2',
      name: 'Angel',
      fullName: 'Angel - Siren Singer',
      keywords: ['Singer 3'],
    });

    const synergies = singerRule.findSynergies(song, [song, singer, weakSinger]);
    // Gazelle (Singer 5) can sing cost-4 song, Angel (Singer 3) cannot
    expect(synergies).toHaveLength(1);
    expect(synergies[0].card.id).toBe('singer-1');
  });

  it('should not match non-Action cards even if text contains song', () => {
    const {singer} = makeSingerSongPair({songCost: 3});
    const notASong = createCard({
      id: 'char-1',
      name: 'Some Character',
      fullName: 'Some Character',
      type: 'Character',
      cost: 3,
      text: 'When you play a song, draw a card',
    });

    const synergies = singerRule.findSynergies(singer, [singer, notASong]);
    expect(synergies).toHaveLength(0);
  });

  it('should score identically in both directions (reverse scoring symmetry)', () => {
    const {singer, song} = makeSingerSongPair({songCost: 3});
    const forwardSynergies = singerRule.findSynergies(singer, [singer, song]);
    const reverseSynergies = singerRule.findSynergies(song, [song, singer]);

    expect(forwardSynergies).toHaveLength(1);
    expect(reverseSynergies).toHaveLength(1);
    expect(forwardSynergies[0].score).toBe(reverseSynergies[0].score);
    expect(forwardSynergies[0].score).toBe(6); // diff of 2
  });

  it('should detect Songs via classifications (not just text)', () => {
    const {singer, song} = makeSingerSongPair({
      songName: 'Be Our Guest',
      songCost: 5,
      songText: 'Deal 2 damage to chosen character.',
      songClassifications: ['Song'],
    });
    const synergies = singerRule.findSynergies(singer, [singer, song]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].score).toBe(8);
  });

  it('should pair no song when the Singer keyword has no numeric value', () => {
    const {singer, song} = makeSingerSongPair({
      singerKeyword: 'Singer',
      singerCost: 4,
      songCost: 4,
    });
    // The Singer value falls back to the card's cost, which reaches no song Singer unlocks.
    expect(singerRule.findSynergies(singer, [singer, song])).toHaveLength(0);
  });

  it("names the singer and the song, with the song's cost and the Singer value", () => {
    const {singer, song} = makeSingerSongPair({songCost: 4});
    // The searcher is {A}: the singer on its own page, the song on the song's page.
    expect(singerRule.findSynergies(singer, [singer, song])[0].explanation).toBe(
      '{A} can sing {B} (cost 4) for free with Singer 5.',
    );
    expect(singerRule.findSynergies(song, [singer, song])[0].explanation).toBe(
      '{B} can sing {A} (cost 4) for free with Singer 5.',
    );
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

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
