import {describe, it, expect} from 'vitest';
import {getDiscardRoles, getSelfDiscardRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Self-Discard's small-hand payoff, the Gargoyles' STONE BY DAY (#758). Real card text from sets
// 10 and 11 (Set 14 preview ids renumber when the set graduates), named by fullName.

const bronx = createCard({
  id: 'bronx-ferocious-beast',
  name: 'Bronx',
  fullName: 'Bronx - Ferocious Beast',
  ink: 'Ruby',
  text: "Reckless (This character can't quest and must\nchallenge each turn if able.)\nSTONE BY DAY If you have 3 or more cards in your\nhand, this character can't ready.",
});
const demona = createCard({
  id: 'demona-betrayer-of-the-clan',
  name: 'Demona',
  fullName: 'Demona - Betrayer of the Clan',
  ink: 'Amethyst',
  text: "Challenger +2 (While challenging, this character\ngets +2 ¤.)\nSTONE BY DAY If you have 3 or more cards in your\nhand, this character can't ready.",
});
const hudson = createCard({
  id: 'hudson-determined-reader',
  name: 'Hudson',
  fullName: 'Hudson - Determined Reader',
  ink: 'Steel',
  text: "FINDING ANSWERS When you play this character,\nyou may draw a card, then choose and discard\na card.\nSTONE BY DAY If you have 3 or more cards in your\nhand, this character can't ready.",
});
const goliath = createCard({
  id: 'goliath-clan-leader',
  name: 'Goliath',
  fullName: 'Goliath - Clan Leader',
  ink: 'Steel',
  text: "DUSK TO DAWN At the end of each player's turn, if they\nhave more than 2 cards in their hand, they choose and\ndiscard cards until they have 2. If they have fewer than 2\ncards in their hand, they draw until they have 2.\nSTONE BY DAY If you have 3 or more cards in your hand,\nthis character can't ready.",
});

// Outlets that shrink your hand.
const gantu = createCard({
  id: 'gantu-hamsterviels-accomplice',
  name: 'Gantu',
  fullName: "Gantu - Hamsterviel's Accomplice",
  ink: 'Steel',
  text: 'EASY TARGET When you play this character,\nchoose and discard a card.',
});
const meeko = createCard({
  id: 'meeko-skittish-scrounger',
  name: 'Meeko',
  fullName: 'Meeko - Skittish Scrounger',
  ink: 'Amethyst',
  text: 'Evasive (Only characters with Evasive can\nchallenge this character.)\nBOTTOMLESS PIT At the end of your turn, if this\ncharacter is exerted, choose and discard a card or\nbanish him.',
});
const youBrokeMySmolder = createCard({
  id: 'you-broke-my-smolder',
  name: 'You Broke My Smolder',
  fullName: 'You Broke My Smolder',
  type: 'Action',
  ink: 'Steel',
  text: 'Discard your hand. Draw 2 cards.',
});

// Outlets that leave the hand as big or bigger: a loot and a refill.
const kronk = createCard({
  id: 'kronk-meat-hut-cook',
  name: 'Kronk',
  fullName: 'Kronk - Meat Hut Cook',
  ink: 'Steel',
  text: 'Resist +1 (Damage dealt to this character is\nreduced by 1.)\nPICKUP! Once during your turn, you may pay 1 ⬡\nto draw a card, then choose and discard a card.',
});
const maxKaraoke = createCard({
  id: 'max-karaoke-star',
  name: 'Max Goof',
  fullName: 'Max Goof - Karaoke Star',
  ink: 'Emerald',
  text: 'SWEET REMIX When you play this character, you may choose and discard a song card. If you do, draw 2 cards.\nBRAND-NEW PLAYLIST While you have 5 or more song cards in your discard, this character gets +3 ◊.',
});

// The other state payoffs, and two big-hand payoffs, which want the opposite of STONE BY DAY.
const megavolt = createCard({
  id: 'megavolt-electrical-menace',
  name: 'Megavolt',
  fullName: 'Megavolt - Electrical Menace',
  ink: 'Steel',
  text: 'FORCE FIELD While you have no cards in your\nhand, this character gains Resist +2. (Damage\ndealt to them is reduced by 2.)',
});
const maximus = createCard({
  id: 'maximus-relentless-stallion',
  name: 'Maximus',
  fullName: 'Maximus - Relentless Stallion',
  ink: 'Steel',
  text: 'NO ESCAPE If you discarded a card this turn, this\ncharacter gains Challenger +2 and can challenge\nready characters this turn. (They get +2 ¤ while\nchallenging.)',
});
const tinkerBell = createCard({
  id: 'tinker-bell-snowflake-collector',
  name: 'Tinker Bell',
  fullName: 'Tinker Bell - Snowflake Collector',
  ink: 'Amethyst',
  text: 'FLURRY OF DELIGHT While you have 4 or more\ncards in your hand, this character gains Evasive.\n(Only characters with Evasive can challenge them.)\nSPECTACULAR FIND While you have 7 or more\ncards in your hand, this character gets +3 ◊.',
});
const jafar = createCard({
  id: 'jafar-keeper-of-secrets',
  name: 'Jafar',
  fullName: 'Jafar - Keeper of Secrets',
  ink: 'Amethyst',
  text: 'HIDDEN WONDERS This character gets +1 ¤\nfor each card in your hand.',
});

describe('Self-Discard roles: STONE BY DAY', () => {
  it('reads STONE BY DAY as a state payoff, next to any outlet the card has', () => {
    expect(getSelfDiscardRoles(bronx)).toEqual(['state-payoff']);
    expect(getSelfDiscardRoles(hudson)).toEqual(['enabler', 'state-payoff']);
  });

  it("keeps Goliath - Clan Leader's each-player trim out of the enabler role", () => {
    expect(getSelfDiscardRoles(goliath)).toEqual(['state-payoff']);
  });

  it('does not read a big-hand payoff as a small-hand one', () => {
    expect(getSelfDiscardRoles(tinkerBell)).toEqual([]);
    expect(getSelfDiscardRoles(jafar)).toEqual([]);
  });

  it("never reads STONE BY DAY as Discard's hand-size payoff", () => {
    expect(getDiscardRoles(bronx)).toEqual([]);
    expect(getDiscardRoles(goliath)).toEqual(['standard']);
  });
});

describe('Self-Discard scoring: STONE BY DAY', () => {
  const rule = getRuleById('self-discard')!;
  /** The pair's match with `card` as the searcher. */
  const match = (card: LorcanaCard, partner: LorcanaCard) =>
    rule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);
  /** The pair's score with `card` as the searcher. */
  const score = (card: LorcanaCard, partner: LorcanaCard) => match(card, partner)?.score;

  it('scores 7 when an outlet shrinks the hand, with the outlet as the actor', () => {
    expect(match(gantu, bronx)).toMatchObject({
      score: 7,
      explanation: "{A}'s self-discard keeps your hand at 2 or fewer, so {B} can ready.",
    });
    expect(match(bronx, gantu)).toMatchObject({
      score: 7,
      explanation: "{B}'s self-discard keeps your hand at 2 or fewer, so {A} can ready.",
    });
    expect(score(meeko, bronx)).toBe(7);
    expect(score(youBrokeMySmolder, bronx)).toBe(7);
    expect(score(gantu, hudson)).toBe(7);
  });

  it('scores a loot or a refill 5, since the hand ends as big or bigger', () => {
    expect(score(kronk, bronx)).toBe(5);
    expect(score(maxKaraoke, bronx)).toBe(5);
    expect(score(hudson, bronx)).toBe(5);
  });

  it("scores Goliath - Clan Leader's trim 7 with another STONE BY DAY card", () => {
    expect(match(goliath, bronx)).toMatchObject({
      score: 7,
      explanation: "{A}'s self-discard keeps your hand at 2 or fewer, so {B} can ready.",
    });
    expect(match(hudson, goliath)).toMatchObject({
      score: 7,
      explanation: "{B}'s self-discard keeps your hand at 2 or fewer, so {A} can ready.",
    });
  });

  it("feeds nothing else with Goliath - Clan Leader's trim", () => {
    expect(score(goliath, megavolt)).toBe(5);
    expect(score(goliath, maximus)).toBe(5);
  });

  it('scores a small-hand payoff 5 with another payoff', () => {
    expect(score(bronx, demona)).toBe(5);
    expect(score(bronx, megavolt)).toBe(5);
    expect(score(bronx, maximus)).toBe(5);
  });
});
