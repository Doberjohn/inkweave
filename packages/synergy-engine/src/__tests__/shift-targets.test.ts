import {describe, it, expect} from 'vitest';
import {getNamedReferences, getShiftAliasNames, isDuoShift} from '../utils';
import {getRuleById} from '../engine';
import {TUNING} from '../data/tuning';
import {createCard} from './fixtures';
import type {LorcanaCard, SynergyRule} from '../types';

// Admin's tuning editor changes the tiers' scores and lines in tuning.json, so tests read them,
// never literals. Several tiers share a score, so each test names its tier by the line too.
const TIERS = TUNING.ruleTexts['shift-targets'];

/** A tier's line as the pair shows it: the Shift card is {A} on its own page, {B} on the base's. */
function tierLine(key: string, from: 'shift' | 'base' = 'shift'): string {
  const [shift, base] = from === 'shift' ? ['{A}', '{B}'] : ['{B}', '{A}'];
  return TIERS[key].text!.replaceAll('<SHIFT>', shift).replaceAll('<BASE>', base);
}

/** The score and line a tier gives the pair. */
const tier = (key: string, from: 'shift' | 'base' = 'shift') => ({
  score: TIERS[key].score,
  explanation: tierLine(key, from),
});

describe('Shift Targets', () => {
  const shiftRule = getRuleById('shift-targets')!;

  type ShiftSetupOpts = {
    shiftId?: string;
    shiftName?: string;
    shiftFullName?: string;
    shiftCost?: number;
    shiftKeyword?: string;
    shiftInkwell?: boolean;
    shiftClassifications?: string[];
    shiftText?: string;
    baseId?: string;
    baseName?: string;
    baseFullName?: string;
    baseCost?: number;
    baseInkwell?: boolean;
    baseText?: string;
  };

  function shiftSetup(opts: ShiftSetupOpts = {}) {
    const shiftCard = createCard({
      id: opts.shiftId ?? 'elsa-shift',
      name: opts.shiftName ?? 'Elsa',
      fullName: opts.shiftFullName ?? 'Elsa - Ice Maker',
      cost: opts.shiftCost ?? 7,
      keywords: [opts.shiftKeyword ?? 'Shift 5'],
      inkwell: opts.shiftInkwell ?? true,
      ...(opts.shiftClassifications && {classifications: opts.shiftClassifications}),
      ...(opts.shiftText !== undefined && {text: opts.shiftText}),
    });
    const base = createCard({
      id: opts.baseId ?? 'elsa-base',
      name: opts.baseName ?? 'Elsa',
      fullName: opts.baseFullName ?? 'Elsa - Snow Queen',
      cost: opts.baseCost ?? 4,
      inkwell: opts.baseInkwell ?? true,
      ...(opts.baseText !== undefined && {text: opts.baseText}),
    });
    return {shiftCard, base};
  }

  it('should find same-named characters for Shift', () => {
    const {shiftCard, base} = shiftSetup({shiftClassifications: ['Floodborn']});
    const anna = createCard({id: 'anna-1', name: 'Anna', cost: 3});

    const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base, anna]);
    expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
    expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
  });

  it('should find Shift cards when selecting a base character (reverse)', () => {
    const {shiftCard, base} = shiftSetup();
    const anna = createCard({id: 'anna-1', name: 'Anna', cost: 3});

    const synergies = shiftRule.findSynergies(base, [shiftCard, base, anna]);
    expect(synergies.find((s) => s.card.id === 'elsa-shift')).toBeDefined();
    expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
  });

  it('should show other Shift cards with same base name', () => {
    const {shiftCard: shift1, base} = shiftSetup({
      shiftId: 'elsa-shift-1',
      baseCost: 3,
    });
    const {shiftCard: shift2} = shiftSetup({
      shiftId: 'elsa-shift-2',
      shiftCost: 6,
      shiftKeyword: 'Shift 4',
    });

    const synergies = shiftRule.findSynergies(shift1, [shift1, shift2, base]);
    expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
    expect(synergies.find((s) => s.card.id === 'elsa-shift-2')).toBeDefined();
  });

  it('should find both halves of a "Team" compound-name Shift card', () => {
    const team = createCard({
      id: 'belle-beast-shift',
      name: 'Belle & Beast',
      fullName: 'Belle & Beast - Certain as the Sun',
      cost: 8,
      keywords: ['Shift 6'],
    });
    const belle = createCard({id: 'belle-base', name: 'Belle', cost: 2});
    const beast = createCard({id: 'beast-base', name: 'Beast', cost: 3});
    const anna = createCard({id: 'anna-1', name: 'Anna', cost: 3});
    const pool = [team, belle, beast, anna];

    // Forward: the team shifter lands on either named half, not on Anna.
    const forward = shiftRule.findSynergies(team, pool);
    expect(forward.find((s) => s.card.id === 'belle-base')).toBeDefined();
    expect(forward.find((s) => s.card.id === 'beast-base')).toBeDefined();
    expect(forward.find((s) => s.card.id === 'anna-1')).toBeUndefined();

    // Reverse: a "Belle" base finds the team shifter.
    const reverse = shiftRule.findSynergies(belle, pool);
    expect(reverse.find((s) => s.card.id === 'belle-beast-shift')).toBeDefined();
  });

  it('should treat Combo Shift on a team card as a same-name shift', () => {
    const combo = createCard({
      id: 'sulley-boo',
      name: 'Sulley & Boo',
      fullName: 'Sulley & Boo - Scare Buddies',
      cost: 6,
      keywords: ['Combo Shift 4'],
    });
    const sulley = createCard({id: 'sulley-base', name: 'Sulley', cost: 3});
    const boo = createCard({id: 'boo-base', name: 'Boo', cost: 2});
    const pool = [combo, sulley, boo];

    const forward = shiftRule.findSynergies(combo, pool);
    expect(forward.find((s) => s.card.id === 'sulley-base')).toBeDefined();
    expect(forward.find((s) => s.card.id === 'boo-base')).toBeDefined();

    // Reverse: either named base finds the Combo team shifter (Rule 1 is bidirectional).
    expect(
      shiftRule.findSynergies(sulley, pool).find((s) => s.card.id === 'sulley-boo'),
    ).toBeDefined();
    expect(shiftRule.findSynergies(boo, pool).find((s) => s.card.id === 'sulley-boo')).toBeDefined();
  });

  it('should match a multi-word classification Shift (Temporary Red Panda) to its class', () => {
    const sunYee = createCard({
      id: 'sun-yee',
      name: 'Sun Yee',
      fullName: 'Sun Yee - Soul of the Red Panda',
      cost: 5,
      keywords: ['Temporary Red Panda Shift 2'],
    });
    const meilin = createCard({id: 'meilin', name: 'Meilin Lee', cost: 3, classifications: ['Red Panda']});
    const notPanda = createCard({id: 'mulan', name: 'Mulan', cost: 3, classifications: ['Hero']});
    const pool = [sunYee, meilin, notPanda];

    // Forward: the Red Panda shifter lands on Red Panda characters, not on Mulan.
    const forward = shiftRule.findSynergies(sunYee, pool);
    expect(forward.find((s) => s.card.id === 'meilin')).toBeDefined();
    expect(forward.find((s) => s.card.id === 'mulan')).toBeUndefined();

    // Reverse: a Red Panda character finds the classification shifter.
    const reverse = shiftRule.findSynergies(meilin, pool);
    expect(reverse.find((s) => s.card.id === 'sun-yee')).toBeDefined();
  });

  it('should not match non-Character cards', () => {
    expect(shiftRule.matches(createCard({type: 'Action', keywords: ['Shift 3']}))).toBe(false);
  });

  describe('score calculation', () => {
    type ShiftPairOpts = {
      shiftCost: number;
      shiftKeyword: string;
      baseCost: number;
      baseInkwell: boolean;
      shiftInkwell?: boolean;
    };

    function shiftPair(opts: ShiftPairOpts) {
      const {shiftCard, base} = shiftSetup({
        shiftCost: opts.shiftCost,
        shiftKeyword: opts.shiftKeyword,
        shiftInkwell: opts.shiftInkwell ?? true,
        baseCost: opts.baseCost,
        baseInkwell: opts.baseInkwell,
      });
      return shiftRule.findSynergies(shiftCard, [shiftCard, base]);
    }

    it.each<{
      label: string;
      shiftCost: number;
      shiftKeyword: string;
      baseCost: number;
      baseInkwell: boolean;
      tierKey: string;
      shiftInkwell?: boolean;
    }>([
      {
        label: 'on-curve both inkable (curveGap 1)',
        shiftCost: 7,
        shiftKeyword: 'Shift 5',
        baseCost: 4,
        baseInkwell: true,
        tierKey: 'curve.bothInkable',
      },
      {
        label: 'on-curve one inkable (curveGap 1)',
        shiftCost: 7,
        shiftKeyword: 'Shift 5',
        baseCost: 4,
        baseInkwell: false,
        tierKey: 'curve.oneInkable',
      },
      {
        label: 'on-curve neither inkable (curveGap 1)',
        shiftCost: 7,
        shiftKeyword: 'Shift 5',
        baseCost: 4,
        baseInkwell: false,
        tierKey: 'curve.neitherInkable',
        shiftInkwell: false,
      },
      {
        label: 'curveGap 2 with inkable base',
        shiftCost: 8,
        shiftKeyword: 'Shift 6',
        baseCost: 4,
        baseInkwell: true,
        tierKey: 'curve.gap2',
      },
      {
        label: 'slightly off-curve (curveGap 3)',
        shiftCost: 7,
        shiftKeyword: 'Shift 5',
        baseCost: 2,
        baseInkwell: true,
        tierKey: 'curve.gap3',
      },
      {
        label: 'far off-curve (curveGap >= 4)',
        shiftCost: 7,
        shiftKeyword: 'Shift 5',
        baseCost: 1,
        baseInkwell: true,
        tierKey: 'curve.poor',
      },
      {
        label: 'same-cost-as-shift (curveGap 0)',
        shiftCost: 7,
        shiftKeyword: 'Shift 5',
        baseCost: 5,
        baseInkwell: true,
        tierKey: 'curve.gap0',
      },
    ])('$label reads $tierKey', ({tierKey, ...pairOpts}) => {
      const synergies = shiftPair(pairOpts);
      expect(synergies[0]).toMatchObject(tier(tierKey));
    });

    it('should produce consistent score in reverse direction', () => {
      const {shiftCard, base} = shiftSetup();
      const forward = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
      const reverse = shiftRule.findSynergies(base, [shiftCard, base]);
      expect(forward[0].score).toBe(reverse[0].score);
    });

    it('regression: small shift onto cheap base reads curve.bothInkable, not curve.poor (#108)', () => {
      const synergies = shiftPair({
        shiftCost: 4,
        shiftKeyword: 'Shift 3',
        baseCost: 2,
        baseInkwell: true,
      });
      expect(synergies[0]).toMatchObject(tier('curve.bothInkable'));
    });

    it('regression: huge shift onto tiny base reads curve.poor, not a higher tier (#108)', () => {
      const synergies = shiftPair({
        shiftCost: 10,
        shiftKeyword: 'Shift 8',
        baseCost: 2,
        baseInkwell: true,
      });
      expect(synergies[0]).toMatchObject(tier('curve.poor'));
    });
  });

  describe('free Shift scoring', () => {
    const conditionText = "If a card left a player's discard this turn, this card gains Shift 0.";
    const conditionBaseText =
      "When you play this character, you may put a card from chosen player's discard on the bottom of their deck.";

    function freeShiftSetup(
      baseCost: number,
      opts: {shiftText?: string; baseText?: string} = {},
    ) {
      return shiftSetup({
        shiftId: 'anna-shift',
        shiftName: 'Anna',
        shiftFullName: 'Anna - Soothing Sister',
        shiftCost: 5,
        shiftKeyword: 'Shift 0',
        shiftText: opts.shiftText,
        baseId: 'anna-base',
        baseName: 'Anna',
        baseFullName: 'Anna - Base',
        baseCost,
        baseInkwell: true,
        baseText: opts.baseText,
      });
    }

    // A base that switches the condition on scores one above its own tier, at most 10.
    const activated = {
      score: Math.min(TIERS['free.cheapBase'].score! + 1, 10),
      explanation: tierLine('activationBonus'),
    };

    it.each<{
      label: string;
      baseCost: number;
      expected: {score?: number; explanation: string};
      shiftText?: string;
      baseText?: string;
    }>([
      {
        label: 'base activates condition: one above its tier',
        baseCost: 2,
        expected: activated,
        shiftText: conditionText,
        baseText: conditionBaseText,
      },
      {
        label: 'base activates a condition printed with typographic apostrophes',
        baseCost: 2,
        expected: activated,
        shiftText: conditionText.replace("'", '’'),
        baseText: conditionBaseText.replace("'", '’'),
      },
      {label: 'cheap base (cost <= 3)', baseCost: 2, expected: tier('free.cheapBase')},
      {label: 'mid-cost base (cost 4-5)', baseCost: 4, expected: tier('free.midBase')},
      {label: 'expensive base (cost 6+)', baseCost: 7, expected: tier('free.expensiveBase')},
    ])('$label', ({baseCost, expected, shiftText, baseText}) => {
      const {shiftCard, base} = freeShiftSetup(baseCost, {shiftText, baseText});
      const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
      expect(synergies[0]).toMatchObject(expected);
    });
  });

  describe('Duo Shift scoring', () => {
    // Duo Shift lands on two characters at once, one with each name, so a single half scores
    // one tier below a free Shift's base.
    const duo = createCard({
      id: 'mickey-minnie-duo',
      name: 'Mickey Mouse & Minnie Mouse',
      fullName: 'Mickey Mouse & Minnie Mouse - Adventuring Duo',
      cost: 7,
      keywords: ['Duo Shift 0'],
      text: 'Duo Shift 0 ⬡ (You may pay 0 ⬡ to play this on\ntop of two of your characters, one named Mickey\nMouse and one named Minnie Mouse.)\nTHINKING OF YOU If this character would be\nbanished, put them into your inkwell facedown\nand exerted instead.',
    });
    const mickey = (version: string, cost: number) =>
      createCard({
        id: 'mickey',
        name: 'Mickey Mouse',
        fullName: `Mickey Mouse - ${version}`,
        cost,
      });

    it.each([
      {
        label: 'cheap half (cost <= 3)',
        version: 'Steamboat Pilot',
        cost: 3,
        tierKey: 'duo.cheapHalf',
      },
      {
        label: 'mid-cost half (cost 4-5)',
        version: 'Inquisitive Explorer',
        cost: 4,
        tierKey: 'duo.midHalf',
      },
      {
        label: 'expensive half (cost 6+)',
        version: 'Snowboard Ace',
        cost: 6,
        tierKey: 'duo.expensiveHalf',
      },
    ])('$label reads $tierKey, from either card', ({version, cost, tierKey}) => {
      const half = mickey(version, cost);
      const pool = [duo, half];
      expect(shiftRule.findSynergies(duo, pool)[0]).toMatchObject(tier(tierKey, 'shift'));
      expect(shiftRule.findSynergies(half, pool)[0]).toMatchObject(tier(tierKey, 'base'));
    });

    it('leaves a Combo Shift, which takes either half, as a plain team Shift', () => {
      const combo = createCard({
        name: 'Sulley & Boo',
        keywords: ['Combo Shift 4'],
        text: 'Combo Shift 4 ⬡ (You may pay 4 ⬡ to play this on top\nof one of your characters named Sulley, one named Boo,\nor one of each.)',
      });
      expect(isDuoShift(duo)).toBe(true);
      expect(isDuoShift(combo)).toBe(false);
    });
  });

  describe('ink-drop Shift scoring', () => {
    // Baymax - Amped Up: "Shift Remove 2 ink drops". Drops are their own payment, so the pair
    // scores by who supplies them, never on the ink curve or as a free Shift.
    function inkDropSetup(baseCost: number, baseText: string) {
      return shiftSetup({
        shiftId: 'baymax-shift',
        shiftName: 'Baymax',
        shiftFullName: 'Baymax - Amped Up',
        shiftKeyword: 'Shift Remove 2 ink drops',
        baseId: 'baymax-base',
        baseName: 'Baymax',
        baseFullName: 'Baymax - Lab Assistant',
        baseCost,
        baseText,
      });
    }

    it('reads drops.basePays both ways when the base gets the drops itself (Baymax - Lab Assistant)', () => {
      const {shiftCard, base} = inkDropSetup(
        4,
        'RESUPPLY When you play this character, if you have 2 or more items in play, get 2 ink drops.',
      );
      const pool = [shiftCard, base];
      expect(shiftRule.findSynergies(shiftCard, pool)[0]).toMatchObject(
        tier('drops.basePays', 'shift'),
      );
      expect(shiftRule.findSynergies(base, pool)[0]).toMatchObject(tier('drops.basePays', 'base'));
    });

    it('reads drops.outside, not a free Shift, when the base gets fewer drops than the Shift removes', () => {
      // A cost-1 base would read curve.bothInkable (gap 1), or free.cheapBase as a free Shift.
      const {shiftCard, base} = inkDropSetup(1, 'When you play this character, get 1 ink drop.');
      expect(shiftRule.findSynergies(shiftCard, [shiftCard, base])[0]).toMatchObject(
        tier('drops.outside'),
      );
    });
  });
});

describe('Puppy Shift', () => {
  const shiftRule = getRuleById('shift-targets')!;

  it('should find Puppy characters as targets for Puppy Shift', () => {
    const thunderbolt = createCard({
      id: 'thunderbolt',
      name: 'Thunderbolt',
      cost: 5,
      ink: 'Amber',
      ink2: 'Sapphire',
      keywords: ['Puppy Shift 3', 'Bodyguard'],
      classifications: ['Floodborn', 'Hero'],
    });
    const puppy = createCard({
      id: 'dalmatian',
      name: 'Dalmatian Puppy',
      cost: 2,
      ink: 'Amber',
      classifications: ['Storyborn', 'Puppy'],
    });
    const nonPuppy = createCard({id: 'elsa-base', name: 'Elsa', cost: 3, ink: 'Sapphire'});

    const synergies = shiftRule.findSynergies(thunderbolt, [puppy, nonPuppy]);
    expect(synergies.find((s) => s.card.id === 'dalmatian')).toBeDefined();
    expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeUndefined();
  });

  it('should show Puppy Shift card when selecting a Puppy character (reverse)', () => {
    const thunderbolt = createCard({
      id: 'thunderbolt',
      name: 'Thunderbolt',
      cost: 5,
      keywords: ['Puppy Shift 3', 'Bodyguard'],
    });
    const puppy = createCard({
      id: 'dalmatian',
      name: 'Dalmatian Puppy',
      cost: 2,
      classifications: ['Storyborn', 'Puppy'],
    });

    const synergies = shiftRule.findSynergies(puppy, [thunderbolt]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].card.id).toBe('thunderbolt');
  });
});

describe('Item-targeting Shift (Potato Shift)', () => {
  const shiftRule = getRuleById('shift-targets')!;

  // "Potato Shift 5" shifts onto an *item* named Potato, not a character. The item name
  // comes from the reminder text, so the keyword prefix ("Potato") must NOT be read as a
  // character classification (issue #422).
  function poseySetup() {
    const posey = createCard({
      id: 'posey',
      name: 'Posey',
      fullName: 'Posey - Vampire Potato',
      cost: 7,
      ink: 'Emerald',
      keywords: ['Potato Shift 5'],
      classifications: ['Storyborn', 'Monster'],
      text: 'Potato Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your items named Potato.)',
    });
    const potatoItem = createCard({
      id: 'potato-item',
      name: 'Potato',
      fullName: 'Potato',
      cost: 2,
      ink: 'Emerald',
      type: 'Item',
    });
    return {posey, potatoItem};
  }

  it('should find the item named Potato as a target (forward)', () => {
    const {posey, potatoItem} = poseySetup();
    const synergies = shiftRule.findSynergies(posey, [posey, potatoItem]);
    expect(synergies.find((s) => s.card.id === 'potato-item')).toBeDefined();
  });

  it('should find the Potato Shift card when selecting the item (reverse)', () => {
    const {posey, potatoItem} = poseySetup();
    const synergies = shiftRule.findSynergies(potatoItem, [posey, potatoItem]);
    expect(synergies.find((s) => s.card.id === 'posey')).toBeDefined();
  });

  it('should NOT match a character that merely has a "Potato" classification', () => {
    const {posey, potatoItem} = poseySetup();
    const potatoChar = createCard({
      id: 'spud',
      name: 'Spud',
      cost: 3,
      ink: 'Emerald',
      classifications: ['Storyborn', 'Potato'],
    });
    const synergies = shiftRule.findSynergies(posey, [posey, potatoItem, potatoChar]);
    expect(synergies.find((s) => s.card.id === 'potato-item')).toBeDefined();
    expect(synergies.find((s) => s.card.id === 'spud')).toBeUndefined();
  });
});

describe('Universal Shift', () => {
  const shiftRule = getRuleById('shift-targets')!;

  function universalShiftPair(extras: Partial<Parameters<typeof createCard>[0]> = {}) {
    const baymax = createCard({
      id: 'baymax-giant',
      name: 'Baymax',
      cost: 6,
      keywords: ['Universal Shift 4'],
      ...extras,
    });
    const anyChar = createCard({id: 'random-char', name: 'Some Character', cost: 3});
    return {baymax, anyChar};
  }

  it('should find any character as target for Universal Shift', () => {
    const {baymax, anyChar} = universalShiftPair({ink: 'Emerald', ink2: 'Sapphire'});
    const synergies = shiftRule.findSynergies(baymax, [anyChar]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].card.id).toBe('random-char');
  });

  it('should show Universal Shift card when selecting any character (reverse)', () => {
    const {baymax, anyChar} = universalShiftPair();
    const synergies = shiftRule.findSynergies(anyChar, [baymax]);
    expect(synergies).toHaveLength(1);
    expect(synergies[0].card.id).toBe('baymax-giant');
  });
});

// Fixes from the 2026-10-14 misread review. Real card text.

const shiftRule = getRuleById('shift-targets')!;
const namedRule = getRuleById('named-companions')!;
/** The pair `card` finds with `partner` through `rule`, or undefined when they do not pair. */
const pairThrough = (rule: SynergyRule, card: LorcanaCard, partner: LorcanaCard) =>
  rule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// A character that also counts as being named Syndrome for Shift.
const incrediboy = createCard({
  id: 'incrediboy-buddy-pine',
  name: 'Incrediboy',
  fullName: 'Incrediboy - Buddy Pine',
  ink: 'Steel',
  cost: 2,
  classifications: ['Storyborn', 'Inventor'],
  text: 'NERDING OUT When you play this character, if a\nHero character is in play, gain 1 lore.\nSPOILER ALERT This character also counts as\nbeing named Syndrome for Shift.',
});
// A Shift onto Syndrome, and a Syndrome with no Shift.
const syndromeOutForRevenge = createCard({
  id: 'syndrome-out-for-revenge',
  name: 'Syndrome',
  fullName: 'Syndrome - Out for Revenge',
  ink: 'Steel',
  cost: 6,
  classifications: ['Dreamborn', 'Super', 'Villain', 'Inventor'],
  keywords: ['Shift 4'],
  text: 'Shift 4 ⬡ (You may pay 4 ⬡ to play this on top of\none of your characters named Syndrome.)\nGOT ME MONOLOGUING! Whenever this character\nquests, return a Robot character card from your\ndiscard to your hand. Then, you may play or shift\na Robot character with cost 8 or less for free.',
});
const syndromeEvilInventor = createCard({
  id: 'syndrome-evil-inventor',
  name: 'Syndrome',
  fullName: 'Syndrome - Evil Inventor',
  ink: 'Sapphire',
  cost: 3,
  classifications: ['Storyborn', 'Super', 'Villain', 'Inventor'],
  keywords: ['Alert'],
  text: 'Alert (This character can challenge as if they had\nEvasive.)',
});

describe('Shift Targets: a character that counts as another name for Shift', () => {
  it('takes a Shift onto that name, from either side', () => {
    expect(getShiftAliasNames(incrediboy)).toEqual(['Syndrome']);
    expect(pairThrough(shiftRule, syndromeOutForRevenge, incrediboy)).toBeDefined();
    expect(pairThrough(shiftRule, incrediboy, syndromeOutForRevenge)).toBeDefined();
  });

  it('reads the alias as no named companion', () => {
    expect(getNamedReferences(incrediboy)).toEqual([]);
    expect(pairThrough(namedRule, incrediboy, syndromeEvilInventor)).toBeUndefined();
  });
});
