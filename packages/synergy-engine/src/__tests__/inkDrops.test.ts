import {describe, it, expect} from 'vitest';
import {
  getCardMechanics,
  getInkDropRoles,
  isInkDropCard,
  isLateDropMaker,
  isOpponentGatedDrop,
  isRepeatingDropMaker,
} from '../utils';
import {getRuleById} from '../engine';
import {scoreInkDropPair} from '../engine/inkDropScoring';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Real Set 14 card text, named by fullName (preview ids renumber when the set graduates).
const arthurJoustingKnight = createCard({
  id: 'arthur-jousting-knight',
  name: 'Arthur',
  fullName: 'Arthur - Jousting Knight',
  ink: 'Steel',
  cost: 6,
  text: 'Shift 4 ⬡ (You may pay 4 ⬡ to play this on top of one of your characters named Arthur.)\nChallenger +2 (While challenging, this character gets +2 ¤.)\nVICTORY PURSE During your turn, whenever this character banishes another character in a challenge, draw a card and get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
});
const madamMim = createCard({
  id: 'madam-mim-resourceful-trickster',
  name: 'Madam Mim',
  fullName: 'Madam Mim - Resourceful Trickster',
  ink: 'Amethyst',
  cost: 8,
  text: 'UPPER HAND When you play this character, if you removed an ink drop to play her, draw 2 cards.\nBAUBLE GAME Once during your turn, whenever you remove an ink drop, draw a card.',
});
const sirKay = createCard({
  id: 'sir-kay',
  name: 'Sir Kay',
  fullName: 'Sir Kay - Determined to Win',
  ink: 'Steel',
  cost: 5,
  text: 'COMPETITIVE EDGE While you have an ink drop, this character gains Challenger +3. (They get +3 ¤ while challenging.)',
});
const wasabi = createCard({
  id: 'wasabi-called-into-battle',
  name: 'Wasabi',
  fullName: 'Wasabi - Called into Battle',
  ink: 'Ruby',
  cost: 5,
  text: 'TWIN BLADES During your turn, whenever this character deals damage to another character in a challenge, deal damage equal to this character’s ¤ to another chosen character.\nBRING THE HEAT While you have an ink drop, this character gets +2 ¤.',
});
const baymaxAmpedUp = createCard({
  id: 'baymax-amped-up',
  name: 'Baymax',
  fullName: 'Baymax - Amped Up',
  ink: 'Sapphire',
  cost: 7,
  text: 'Shift Remove 2 ink drops (You may remove 2 ink drops to play this on top of one of your characters named Baymax.)\nSUPERCHARGE If you would get an ink drop, you may put the top card of your deck into your inkwell facedown and exerted instead.',
});
const baymaxLabAssistant = createCard({
  id: 'baymax-lab-assistant',
  name: 'Baymax',
  fullName: 'Baymax - Lab Assistant',
  ink: 'Emerald',
  cost: 4,
  text: 'RESUPPLY When you play this character, if you have 2 or more items in play, get 2 ink drops. (Each ink drop may be removed to pay 1 ⬡.)',
});
const mickey = createCard({
  id: 'mickey-best-in-town',
  name: 'Mickey Mouse',
  fullName: 'Mickey Mouse - Best in Town',
  ink: 'Amber',
  cost: 1,
  text: "Adventurous (This character can't challenge and must quest each turn if able.)\nHOT DOG! At the end of your turn, if this character is exerted, each player gets 1 ink drop. (Each ink drop may be removed to pay 1 ⬡.)",
});
const yama = createCard({
  id: 'yama',
  name: 'Yama',
  fullName: 'Yama - Notorious Criminal',
  ink: 'Ruby',
  cost: 4,
  text: 'KEEP ‘EM COMING 6 ⬡ — Whenever one of your characters challenges another character this turn, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
});
const bobby = createCard({
  id: 'bobby-zimuruski',
  name: 'Bobby Zimuruski',
  fullName: 'Bobby Zimuruski - Soundboard Whiz',
  ink: 'Emerald',
  cost: 2,
  text: "Ward (Opponents can't choose this character except to challenge.)\nSCRUMPTIOUS! Your items named Leaning Tower of Cheese-a gain “⟳, 1 ⬡ — Get 1 ink drop.” (You may remove an ink drop to pay 1 ⬡.)",
});
const merlinCurious = createCard({
  id: 'merlin-profoundly-curious',
  name: 'Merlin',
  fullName: 'Merlin - Profoundly Curious',
  ink: 'Amethyst',
  cost: 4,
  text: 'UNTAPPED POTENTIAL When you play this character, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)\nTHRILLING DISCOVERY Whenever this character quests, draw a card.',
});
const inkcasterSkates = createCard({
  id: 'inkcaster-skates',
  name: 'Inkcaster Skates',
  fullName: 'Inkcaster Skates',
  ink: 'Amethyst',
  type: 'Item',
  cost: 3,
  text: 'THE LATEST TREND ⟳ — If a character quested this turn, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
});
const thisIsBusiness = createCard({
  id: 'this-is-business',
  name: 'This Is Business',
  fullName: 'This Is Business',
  ink: 'Emerald',
  type: 'Action',
  cost: 3,
  text: 'Chosen opponent chooses one:\n• They reveal their hand and discard a card of your choice. They get 2 ink drops. (Each ink drop may be removed to pay 1 ⬡.)\n• You draw a card and get 2 ink drops.',
});
const joustingMatch = createCard({
  id: 'jousting-match',
  name: 'Jousting Match',
  fullName: 'Jousting Match',
  ink: 'Steel',
  type: 'Action',
  cost: 3,
  text: 'Deal 2 damage to chosen character. If you removed an ink drop to play this action, deal 5 damage instead.',
});
const molly = createCard({
  id: 'molly-cunningham',
  name: 'Molly Cunningham',
  fullName: 'Molly Cunningham - Remembers to Share',
  ink: 'Emerald',
  cost: 2,
  text: 'SO FUN! When you play this character, you and another chosen player each get 1 ink drop. (Each ink drop may be removed to pay 1 ⬡.)',
});
const inkExplosion = createCard({
  id: 'ink-explosion',
  name: 'Ink Explosion',
  fullName: 'Ink Explosion',
  ink: 'Steel',
  type: 'Action',
  cost: 4,
  text: 'Deal 4 damage to chosen character. Get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
});
const baloo = createCard({
  id: 'baloo-delivery-pilot',
  name: 'Baloo',
  fullName: 'Baloo - Delivery Pilot',
  ink: 'Steel',
  cost: 2,
  text: "CASH PAYMENT This character can't quest or challenge unless you gained an ink drop this turn.",
});
const goGoTomago = createCard({
  id: 'go-go-tomago',
  name: 'Go Go Tomago',
  fullName: 'Go Go Tomago - Extreme Tester',
  ink: 'Emerald',
  cost: 2,
  text: 'GATHERING DATA Whenever this character is challenged, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
});

/** Score a pair the way the rule does: roles from the detector, then the card-aware scorer. */
const score = (card: LorcanaCard, other: LorcanaCard) =>
  scoreInkDropPair(card, getInkDropRoles(card), other, getInkDropRoles(other));

describe('Ink Drops role detection', () => {
  it('tags a card that gets drops as a maker, not a payoff, despite the removal reminder text', () => {
    expect(getInkDropRoles(arthurJoustingKnight)).toEqual(['drop-maker']);
    expect(getInkDropRoles(merlinCurious)).toEqual(['drop-maker']);
  });

  it('tags spend, remove, hold, sink and gain-gate payoffs, and never reads a drop sink as a maker', () => {
    expect(getInkDropRoles(madamMim)).toEqual(['drop-payoff']);
    expect(getInkDropRoles(sirKay)).toEqual(['drop-payoff']);
    expect(getInkDropRoles(baymaxAmpedUp)).toEqual(['drop-payoff']);
    expect(getInkDropRoles(baloo)).toEqual(['drop-payoff']);
  });

  it('flags a maker whose drops also reach an opponent as shared', () => {
    expect(getInkDropRoles(mickey)).toEqual(['drop-maker', 'drop-shared']);
    expect(getInkDropRoles(molly)).toEqual(['drop-maker', 'drop-shared']);
  });

  it('ignores cards that never mention ink drops', () => {
    const plain = createCard({text: 'When you play this character, draw a card.'});
    expect(getInkDropRoles(plain)).toEqual([]);
    expect(isInkDropCard(plain)).toBe(false);
  });

  it('treats only free, repeatable gains as a steady supply', () => {
    expect(isRepeatingDropMaker(inkcasterSkates)).toBe(true);
    expect(isRepeatingDropMaker(arthurJoustingKnight)).toBe(true);
    expect(isRepeatingDropMaker(merlinCurious)).toBe(false);
    // An ink-cost activation offsets the drop it makes.
    expect(isRepeatingDropMaker(yama)).toBe(false);
    expect(isRepeatingDropMaker(bobby)).toBe(false);
  });

  it('judges a steady supply one ability at a time', () => {
    // A quest trigger in one ability must not pair with a one-shot gain in the next.
    const questThenPlay = createCard({
      text: 'THRILLING DISCOVERY Whenever this character quests, draw a card.\nUNTAPPED POTENTIAL When you play this character, get 1 ink drop.',
      textSections: [
        'THRILLING DISCOVERY Whenever this character quests, draw a card.',
        'UNTAPPED POTENTIAL When you play this character, get 1 ink drop.',
      ],
    });
    expect(getInkDropRoles(questThenPlay)).toEqual(['drop-maker']);
    expect(isRepeatingDropMaker(questThenPlay)).toBe(false);
  });

  it('reads a modal option with the line that offers it', () => {
    // Preview data keeps each "•" option in its own section, apart from its trigger line.
    const onQuest = createCard({
      text: 'Whenever this character quests, choose one:\n• Deal 1 damage to chosen character.\n• Get 1 ink drop.',
      textSections: [
        'Whenever this character quests, choose one:',
        '• Deal 1 damage to chosen character.',
        '• Get 1 ink drop.',
      ],
    });
    // The quest trigger of the ability before must not reach a play-triggered option.
    const onPlay = createCard({
      text: 'Whenever this character quests, draw a card.\nWhen you play this character, choose one:\n• Draw a card.\n• Get 1 ink drop.',
      textSections: [
        'Whenever this character quests, draw a card.',
        'When you play this character, choose one:',
        '• Draw a card.',
        '• Get 1 ink drop.',
      ],
    });
    expect(isRepeatingDropMaker(onQuest)).toBe(true);
    expect(isRepeatingDropMaker(onPlay)).toBe(false);
  });

  it('marks a maker whose drops all arrive after your quests and challenges as late', () => {
    expect(isLateDropMaker(mickey)).toBe(true);
    expect(isLateDropMaker(goGoTomago)).toBe(true);
    expect(isLateDropMaker(inkcasterSkates)).toBe(false);
    expect(isLateDropMaker(merlinCurious)).toBe(false);
  });

  it('marks a maker whose drop the opponent can deny as opponent-gated', () => {
    expect(isOpponentGatedDrop(thisIsBusiness)).toBe(true);
    expect(isOpponentGatedDrop(molly)).toBe(false);
  });

  it('surfaces makers, and only makers, as the Creates Ink Drops catalog tile', () => {
    expect(getCardMechanics(arthurJoustingKnight)).toContain('ink-drop-gain');
    expect(getCardMechanics(baymaxAmpedUp)).not.toContain('ink-drop-gain');
  });
});

describe('Ink Drops rule', () => {
  const rule = getRuleById('ink-drops')!;

  it('is registered as the ink-drops playstyle and matches only drop cards', () => {
    expect(rule.category === 'playstyle' && rule.playstyleId).toBe('ink-drops');
    expect(rule.matches(inkcasterSkates)).toBe(true);
    expect(rule.matches(createCard({text: 'When you play this character, draw a card.'}))).toBe(false);
  });

  it('pairs a maker with a payoff and drops maker ↔ maker density', () => {
    const synergies = rule.findSynergies(inkcasterSkates, [inkcasterSkates, merlinCurious, joustingMatch]);
    expect(synergies.map((m) => [m.card.id, m.score])).toEqual([['jousting-match', 7]]);
  });
});

describe('Ink Drops pair scoring', () => {
  it('never pairs two makers', () => {
    expect(score(inkcasterSkates, merlinCurious)).toBeNull();
  });

  it('scores a steady maker with a once-per-turn removal draw at 8, with the maker as the actor', () => {
    expect(score(inkcasterSkates, madamMim)).toEqual({
      score: 8,
      explanation: '{A} keeps making ink drops, and spending one each turn draws a card off {B}.',
    });
    expect(score(madamMim, inkcasterSkates)?.explanation).toBe(
      '{B} keeps making ink drops, and spending one each turn draws a card off {A}.',
    );
  });

  it('scores a one-shot maker with a spend rider at 7', () => {
    expect(score(inkExplosion, madamMim)?.score).toBe(7);
    expect(score(inkExplosion, joustingMatch)?.score).toBe(7);
  });

  it('scores a hold payoff 6 with a one-shot maker and 7 with a steady one', () => {
    expect(score(inkExplosion, sirKay)?.score).toBe(6);
    expect(score(inkcasterSkates, sirKay)?.score).toBe(7);
  });

  it('scores a drop sink 6 with a one-shot maker, 7 with a two-drop burst, 8 with a steady maker', () => {
    expect(score(merlinCurious, baymaxAmpedUp)?.score).toBe(6);
    expect(score(baymaxLabAssistant, baymaxAmpedUp)?.score).toBe(7);
    expect(score(inkcasterSkates, baymaxAmpedUp)?.score).toBe(8);
  });

  it('takes one point off, once, when the opponent decides whether the drop arrives', () => {
    expect(score(thisIsBusiness, joustingMatch)).toEqual({
      score: 6,
      explanation:
        '{A} banks the ink drop you remove to play {B}, switching on its bonus. The opponent decides whether you get the drop.',
    });
  });

  it('does not penalize a maker for also feeding the opponent', () => {
    expect(score(molly, joustingMatch)?.score).toBe(7);
  });

  it('scores a gain gate 6 with a one-shot maker and 7 with a steady one, with the maker as the actor', () => {
    expect(score(inkExplosion, baloo)).toEqual({
      score: 6,
      explanation: "{A}'s ink drop lets {B} quest and challenge that turn.",
    });
    expect(score(baloo, inkcasterSkates)).toEqual({
      score: 7,
      explanation: '{B} can get you an ink drop every turn, so {A} can quest and challenge.',
    });
  });

  it('never pairs a gain gate with a maker whose drop arrives too late to open it', () => {
    expect(score(mickey, baloo)).toBeNull();
    expect(score(goGoTomago, baloo)).toBeNull();
  });

  it('pairs two hold payoffs at 6 and drops payoffs that compete for the same drops', () => {
    expect(score(sirKay, wasabi)?.score).toBe(6);
    expect(score(madamMim, joustingMatch)).toBeNull();
    expect(score(madamMim, baymaxAmpedUp)).toBeNull();
  });
});
