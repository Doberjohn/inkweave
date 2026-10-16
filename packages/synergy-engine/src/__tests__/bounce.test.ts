import {describe, it, expect} from 'vitest';
import {getBounceRoles, getBounceTargetGate, isBounceCard} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

describe('Bounce rule (return from play to hand)', () => {
  const bounceRule = getRuleById('bounce')!;

  // Enablers.
  const selfBounce = createCard({id: 'madam-mim', fullName: 'Madam Mim - Elephant', ink: 'Amethyst', text: 'A LITTLE GAME When you play this character, banish her or return another chosen character of yours to your hand.'});
  const flexible = createCard({id: 'tigger', fullName: 'Tigger - Bouncing All the Way', ink: 'Amethyst', text: "SPLENDERIFFIC BOUNCE When you play this character, you may return chosen character, item, or location with cost 2 or less to their player's hand."});
  const opponentBounce = createCard({id: 'mal-queen', fullName: 'Maleficent - Formidable Queen', ink: 'Amethyst', text: "Return chosen opposing character to their player's hand."});
  // Payoffs.
  const rebuy = createCard({id: 'merlin-turtle', fullName: 'Merlin - Turtle', ink: 'Amethyst', text: 'When you play this character, draw 2 cards.'});
  const returnPayoff = createCard({id: 'mal-staff', fullName: "Maleficent's Staff", type: 'Item', ink: 'Amethyst', text: "BACK, FOOLS! Whenever one of your opponents' characters, items, or locations is returned to their hand from play, gain 1 lore."});
  // Multi-role: self-bounce enabler that is itself a re-buyable ETB body.
  const both = createCard({id: 'witches', fullName: 'Witches of Morva', ink: 'Amethyst', text: 'When you play this character, return another chosen character of yours to your hand, then draw 2 cards.'});
  // Excluded shapes.
  const discardReanimator = createCard({id: 'reani', fullName: 'Reanimator', ink: 'Amethyst', text: 'When you play this character, return a character card from your discard to your hand.'});
  const shiftBody = createCard({id: 'shift-etb', fullName: 'Shifted Body', ink: 'Amethyst', keywords: ['Shift 4'], text: 'Shift 4 When you play this character, draw 2 cards.'});
  // Target-gated enablers: a cost cap on the return clause (the sing reminder's "cost 2 or more" is not a cap), a classification gate.
  const pus = createCard({id: 'pus', fullName: 'Poor Unfortunate Souls', type: 'Action', ink: 'Amethyst', text: "(A character with cost 2 or more can ⟳ to sing this song for free.)\nReturn chosen character, item, or location with cost 2 or less to their player's hand."});
  const meeko = createCard({id: 'p-and-m', fullName: 'Pocahontas & Meeko - Adventurous Friends', ink: 'Amethyst', text: 'WELCOME RETURN Whenever this character quests, you may return chosen character of yours with cost 1 to your hand.'});
  const snowWhite = createCard({id: 'snow-white', fullName: 'Snow White - Merry as the Morning', ink: 'Amethyst', text: 'CLARION CALL Whenever this character quests, you may return chosen Seven Dwarfs character of yours to your hand to draw a card.'});
  const cheapRebuy = createCard({id: 'cheap-etb', fullName: 'Cheap ETB Body', ink: 'Amethyst', cost: 2, text: 'When you play this character, draw 2 cards.'});
  const dwarfRebuy = createCard({id: 'doc', fullName: 'Doc - Bold Knight', ink: 'Amethyst', classifications: ['Seven Dwarfs'], text: 'When you play this character, draw 2 cards.'});
  const scoreWith = (a: typeof selfBounce, b: typeof rebuy) => bounceRule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  describe('target gates', () => {
    it('reads the cost cap from the return clause ("cost N or less" or bare "cost N"), null when uncapped', () => {
      expect(getBounceTargetGate(flexible)).toEqual({costCap: 2, classification: null});
      expect(getBounceTargetGate(meeko).costCap).toBe(1);
      expect(getBounceTargetGate(selfBounce)).toEqual({costCap: null, classification: null});
    });
    it('ignores a "cost N or more" sing reminder', () => {
      expect(getBounceTargetGate(pus).costCap).toBe(2);
      const orMore = createCard({id: 'or-more', fullName: 'Or More', text: "Return chosen character with cost 2 or more to their player's hand."});
      expect(getBounceTargetGate(orMore).costCap).toBeNull();
    });
    it('reads a classification gate', () => {
      expect(getBounceTargetGate(snowWhite).classification).toBe('Seven Dwarfs');
    });
    it('reads a flexible bounce and its cap from typographic-apostrophe text (Owen Burnett, Set 14)', () => {
      const owen = createCard({id: 'owen', fullName: "Owen Burnett - Xanatos's Assistant", text: 'CUT YOUR LOSSES When you play this character, you may return chosen character, item, or location with cost 2 or less to their player’s hand.'});
      expect(getBounceRoles(owen)).toEqual(['flexible']);
      expect(getBounceTargetGate(owen)).toEqual({costCap: 2, classification: null});
    });
  });

  describe('role detection', () => {
    it('detects self-bounce, flexible, opponent-bounce, return-payoff, rebuy-payoff', () => {
      expect(getBounceRoles(selfBounce)).toEqual(['self-bounce']);
      expect(getBounceRoles(flexible)).toEqual(['flexible']);
      expect(getBounceRoles(opponentBounce)).toEqual(['opponent-bounce']);
      expect(getBounceRoles(returnPayoff)).toEqual(['return-payoff']);
      expect(getBounceRoles(rebuy)).toEqual(['rebuy-payoff']);
    });
    it('tags a self-bounce + re-buyable ETB body as both roles', () => {
      expect(getBounceRoles(both)).toEqual(['self-bounce', 'rebuy-payoff']);
    });
    it('excludes discard-recursion (from your discard) and Shift ETB bodies', () => {
      expect(getBounceRoles(discardReanimator)).toEqual([]);
      expect(getBounceRoles(shiftBody)).toEqual([]); // Shift re-buy is owned by Shift Targets
      expect(isBounceCard(discardReanimator)).toBe(false);
    });
  });

  describe('synergy scoring', () => {
    it('enabler ↔ rebuy-payoff scores 8, bounce reads as the actor', () => {
      const match = scoreWith(selfBounce, rebuy);
      expect(match!.score).toBe(8);
      expect(match!.explanation).toBe('{A} returns {B} to your hand, re-firing its enter-play ability.');
    });
    it('keeps the bounce side as the actor when the payoff is the searcher (token-swap)', () => {
      const match = scoreWith(rebuy, selfBounce);
      expect(match!.score).toBe(8);
      expect(match!.explanation).toBe('{B} returns {A} to your hand, re-firing its enter-play ability.');
    });
    it('flexible ↔ rebuy-payoff also scores 8 (flexible acts as an enabler)', () => {
      expect(scoreWith(flexible, cheapRebuy)?.score).toBe(8);
    });
    it("drops a re-buy body above the bouncer's cost cap, in either direction", () => {
      expect(scoreWith(flexible, rebuy)).toBeUndefined(); // cap 2, the body costs 3
      expect(scoreWith(rebuy, flexible)).toBeUndefined();
    });
    it("drops a re-buy body outside the bouncer's classification gate, in either direction", () => {
      expect(scoreWith(snowWhite, rebuy)).toBeUndefined();
      expect(scoreWith(rebuy, snowWhite)).toBeUndefined();
    });
    it('admits a re-buy body that carries the gated classification', () => {
      expect(scoreWith(snowWhite, dwarfRebuy)?.score).toBe(8);
    });
    it('keeps a two-enabler pair when only one direction passes its gate', () => {
      // `both` (uncapped) can return this cost-3 body; the body's own cap 2 cannot return `both`.
      const cappedBoth = createCard({id: 'capped-both', fullName: 'Capped Bouncer With ETB', ink: 'Amethyst', text: "When you play this character, draw 2 cards. Return chosen character with cost 2 or less to their player's hand."});
      expect(scoreWith(both, cappedBoth)?.explanation).toBe('{A} returns {B} to your hand, re-firing its enter-play ability.');
      expect(scoreWith(cappedBoth, both)?.explanation).toBe('{B} returns {A} to your hand, re-firing its enter-play ability.');
    });
    it('opponent-side ↔ return-payoff scores 6', () => {
      expect(scoreWith(opponentBounce, returnPayoff)?.score).toBe(6);
    });
    it('drops payoff ↔ payoff and enabler ↔ enabler (payoff-anchored)', () => {
      const rebuy2 = createCard({id: 'rebuy2', fullName: 'Second ETB', text: 'When you play this character, search your deck for a card.'});
      const self2 = createCard({id: 'self2', fullName: 'Second Bounce', text: 'Return another chosen character of yours to your hand.'});
      expect(scoreWith(rebuy, rebuy2)).toBeUndefined();
      expect(scoreWith(selfBounce, self2)).toBeUndefined();
    });
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const bounceRule = getRuleById('bounce')!;
/** The Bounce pair `card` finds with `partner`, or undefined when they do not pair. */
const bouncePair = (card: LorcanaCard, partner: LorcanaCard) =>
  bounceRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A deck look that only orders the deck, and one that puts a card into your hand.
const jafar = createCard({
  id: 'jafar-lamp-thief',
  name: 'Jafar',
  fullName: 'Jafar - Lamp Thief',
  ink: 'Amethyst',
  cost: 3,
  text: 'I AM YOUR MASTER NOW When you play this\ncharacter, look at the top 2 cards of your deck.\nPut one on the top of your deck and the other on\nthe bottom.',
});
const tinkerBell = createCard({
  id: 'tinker-bell-generous-fairy',
  name: 'Tinker Bell',
  fullName: 'Tinker Bell - Generous Fairy',
  cost: 4,
  text: 'MAKE A NEW FRIEND When you play this character,\nlook at the top 4 cards of your deck. You may reveal\na character card and put it into your hand. Put the\nrest on the bottom of your deck in any order.',
});
const motherKnowsBest = createCard({
  id: 'mother-knows-best',
  name: 'Mother Knows Best',
  fullName: 'Mother Knows Best',
  type: 'Action',
  ink: 'Emerald',
  cost: 3,
  text: "(A character with cost 3 or more can ⟳ to sing this\nsong for free.)\nReturn chosen character to their player's hand.",
});

describe('Bounce: a deck look as re-buy value', () => {
  it('reads it as re-buy value only when a card goes to your hand', () => {
    expect(getBounceRoles(jafar)).toEqual([]);
    expect(getBounceRoles(tinkerBell)).toEqual(['rebuy-payoff']);
  });

  it('pairs a bounce card only with the look that fills your hand', () => {
    expect(bouncePair(motherKnowsBest, jafar)).toBeUndefined();
    expect(bouncePair(motherKnowsBest, tinkerBell)?.score).toBe(8);
  });
});
