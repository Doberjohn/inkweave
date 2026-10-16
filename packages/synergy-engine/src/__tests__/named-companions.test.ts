import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {getNamedReferences} from '../utils';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Named Companions', () => {
  const namedRule = getRuleById('named-companions')!;

  const elsaBuff = createCard({
    id: 'elsa-buff',
    name: 'Elsa',
    fullName: 'Elsa - Ice Artisan',
    cost: 5,
    text: 'Your characters named Elsa get +2 strength.',
  });

  const elsaBase = createCard({
    id: 'elsa-base',
    name: 'Elsa',
    fullName: 'Elsa - Snow Queen',
    cost: 3,
  });

  const elsaShift = createCard({
    id: 'elsa-shift',
    name: 'Elsa',
    fullName: 'Elsa - Ice Maker',
    cost: 7,
  });

  const anna = createCard({
    id: 'anna-1',
    name: 'Anna',
    fullName: 'Anna - Trusting Sister',
    cost: 3,
    text: 'While you have a character named Elsa in play, this character gains Evasive.',
  });

  const unrelatedCard = createCard({
    id: 'mickey-1',
    name: 'Mickey Mouse',
    fullName: 'Mickey Mouse - Brave',
    cost: 2,
  });

  it('should match cards that reference named entities', () => {
    expect(namedRule.matches(anna)).toBe(true);
    expect(namedRule.matches(elsaBuff)).toBe(true);
  });

  it('should not match cards without named references', () => {
    expect(namedRule.matches(unrelatedCard)).toBe(false);
    expect(namedRule.matches(elsaBase)).toBe(false);
  });

  it('should find all cards with the referenced name', () => {
    const allCards = [anna, elsaBase, elsaShift, elsaBuff, unrelatedCard];
    const synergies = namedRule.findSynergies(anna, allCards);

    const targetIds = synergies.map((s) => s.card.id);
    expect(targetIds).toContain('elsa-base');
    expect(targetIds).toContain('elsa-shift');
    expect(targetIds).toContain('elsa-buff');
    expect(targetIds).not.toContain('mickey-1');
  });

  it('should not include the source card itself', () => {
    const allCards = [elsaBuff, elsaBase];
    const synergies = namedRule.findSynergies(elsaBuff, allCards);
    expect(synergies.find((s) => s.card.id === 'elsa-buff')).toBeUndefined();
  });

  it('should score based on effect tier', () => {
    // anna grants Evasive → "strong" tier → score 7
    const synergies = namedRule.findSynergies(anna, [anna, elsaBase]);
    expect(synergies[0].score).toBe(7);

    // elsaBuff grants +2 strength → "moderate" tier → score 6
    const synergies2 = namedRule.findSynergies(elsaBuff, [elsaBuff, elsaBase]);
    expect(synergies2[0].score).toBe(6);
  });

  it('should mark synergies as bidirectional', () => {
    const synergies = namedRule.findSynergies(anna, [anna, elsaBase]);
    expect(synergies[0].bidirectional).toBe(true);
  });

  it('should return empty for cards without named references', () => {
    const synergies = namedRule.findSynergies(unrelatedCard, [anna, elsaBase]);
    expect(synergies).toEqual([]);
  });

  it('should handle cards referencing multiple names', () => {
    const multiRef = createCard({
      id: 'multi-ref',
      name: 'Orville',
      fullName: 'Orville - Albatross Air',
      cost: 4,
      text: 'While you have a character named Miss Bianca or Bernard in play, this character gains Evasive.',
    });
    const bianca = createCard({id: 'bianca', name: 'Miss Bianca', cost: 3});
    const bernard = createCard({id: 'bernard', name: 'Bernard', cost: 2});

    const synergies = namedRule.findSynergies(multiRef, [multiRef, bianca, bernard, unrelatedCard]);
    expect(synergies).toHaveLength(2);
    expect(synergies.map((s) => s.card.id)).toContain('bianca');
    expect(synergies.map((s) => s.card.id)).toContain('bernard');
  });

  it('should find synergies for cards with exclamation-mark names', () => {
    const yzma = createCard({
      id: 'yzma',
      name: 'Yzma',
      fullName: 'Yzma - On Edge',
      cost: 5,
      text: 'If you have a card named Pull the Lever! in your discard, you may search your deck for a card named Wrong Lever! and reveal that card.',
    });
    const pullLever = createCard({
      id: 'pull-lever',
      name: 'Pull the Lever!',
      type: 'Action',
      cost: 2,
    });
    const wrongLever = createCard({
      id: 'wrong-lever',
      name: 'Wrong Lever!',
      type: 'Action',
      cost: 1,
    });

    const synergies = namedRule.findSynergies(yzma, [yzma, pullLever, wrongLever]);
    expect(synergies).toHaveLength(2);
    expect(synergies.map((s) => s.card.id)).toContain('pull-lever');
    expect(synergies.map((s) => s.card.id)).toContain('wrong-lever');
  });

  it('should ignore the character named in an ink-drop Shift reminder (Baymax - Amped Up)', () => {
    const ampedUp = createCard({
      id: 'baymax-amped-up',
      name: 'Baymax',
      fullName: 'Baymax - Amped Up',
      cost: 7,
      text: 'Shift Remove 2 ink drops (You may remove 2 ink drops to play this on top of one of your characters named Baymax.)',
    });
    expect(namedRule.matches(ampedUp)).toBe(false);
  });

  it("should end a name at the sentence end before an ability title (Mor'du)", () => {
    const mordu = createCard({
      id: 'mordu-savage',
      name: "Mor'du",
      fullName: "Mor'du - Savage Cursed Prince",
      // The real second ability also says "not named Mor'du", which would mask a lost first capture
      text: "FEROCIOUS ROAR When you play this character,\nexert all your characters not named Mor'du.\nROOTED BY FEAR Your characters can't ready at the start of your turn.",
    });
    expect(getNamedReferences(mordu)).toEqual(["Mor'du"]);
  });

  it('should end a name before "was" and score the free play at 8 (Buzz\'s Arm)', () => {
    const buzzArm = createCard({
      id: 'buzz-arm',
      name: "Buzz's Arm",
      fullName: "Buzz's Arm",
      type: 'Item',
      cost: 2,
      text: 'MISSING PIECE If a character named Buzz Lightyear\nwas banished this turn, you may play this item for free.',
    });
    const buzz = createCard({id: 'buzz', name: 'Buzz Lightyear'});
    const synergies = namedRule.findSynergies(buzzArm, [buzzArm, buzz]);
    expect(synergies.map((s) => [s.card.id, s.score])).toEqual([['buzz', 8]]);
  });

  it('should end a name before a generic alternative (Focused Search: "Kevin or an item card")', () => {
    const focusedSearch = createCard({
      id: 'focused-search',
      name: 'Focused Search',
      fullName: 'Focused Search',
      type: 'Action',
      text: 'Look at the top 4 cards of your deck. You may reveal\na character card named Kevin or an item card and put\nit into your hand.',
    });
    const kevin = createCard({id: 'kevin', name: 'Kevin'});
    const synergies = namedRule.findSynergies(focusedSearch, [focusedSearch, kevin]);
    expect(synergies.map((s) => [s.card.id, s.score])).toEqual([['kevin', 5]]);
  });

  it("should match a name printed with a typographic apostrophe (Belle's City Guide)", () => {
    const belle = createCard({
      id: 'belle-writer',
      name: 'Belle',
      fullName: 'Belle - Reflective Writer',
      text: 'CITY ADVENTURES When you play this character, reveal the top card of your deck. If it’s an item card named Belle’s City Guide or an action card, you may put it into your hand.',
    });
    const cityGuide = createCard({id: 'city-guide', name: "Belle's City Guide", type: 'Item'});
    const synergies = namedRule.findSynergies(belle, [belle, cityGuide]);
    expect(synergies.map((s) => [s.card.id, s.score])).toEqual([['city-guide', 5]]);
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const namedRule = getRuleById('named-companions')!;
/** The Named Companions pair `card` finds with `partner`, or undefined when they do not pair. */
const namedPair = (card: LorcanaCard, partner: LorcanaCard) =>
  namedRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A cost threshold beside the named card, and a cost reduction for having the named card.
const johnSmithsCompass = createCard({
  id: 'john-smiths-compass',
  name: "John Smith's Compass",
  fullName: "John Smith's Compass",
  type: 'Item',
  text: "SPINNING ARROW At the end of your turn, if a character of\nyours challenged this turn, banish this item.\nYOUR PATH At the end of your turn, if none of your\ncharacters challenged this turn, reveal the top card of your\ndeck. If it's a character card with cost 3 or less or named\nPocahontas, you may put it into your hand. Otherwise, put it\non the bottom of your deck.",
});
const vixey = createCard({
  id: 'vixey-forest-friend',
  name: 'Vixey',
  fullName: 'Vixey - Forest Friend',
  ink: 'Emerald',
  keywords: ['Evasive'],
  classifications: ['Storyborn', 'Ally'],
  text: "SHOWIN' UP If you have a character named Tod\nin play, you pay 1 ⬡ less to play this character.\nEvasive (Only characters with Evasive can\nchallenge this character.)",
});
const pocahontas = createCard({
  id: 'pocahontas-peacekeeper',
  name: 'Pocahontas',
  fullName: 'Pocahontas - Peacekeeper',
  cost: 5,
  classifications: ['Floodborn', 'Hero', 'Princess'],
  keywords: ['Shift 3'],
  text: "Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of\none of your characters named Pocahontas.)\nCALMING WORDS When you play this character,\nif you used Shift to play her and none of your\ncharacters challenged this turn, characters can't\nchallenge until the start of your next turn.",
});
const tod = createCard({
  id: 'tod-all-alone',
  name: 'Tod',
  fullName: 'Tod - All Alone',
  ink: 'Emerald',
  cost: 1,
  classifications: ['Storyborn', 'Hero'],
  text: '',
});

describe('Named Companions: a cost threshold is no cost reduction', () => {
  it('scores "cost 3 or less" beside the named card as a minor effect', () => {
    expect(namedPair(johnSmithsCompass, pocahontas)).toMatchObject({
      score: 5,
      explanation: '{A} has a minor effect that names {B}.',
    });
  });

  it('keeps the strong tier for "pay 1 ⬡ less"', () => {
    expect(namedPair(vixey, tod)?.score).toBe(7);
  });
});
