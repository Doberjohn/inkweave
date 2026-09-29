import {describe, it, expect} from 'vitest';
import {
  isDualInk,
  getInks,
  canShareDeck,
  getInkDropGain,
  getShiftType,
  hasAnyShift,
  getShiftBaseNames,
  getNamedReferences,
  classifyNamedEffect,
  NAMED_EFFECT_SCORES,
  normalizeCardText,
  getItemRoles,
  getTribalRoles,
  TRIBAL_SPECS,
  getBounceRoles,
} from '../utils';
import {createCard} from './fixtures.js';

describe('shift type utilities', () => {
  describe('getShiftType', () => {
    it('returns null for cards without Shift', () => {
      const card = createCard({keywords: ['Bodyguard']});
      expect(getShiftType(card)).toBeNull();
    });

    it('returns null for cards with no keywords', () => {
      const card = createCard({});
      expect(getShiftType(card)).toBeNull();
    });

    it('returns standard with cost for regular Shift', () => {
      const card = createCard({keywords: ['Shift 5']});
      expect(getShiftType(card)).toEqual({kind: 'standard', cost: 5, payment: 'ink'});
    });

    it('returns classification with cost for Puppy Shift', () => {
      const card = createCard({keywords: ['Puppy Shift 3']});
      expect(getShiftType(card)).toEqual({
        kind: 'classification',
        classification: 'Puppy',
        cost: 3,
        payment: 'ink',
      });
    });

    it('returns universal with cost for Universal Shift', () => {
      const card = createCard({keywords: ['Universal Shift 4']});
      expect(getShiftType(card)).toEqual({kind: 'universal', cost: 4, payment: 'ink'});
    });

    it('returns standard for Temporary Shift (same-name shift, not a "Temporary" classification)', () => {
      const card = createCard({keywords: ['Temporary Shift 7']});
      expect(getShiftType(card)).toEqual({kind: 'standard', cost: 7, payment: 'ink'});
    });

    it('routes Combo/Duo Shift on a compound-name team card to standard', () => {
      const combo = createCard({name: 'Sulley & Boo', keywords: ['Combo Shift 4']});
      expect(getShiftType(combo)).toEqual({kind: 'standard', cost: 4, payment: 'ink'});
      const duo = createCard({name: 'Mickey Mouse & Minnie Mouse', keywords: ['Duo Shift 0']});
      expect(getShiftType(duo)).toEqual({kind: 'standard', cost: 0, payment: 'ink'});
    });

    it('returns multi-word classification for Temporary Red Panda Shift', () => {
      const card = createCard({name: 'Sun Yee', keywords: ['Temporary Red Panda Shift 2']});
      expect(getShiftType(card)).toEqual({
        kind: 'classification',
        classification: 'Red Panda',
        cost: 2,
        payment: 'ink',
      });
    });

    it('returns classification for Floodborn and Madrigal Shift', () => {
      expect(getShiftType(createCard({name: 'The Vine', keywords: ['Floodborn Shift 7']}))).toEqual({
        kind: 'classification',
        classification: 'Floodborn',
        cost: 7,
        payment: 'ink',
      });
      expect(
        getShiftType(createCard({name: 'The Madrigal Family', keywords: ['Madrigal Shift 3']})),
      ).toEqual({kind: 'classification', classification: 'Madrigal', cost: 3, payment: 'ink'});
    });

    it('returns named-item for an item-target Shift ("items named X" reminder)', () => {
      const posey = createCard({
        name: 'Posey',
        keywords: ['Potato Shift 5'],
        text: 'Potato Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your items named Potato.)',
      });
      expect(getShiftType(posey)).toEqual({
        kind: 'named-item',
        itemName: 'Potato',
        cost: 5,
        payment: 'ink',
      });
    });

    it('captures a full item name with internal periods (does not truncate at "Mr.")', () => {
      const card = createCard({
        name: 'Spud',
        keywords: ['Spud Shift 3'],
        text: 'Spud Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of one of your items named Mr. Potato Head.)',
      });
      expect(getShiftType(card)).toEqual({
        kind: 'named-item',
        itemName: 'Mr. Potato Head',
        cost: 3,
        payment: 'ink',
      });
    });

    it('reads a Shift paid in ink drops as its own payment, never a free Shift (Baymax - Amped Up)', () => {
      const card = createCard({name: 'Baymax', keywords: ['Shift Remove 2 ink drops']});
      expect(getShiftType(card)).toEqual({kind: 'standard', cost: 2, payment: 'ink-drops'});
    });
  });

  describe('hasAnyShift', () => {
    it('returns true for any Shift variant', () => {
      expect(hasAnyShift(createCard({keywords: ['Shift 5']}))).toBe(true);
      expect(hasAnyShift(createCard({keywords: ['Puppy Shift 3']}))).toBe(true);
      expect(hasAnyShift(createCard({keywords: ['Universal Shift 4']}))).toBe(true);
      expect(hasAnyShift(createCard({keywords: ['Temporary Shift 7']}))).toBe(true);
    });

    it('returns false for non-Shift cards', () => {
      expect(hasAnyShift(createCard({keywords: ['Bodyguard']}))).toBe(false);
      expect(hasAnyShift(createCard({}))).toBe(false);
    });
  });

  describe('getInkDropGain', () => {
    it("returns the largest ink-drop gain among the card's effects (Merlin - Ink Drop Tinkerer)", () => {
      const merlin = createCard({
        text: 'WHAT A DISCOVERY! When you play this character, get 1 ink drop. If you used Shift to play him, get 2 ink drops instead.',
      });
      expect(getInkDropGain(merlin)).toBe(2);
    });

    it('returns 0 when the card mentions ink drops without getting any (Baymax - Amped Up)', () => {
      const ampedUp = createCard({
        text: 'SUPERCHARGE If you would get an ink drop, you may put the top card of your deck into your inkwell facedown and exerted instead.',
      });
      expect(getInkDropGain(ampedUp)).toBe(0);
    });
  });
});

describe('ink compatibility utilities', () => {
  describe('isDualInk', () => {
    it('returns false for single-ink cards', () => {
      const card = createCard({ink: 'Amethyst'});
      expect(isDualInk(card)).toBe(false);
    });

    it('returns true for dual-ink cards', () => {
      const card = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      expect(isDualInk(card)).toBe(true);
    });
  });

  describe('getInks', () => {
    it('returns single ink in array for single-ink card', () => {
      const card = createCard({ink: 'Ruby'});
      expect(getInks(card)).toEqual(['Ruby']);
    });

    it('returns both inks for dual-ink card', () => {
      const card = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(getInks(card)).toEqual(['Emerald', 'Sapphire']);
    });
  });

  describe('canShareDeck', () => {
    it('two single-ink cards can always share a deck', () => {
      const amber = createCard({ink: 'Amber'});
      const steel = createCard({ink: 'Steel'});
      expect(canShareDeck(amber, steel)).toBe(true);
    });

    it('single-ink card compatible with dual-ink when its ink is in the pair', () => {
      const dual = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      const single = createCard({ink: 'Sapphire'});
      expect(canShareDeck(dual, single)).toBe(true);
      expect(canShareDeck(single, dual)).toBe(true); // order-independent
    });

    it('single-ink card incompatible with dual-ink when its ink is NOT in the pair', () => {
      const dual = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      const single = createCard({ink: 'Ruby'});
      expect(canShareDeck(dual, single)).toBe(false);
      expect(canShareDeck(single, dual)).toBe(false);
    });

    it('two dual-ink cards with same pair are compatible', () => {
      const a = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      const b = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(canShareDeck(a, b)).toBe(true);
    });

    it('two dual-ink cards with same pair in reversed order are compatible', () => {
      const a = createCard({ink: 'Sapphire', ink2: 'Emerald'});
      const b = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(canShareDeck(a, b)).toBe(true);
    });

    it('two dual-ink cards with different pairs are incompatible', () => {
      const a = createCard({ink: 'Amethyst', ink2: 'Sapphire'});
      const b = createCard({ink: 'Emerald', ink2: 'Sapphire'});
      expect(canShareDeck(a, b)).toBe(false);
    });
  });
});

describe('getShiftBaseNames', () => {
  it('returns the single base name for an atomic card', () => {
    expect(getShiftBaseNames(createCard({name: 'Ming Lee'}))).toEqual(['Ming Lee']);
  });

  it('decomposes a "Team" compound name into the full name plus both halves', () => {
    expect(getShiftBaseNames(createCard({name: 'Belle & Beast'}))).toEqual([
      'Belle & Beast',
      'Belle',
      'Beast',
    ]);
  });

  it('keeps multi-word component names intact (splits on "&", not spaces)', () => {
    expect(getShiftBaseNames(createCard({name: 'Carl Fredricksen & Russell'}))).toEqual([
      'Carl Fredricksen & Russell',
      'Carl Fredricksen',
      'Russell',
    ]);
  });
});

describe('named companion utilities', () => {
  describe('getNamedReferences', () => {
    it('returns empty for cards with no text', () => {
      expect(getNamedReferences(createCard({}))).toEqual([]);
    });

    it('returns empty for text without "named"', () => {
      expect(getNamedReferences(createCard({text: 'Draw a card.'}))).toEqual([]);
    });

    it('extracts a simple single-word name', () => {
      const card = createCard({
        text: 'While you have a character named Anna in play, draw a card.',
      });
      expect(getNamedReferences(card)).toEqual(['Anna']);
    });

    it('extracts multi-word names', () => {
      const card = createCard({
        text: 'If you have a character named Prince John in play, you pay 1 less.',
      });
      expect(getNamedReferences(card)).toEqual(['Prince John']);
    });

    it('extracts names with periods (Mr. Smee)', () => {
      const card = createCard({
        text: 'While you have a character named Mr. Smee in play, this character gains Resist +1.',
      });
      expect(getNamedReferences(card)).toEqual(['Mr. Smee']);
    });

    it('keeps spaced initials inside a name (P. J. Pete)', () => {
      const card = createCard({text: 'Your characters named P. J. Pete get +1 strength.'});
      expect(getNamedReferences(card)).toEqual(['P. J. Pete']);
    });

    it('extracts names with lowercase articles (Queen of Hearts)', () => {
      const card = createCard({
        text: 'While you have a character named Queen of Hearts in play, draw a card.',
      });
      expect(getNamedReferences(card)).toEqual(['Queen of Hearts']);
    });

    it('extracts names with "The" prefix (The Headless Horseman)', () => {
      const card = createCard({
        text: 'Your characters named The Headless Horseman get +1 strength.',
      });
      expect(getNamedReferences(card)).toEqual(['The Headless Horseman']);
    });

    it('extracts names ending with exclamation mark', () => {
      const card = createCard({
        text: 'If you have a card named Pull the Lever! in your discard, draw a card.',
      });
      expect(getNamedReferences(card)).toEqual(['Pull the Lever!']);
    });

    it('handles "both X and Y" conjunction', () => {
      const card = createCard({
        text: 'If you have a character named both Chip and Dale in play, draw 3 cards.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Chip');
      expect(refs).toContain('Dale');
      expect(refs).toHaveLength(2);
    });

    it('handles "X or Y" conjunction', () => {
      const card = createCard({
        text: 'While you have a character named Miss Bianca or Bernard in play, gain Evasive.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Miss Bianca');
      expect(refs).toContain('Bernard');
    });

    it('handles "X and Y" conjunction without "both"', () => {
      const card = createCard({
        text: 'Whenever you quest with characters named Dewey and Louie in play, draw.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Dewey');
      expect(refs).toContain('Louie');
    });

    it('extracts multiple named references from the same card', () => {
      const card = createCard({
        text: 'If you have a card named Pull the Lever! in your discard, you may search your deck for a card named Wrong Lever! and reveal that card.',
      });
      const refs = getNamedReferences(card);
      expect(refs).toContain('Pull the Lever!');
      expect(refs).toContain('Wrong Lever!');
      expect(refs).toHaveLength(2);
    });

    it('strips Shift parentheticals before scanning', () => {
      const card = createCard({
        text: 'Shift 5 (You may pay 5 to play this on top of one of your characters named Elsa.) ICE POWER Draw a card.',
      });
      // "named Elsa" is inside the Shift parenthetical — should be stripped
      expect(getNamedReferences(card)).toEqual([]);
    });

    it('filters out generic game terms like "card"', () => {
      const card = createCard({
        text: 'Name a card, then reveal the top card of your deck. If it is the named card, put it into your hand.',
      });
      expect(getNamedReferences(card)).toEqual([]);
    });

    it('handles comma-terminated names (named Pete, you may)', () => {
      const card = createCard({
        text: "Reveal the top card of your deck. If it's a character card named Pete, you may play it for free.",
      });
      expect(getNamedReferences(card)).toEqual(['Pete']);
    });

    it("handles possessive names (Maurice's Machine)", () => {
      const card = createCard({
        text: "If the banished item is named Maurice's Machine, you may also banish chosen character.",
      });
      expect(getNamedReferences(card)).toEqual(["Maurice's Machine"]);
    });

    it('deduplicates repeated references', () => {
      const card = createCard({
        text: 'Your characters named Elsa get +1 lore. Characters named Elsa gain Resist +1.',
      });
      expect(getNamedReferences(card)).toEqual(['Elsa']);
    });

    it('handles names with hyphens (Fix-It Felix)', () => {
      const card = createCard({
        text: 'While you have a character named Fix-It Felix in play, gain +1 lore.',
      });
      expect(getNamedReferences(card)).toEqual(['Fix-It Felix']);
    });
  });

  describe('classifyNamedEffect', () => {
    it('returns minor for cards with no text', () => {
      expect(classifyNamedEffect(createCard({}))).toBe('minor');
    });

    it('detects game-winning: free play', () => {
      const card = createCard({
        text: "If it's a character card named Pete, you may play it for free.",
      });
      expect(classifyNamedEffect(card)).toBe('game-winning');
    });

    it('detects game-winning: draw multiple cards', () => {
      const card = createCard({
        text: 'If you have characters named Dewey and Louie in play, draw 3 cards.',
      });
      expect(classifyNamedEffect(card)).toBe('game-winning');
    });

    it('detects game-winning: deck search', () => {
      const card = createCard({
        text: 'Search your deck for a card named Wrong Lever! and put it into your hand.',
      });
      expect(classifyNamedEffect(card)).toBe('game-winning');
    });

    it('detects strong: cost reduction (costs X less)', () => {
      const card = createCard({
        text: 'Characters named Elsa cost 2 less to play.',
      });
      expect(classifyNamedEffect(card)).toBe('strong');
    });

    it('detects strong: cost reduction (pay X less)', () => {
      const card = createCard({
        text: 'If you have a character named Prince John in play, you pay 1 less to play this item.',
      });
      expect(classifyNamedEffect(card)).toBe('strong');
    });

    it('detects strong: keyword grants', () => {
      const card = createCard({
        text: 'While you have a character named Elsa in play, this character gains Rush.',
      });
      expect(classifyNamedEffect(card)).toBe('strong');
    });

    it('detects moderate: stat boosts', () => {
      const card = createCard({
        text: 'Your characters named Darkwing Duck get +2 strength.',
      });
      expect(classifyNamedEffect(card)).toBe('moderate');
    });

    it('detects moderate: Resist', () => {
      const card = createCard({
        text: 'While you have a character named Mr. Smee in play, this character gains Resist +1.',
      });
      expect(classifyNamedEffect(card)).toBe('moderate');
    });

    it('reads "can’t be challenged" printed with a typographic apostrophe as moderate', () => {
      const card = createCard({
        text: 'Your characters named Pete can’t be challenged.',
      });
      expect(classifyNamedEffect(card)).toBe('moderate');
    });

    it('detects hostile: banish near named (same clause)', () => {
      const card = createCard({
        text: 'You may banish chosen character named Elsa.',
      });
      expect(classifyNamedEffect(card)).toBe('hostile');
    });

    it('does not false-positive hostile when banish and named are far apart', () => {
      const card = createCard({
        text: 'When you play this character, you may banish chosen item of yours to draw a card. ABILITY TWO Your characters named Darkwing Duck get +1 lore.',
      });
      // "banish" and "named" are >40 chars apart — should NOT be hostile
      expect(classifyNamedEffect(card)).not.toBe('hostile');
    });

    it('does not read a passive "was banished" condition as hostile', () => {
      const card = createCard({
        text: 'If a character named Buzz Lightyear was banished this turn, you may play this item for free.',
      });
      expect(classifyNamedEffect(card)).toBe('game-winning');
    });

    it('returns minor for generic effects', () => {
      const card = createCard({
        text: 'While you have a character named Stitch in play, this character can quest.',
      });
      expect(classifyNamedEffect(card)).toBe('minor');
    });
  });

  describe('NAMED_EFFECT_SCORES', () => {
    it('maps tiers to correct numeric scores', () => {
      expect(NAMED_EFFECT_SCORES['game-winning']).toBe(8);
      expect(NAMED_EFFECT_SCORES.strong).toBe(7);
      expect(NAMED_EFFECT_SCORES.moderate).toBe(6);
      expect(NAMED_EFFECT_SCORES.minor).toBe(5);
      expect(NAMED_EFFECT_SCORES.hostile).toBe(4);
    });
  });
});

describe('normalizeCardText', () => {
  it('joins lines and straightens typographic apostrophes', () => {
    const card = createCard({text: 'They can’t ready.\nGET ‘EM'});
    expect(normalizeCardText(card)).toBe("They can't ready. GET 'EM");
  });
});

// #628: a condition on one named item ("if you have an item named X") is not an item payoff.
describe('getItemRoles: named-item conditions', () => {
  const tornScrap = createCard({
    fullName: 'Torn Scrap',
    type: 'Item',
    text: 'FOND MEMORIES ⟳, 1 ⬡ — If you have 10 or more cards in your discard, draw a card.\nTOGETHER AGAIN When this card is put into your discard from your deck, if you have an item named Rivera Family Photo in play, you may play this item from your discard for free.',
  });
  const edna = createCard({
    fullName: 'Edna Mode - Super Suit Designer',
    text: "KEY ACCESSORY ⟳ — Ready chosen item.\nALL THE BASICS While you have an item\nnamed Super Suit in play, this character gains\nWard. (Opponents can't choose them except to\nchallenge.)",
  });
  const castle = createCard({
    fullName: 'Castle of the Horned King - Bastion of Evil',
    type: 'Location',
    text: 'INTO THE GLOOM Once during your turn, whenever a character quests\nwhile here, you may ready chosen item.',
  });

  it('does not read a condition on one named item as an item payoff', () => {
    expect(getItemRoles(tornScrap)).not.toContain('payoff-static');
    expect(getItemRoles(createCard({text: 'If you have an item named Magic Mirror in play, draw a card.'}))).toEqual([]);
    expect(getItemRoles(createCard({text: 'If you have 2 or more items named Magic Mirror in play, draw a card.'}))).toEqual([]);
  });

  it('reads an item count, or readying an item, as an item payoff', () => {
    const itemCount = createCard({text: 'While you have 2 or more items in play, this character gets +1 ◊.'});
    expect(getItemRoles(itemCount)).toContain('payoff-static');
    expect(getItemRoles(edna)).toContain('payoff-static');
    expect(getItemRoles(castle)).toContain('payoff-static');
  });
});

// #628: a tribe word inside a card name ("an item named Super Suit") is not a tribe check.
describe('getTribalRoles: tribe words inside card names', () => {
  it('does not read a named card as a tribe presence check', () => {
    const edna = createCard({
      fullName: 'Edna Mode - Super Suit Designer',
      text: "KEY ACCESSORY ⟳ — Ready chosen item.\nALL THE BASICS While you have an item\nnamed Super Suit in play, this character gains\nWard. (Opponents can't choose them except to\nchallenge.)",
    });
    expect(getTribalRoles(edna, TRIBAL_SPECS.super)).toEqual([]);
  });

  it('still reads a tribe character in play as a presence check', () => {
    const superCheck = createCard({text: 'While you have a Super character in play, this character gets +1 ◊.'});
    expect(getTribalRoles(superCheck, TRIBAL_SPECS.super)).toContain('in-play-check');
  });
});

// #628: moving a character "for free" when it enters play is not playing a card for free.
describe('getBounceRoles: re-buy value on entering play', () => {
  it('does not read a free move as re-buy value', () => {
    const arthur = createCard({
      fullName: "Arthur - Merlin's Assistant",
      text: 'MAGICAL TRAVEL When you play this character, you may move him to a location for free.\nARCANE DELIVERIES Once during your turn, whenever this character moves to a location, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
    });
    expect(getBounceRoles(arthur)).not.toContain('rebuy-payoff');
  });

  it('keeps a free play, and a gated draw, as re-buy value', () => {
    const freePlay = createCard({
      text: 'When you play this character, you may play a character with cost 2 or less for free.',
    });
    // Owner ruling: enter-play abilities gated on a condition stay replay targets.
    const mim = createCard({
      fullName: 'Madam Mim - Resourceful Trickster',
      text: 'UPPER HAND When you play this character, if you removed an ink drop to play her, draw 2 cards.\nBAUBLE GAME Once during your turn, whenever you remove an ink drop, draw a card.',
    });
    const stitch = createCard({
      fullName: 'Stitch - Carefree Surfer',
      text: 'OHANA When you play this character, if you have 2 or\nmore other characters in play, you may draw 2 cards.',
    });
    expect(getBounceRoles(freePlay)).toContain('rebuy-payoff');
    expect(getBounceRoles(mim)).toContain('rebuy-payoff');
    expect(getBounceRoles(stitch)).toContain('rebuy-payoff');
  });
});
