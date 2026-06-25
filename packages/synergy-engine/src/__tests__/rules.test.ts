import {describe, it, expect} from 'vitest';
import {getRuleById, getCrossSynergyScore, SynergyEngine} from '../engine';
import {
  hasNegativeTargeting,
  hasPositiveClassificationEffect,
  getLocationRoles,
  isLocationSupportCard,
  getDiscardRoles,
  isDiscardCard,
  getSacrificeRoles,
  isSacrificeCard,
  getRampRoles,
  isRampCard,
  isDeckRamp,
  isRepeatingTrigger,
  getCostReductionTarget,
  getToyRoles,
  isToyCard,
  getDwarfsRoles,
  isDwarfsCard,
} from '../utils';
import {createCard} from './fixtures.js';

describe('Synergy Rules', () => {
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
        expected: number;
        shiftInkwell?: boolean;
      }>([
        {
          label: 'on-curve both inkable (curveGap 1)',
          shiftCost: 7,
          shiftKeyword: 'Shift 5',
          baseCost: 4,
          baseInkwell: true,
          expected: 9,
        },
        {
          label: 'on-curve one inkable (curveGap 1)',
          shiftCost: 7,
          shiftKeyword: 'Shift 5',
          baseCost: 4,
          baseInkwell: false,
          expected: 8,
        },
        {
          label: 'on-curve neither inkable (curveGap 1)',
          shiftCost: 7,
          shiftKeyword: 'Shift 5',
          baseCost: 4,
          baseInkwell: false,
          expected: 7,
          shiftInkwell: false,
        },
        {
          label: 'curveGap 2 with inkable base',
          shiftCost: 8,
          shiftKeyword: 'Shift 6',
          baseCost: 4,
          baseInkwell: true,
          expected: 7,
        },
        {
          label: 'slightly off-curve (curveGap 3)',
          shiftCost: 7,
          shiftKeyword: 'Shift 5',
          baseCost: 2,
          baseInkwell: true,
          expected: 5,
        },
        {
          label: 'far off-curve (curveGap >= 4)',
          shiftCost: 7,
          shiftKeyword: 'Shift 5',
          baseCost: 1,
          baseInkwell: true,
          expected: 3,
        },
        {
          label: 'same-cost-as-shift (curveGap 0)',
          shiftCost: 7,
          shiftKeyword: 'Shift 5',
          baseCost: 5,
          baseInkwell: true,
          expected: 5,
        },
      ])('$label → score $expected', ({expected, ...pairOpts}) => {
        const synergies = shiftPair(pairOpts);
        expect(synergies[0].score).toBe(expected);
      });

      it('should produce consistent score in reverse direction', () => {
        const {shiftCard, base} = shiftSetup();
        const forward = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        const reverse = shiftRule.findSynergies(base, [shiftCard, base]);
        expect(forward[0].score).toBe(reverse[0].score);
      });

      it('regression: small shift onto cheap base scores 9, not 3 (#108)', () => {
        const synergies = shiftPair({
          shiftCost: 4,
          shiftKeyword: 'Shift 3',
          baseCost: 2,
          baseInkwell: true,
        });
        expect(synergies[0].score).toBe(9);
      });

      it('regression: huge shift onto tiny base scores 3, not high (#108)', () => {
        const synergies = shiftPair({
          shiftCost: 10,
          shiftKeyword: 'Shift 8',
          baseCost: 2,
          baseInkwell: true,
        });
        expect(synergies[0].score).toBe(3);
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

      it.each<{
        label: string;
        baseCost: number;
        expected: number;
        shiftText?: string;
        baseText?: string;
      }>([
        {
          label: 'base activates condition → 10',
          baseCost: 2,
          expected: 10,
          shiftText: conditionText,
          baseText: conditionBaseText,
        },
        {label: 'cheap base (cost <= 3) → 9', baseCost: 2, expected: 9},
        {label: 'mid-cost base (cost 4-5) → 7', baseCost: 4, expected: 7},
        {label: 'expensive base (cost 6+) → 5', baseCost: 7, expected: 5},
      ])('$label', ({baseCost, expected, shiftText, baseText}) => {
        const {shiftCard, base} = freeShiftSetup(baseCost, {shiftText, baseText});
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(expected);
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

  describe('Lore Loss', () => {
    const loreLossRule = getRuleById('lore-loss')!;

    // Steal: opponent loses lore AND you gain lore (matches LORE_STEAL_PATTERNS)
    const thievery = createCard({
      id: 'thievery',
      name: 'Thievery',
      type: 'Action',
      ink: 'Ruby',
      cost: 1,
      text: 'Chosen opponent loses 1 lore. Gain 1 lore.',
    });

    const lorePirate = createCard({
      id: 'lore-pirate',
      name: 'Lore Pirate',
      type: 'Character',
      ink: 'Amethyst',
      cost: 4,
      text: 'When you play this character, chosen opponent loses 2 lore and you gain 2 lore.',
    });

    // Burn: opponent loses lore only, no transfer
    const jasmine = createCard({
      id: 'jasmine-rebellious',
      name: 'Jasmine',
      ink: 'Ruby',
      cost: 3,
      text: 'Whenever this character quests, each opponent loses 1 lore.',
    });

    const flotilla = createCard({
      id: 'flotilla',
      name: 'Flotilla',
      type: 'Location',
      ink: 'Ruby',
      cost: 2,
      text: 'At the start of your turn, if you have a character here, all opponents lose 1 lore.',
    });

    const unrelatedCard = createCard({id: 'anna-1', name: 'Anna', cost: 3, text: 'Draw a card.'});

    it('should match cards with lore loss text', () => {
      expect(loreLossRule.matches(thievery)).toBe(true);
      expect(loreLossRule.matches(jasmine)).toBe(true);
      expect(loreLossRule.matches(flotilla)).toBe(true);
    });

    it('should not match cards without lore loss text', () => {
      expect(loreLossRule.matches(unrelatedCard)).toBe(false);
      expect(loreLossRule.matches(createCard({}))).toBe(false);
    });

    it('should match lore loss without numeric amount', () => {
      const card = createCard({
        text: 'Each opponent loses lore equal to the damage on chosen character.',
      });
      expect(loreLossRule.matches(card)).toBe(true);
    });

    it('burn ↔ burn pair scores 5 (parallel pressure, no compounding)', () => {
      const synergies = loreLossRule.findSynergies(jasmine, [jasmine, flotilla, unrelatedCard]);
      expect(synergies).toHaveLength(1);
      expect(synergies[0].score).toBe(5);
      expect(synergies[0].card.id).toBe('flotilla');
    });

    it('burn ↔ steal pair scores 6 (complementary pressure + race-close)', () => {
      const synergies = loreLossRule.findSynergies(thievery, [thievery, jasmine, flotilla]);
      expect(synergies).toHaveLength(2);
      expect(synergies.every((s) => s.score === 6)).toBe(true);
    });

    it('steal ↔ steal pair scores 7 (double swing engine)', () => {
      const synergies = loreLossRule.findSynergies(thievery, [thievery, lorePirate]);
      expect(synergies).toHaveLength(1);
      expect(synergies[0].score).toBe(7);
      expect(synergies[0].card.id).toBe('lore-pirate');
    });

    it('should not include the selected card itself', () => {
      const synergies = loreLossRule.findSynergies(thievery, [thievery, jasmine]);
      expect(synergies.find((s) => s.card.id === 'thievery')).toBeUndefined();
    });

    it('should mark synergies as bidirectional', () => {
      const synergies = loreLossRule.findSynergies(thievery, [thievery, jasmine]);
      expect(synergies[0].bidirectional).toBe(true);
    });
  });
});

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
});

describe('Location Synergy Rules', () => {
  const elsaIceArtisan = createCard({
    id: 'elsa-ice-artisan',
    name: 'Elsa',
    cost: 6,
    ink: 'Ruby',
    keywords: ['Shift 4'],
    text: 'Shift 4 ENDLESS WINTER When you play this character and whenever you play a location, you may exert chosen character. DISTANT CALL While this character is at a location, she gets +3 lore.',
  });

  const transportPod = createCard({
    id: 'transport-pod',
    name: 'Transport Pod',
    type: 'Item',
    cost: 1,
    ink: 'Emerald',
    text: "GIVE 'EM A SHOW At the start of your turn, you may move a character of yours to a location for free.",
  });

  const johnSilver = createCard({
    id: 'john-silver-treasure',
    name: 'John Silver',
    cost: 3,
    ink: 'Ruby',
    text: 'For each location you have in play, this character gains Resist +1 and gets +1 lore.',
  });

  const islandsPulled = createCard({
    id: 'islands-pulled',
    name: 'The Islands I Pulled from the Sea',
    type: 'Action',
    cost: 3,
    ink: 'Ruby',
    text: 'Search your deck for a location card, reveal that card to all players, and put it into your hand.',
  });

  const felixSteward = createCard({
    id: 'felix-steward',
    name: 'Fix-It Felix, Jr.',
    cost: 5,
    ink: 'Amber',
    keywords: ['Shift 3'],
    text: 'Shift 3 BUILDING TOGETHER Your locations get +2 willpower.',
  });

  const agrabah = createCard({
    id: 'agrabah',
    name: 'Agrabah',
    type: 'Location',
    cost: 3,
    ink: 'Ruby',
  });

  const unrelatedCard = createCard({
    id: 'anna-plain',
    name: 'Anna',
    cost: 3,
    text: 'When you play this character, draw a card.',
  });

  const anotherLocation = createCard({
    id: 'motunui',
    name: 'Motunui',
    type: 'Location',
    cost: 2,
    ink: 'Emerald',
  });

  describe('Location role detection', () => {
    it.each([
      ['at-payoff and play-trigger on Elsa', elsaIceArtisan, ['at-payoff', 'play-trigger']],
      ['move on Transport Pod', transportPod, ['move']],
      ['search on Islands Pulled', islandsPulled, ['search']],
    ])('should detect %s', (_label, card, expectedRoles) => {
      const roles = getLocationRoles(card);
      for (const role of expectedRoles) {
        expect(roles).toContain(role);
      }
    });

    it('should detect in-play-check on John Silver', () => {
      expect(getLocationRoles(johnSilver)).toContain('in-play-check');
    });

    it('should detect buff on Felix Steward', () => {
      expect(getLocationRoles(felixSteward)).toContain('buff');
    });

    it('splits move-trigger (moves to a location) apart from play-trigger', () => {
      const taffyta = createCard({
        id: 'taffyta-move-trigger',
        name: 'Taffyta Muttonfudge',
        cost: 3,
        ink: 'Ruby',
        text: 'Once per turn, when this character moves to a location, gain 2 lore.',
      });
      const taffytaRoles = getLocationRoles(taffyta);
      expect(taffytaRoles).toContain('move-trigger');
      expect(taffytaRoles).not.toContain('play-trigger');
      // Elsa fires on *playing* a location, so she stays play-trigger only.
      expect(getLocationRoles(elsaIceArtisan)).not.toContain('move-trigger');
    });

    it('should return empty for Location cards and unrelated cards', () => {
      expect(getLocationRoles(agrabah)).toEqual([]);
      expect(isLocationSupportCard(agrabah)).toBe(false);
      expect(getLocationRoles(unrelatedCard)).toEqual([]);
      expect(isLocationSupportCard(unrelatedCard)).toBe(false);
    });

    it('normalizes newlines so multi-line phrases still match (regression: Cold Never Bothered Me)', () => {
      const songWithSplitPhrase = createCard({
        id: 'cold-never-bothered',
        name: 'The Cold Never Bothered Me',
        type: 'Action',
        cost: 3,
        ink: 'Ruby',
        text: 'Look at the top 4 cards of your deck. You may reveal\na location card and put it into your hand. Put the\nrest into your discard. You pay 3 ⬡ less for the next\nlocation you play this turn.',
      });
      const roles = getLocationRoles(songWithSplitPhrase);
      expect(roles).toContain('search');
      expect(roles).toContain('location-ramp');
    });
  });

  describe('Location ↔ support card synergies', () => {
    const engine = new SynergyEngine();
    const allCards = [
      elsaIceArtisan,
      transportPod,
      johnSilver,
      islandsPulled,
      felixSteward,
      agrabah,
      anotherLocation,
      unrelatedCard,
    ];

    it('should find location-support cards when a Location is selected', () => {
      const groups = engine.findSynergies(agrabah, allCards);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');
      expect(locationGroup).toBeDefined();

      const cardIds = locationGroup!.synergies.map((s) => s.card.id);
      expect(cardIds).toContain('elsa-ice-artisan');
      expect(cardIds).toContain('transport-pod');
      expect(cardIds).toContain('john-silver-treasure');
      expect(cardIds).toContain('islands-pulled');
      expect(cardIds).toContain('felix-steward');
      expect(cardIds).not.toContain('motunui');
      expect(cardIds).not.toContain('anna-plain');
    });

    it('should find Locations when a support card is selected', () => {
      const groups = engine.findSynergies(elsaIceArtisan, allCards);
      const cardIds = groups
        .find((g) => g.groupKey === 'location-control')!
        .synergies.map((s) => s.card.id);
      expect(cardIds).toContain('agrabah');
      expect(cardIds).toContain('motunui');
    });

    it('should assign correct scores by role', () => {
      const groups = engine.findSynergies(agrabah, allCards);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control')!;

      // at-payoff → 7
      expect(locationGroup.synergies.find((s) => s.card.id === 'elsa-ice-artisan')!.score).toBe(7);
      // move/search → 5
      expect(locationGroup.synergies.find((s) => s.card.id === 'transport-pod')!.score).toBe(5);
      expect(locationGroup.synergies.find((s) => s.card.id === 'islands-pulled')!.score).toBe(5);
    });

    it('should not produce location synergies for unrelated cards', () => {
      const groups = engine.findSynergies(unrelatedCard, allCards);
      expect(groups.find((g) => g.groupKey === 'location-control')).toBeUndefined();
    });
  });

  describe('Cross-synergy between support cards', () => {
    it.each([
      ['at-payoff + buff → 5', ['at-payoff', 'play-trigger'], ['buff'], 5],
      ['at-payoff + move → 3', ['at-payoff'], ['move'], 3],
      ['search + buff → 3', ['search'], ['buff'], 3],
      ['move + search → 3', ['move'], ['search'], 3],
      // move enabler ↔ move-trigger payoff: complementary, but move isn't high-value → 3
      ['move + move-trigger → 3', ['move'], ['move-trigger'], 3],
      // two high-value complementary roles → 5
      ['move-trigger + location-ramp → 5', ['move-trigger'], ['location-ramp'], 5],
    ])('%s', (_label, rolesA, rolesB, expected) => {
      expect(getCrossSynergyScore(rolesA, rolesB)).toBe(expected);
    });

    it.each([
      ['same roles (at-payoff)', ['at-payoff'], ['at-payoff']],
      ['same roles (boost)', ['boost'], ['boost']],
      ['non-complementary', ['at-payoff'], ['in-play-check']],
      ['non-complementary', ['boost'], ['move']],
    ])('should return null for %s', (_label, rolesA, rolesB) => {
      expect(getCrossSynergyScore(rolesA, rolesB)).toBeNull();
    });

    it('should show cross-synergy between Elsa and Felix in engine results', () => {
      const engine = new SynergyEngine();
      const groups = engine.findSynergies(elsaIceArtisan, [elsaIceArtisan, felixSteward, agrabah]);
      const felixMatch = groups
        .find((g) => g.groupKey === 'location-control')!
        .synergies.find((s) => s.card.id === 'felix-steward');
      expect(felixMatch!.score).toBe(5);
    });
  });

  describe('Boost role', () => {
    const webbysDiary = createCard({
      id: 'webbys-diary',
      name: "Webby's Diary",
      type: 'Item',
      cost: 2,
      ink: 'Amber',
      text: 'Whenever you put a card under one of your characters or locations, you may pay 1 to draw a card.',
    });

    const scroogesCountingHouse = createCard({
      id: 'scrooges-counting-house',
      name: "Scrooge's Counting House",
      type: 'Location',
      cost: 3,
      ink: 'Amber',
      text: 'Whenever a character of yours moves here, put the top card of your deck facedown under this location. GOOD BUSINESS This location gets +1 ⛉ and +1 ◊ for each card under it.',
    });

    it('should detect boost role and find boost-beneficiary Locations as synergies', () => {
      expect(getLocationRoles(webbysDiary)).toContain('boost');

      const engine = new SynergyEngine();
      const groups = engine.findSynergies(webbysDiary, [
        webbysDiary,
        scroogesCountingHouse,
        agrabah,
        unrelatedCard,
      ]);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');
      expect(locationGroup).toBeDefined();
      const ids = locationGroup!.synergies.map((s) => s.card.id);
      expect(ids).toContain('scrooges-counting-house');
      // Generic locations without "cards beneath" mechanic should NOT pair with boost cards
      expect(ids).not.toContain('agrabah');
    });

    it('should assign score 5 for boost cards with boost-beneficiary Locations', () => {
      const engine = new SynergyEngine();
      const groups = engine.findSynergies(scroogesCountingHouse, [
        scroogesCountingHouse,
        webbysDiary,
      ]);
      const diaryMatch = groups
        .find((g) => g.groupKey === 'location-control')!
        .synergies.find((s) => s.card.id === 'webbys-diary');
      expect(diaryMatch!.score).toBe(5);
    });
  });

  describe('Location-ramp role', () => {
    const elsaConcerned = createCard({
      id: 'elsa-concerned',
      name: 'Elsa',
      cost: 4,
      ink: 'Ruby',
      text: 'When you play this character, you pay 2 less for the next location you play this turn.',
    });

    it('should detect location-ramp and assign score 7', () => {
      expect(getLocationRoles(elsaConcerned)).toContain('location-ramp');

      const engine = new SynergyEngine();
      const groups = engine.findSynergies(agrabah, [agrabah, elsaConcerned]);
      const elsaMatch = groups
        .find((g) => g.groupKey === 'location-control')!
        .synergies.find((s) => s.card.id === 'elsa-concerned');
      expect(elsaMatch!.score).toBe(7);
    });
  });

  describe('Anti-location exclusion', () => {
    const launchpadPilot = createCard({
      id: 'launchpad-pilot',
      name: 'Launchpad',
      cost: 4,
      ink: 'Emerald',
      text: 'When you play this character, you may banish chosen location.',
    });

    it('should exclude anti-location cards from all roles and synergies', () => {
      expect(getLocationRoles(launchpadPilot)).toEqual([]);
      expect(isLocationSupportCard(launchpadPilot)).toBe(false);

      const engine = new SynergyEngine();
      const groups = engine.findSynergies(agrabah, [agrabah, launchpadPilot, unrelatedCard]);
      expect(groups.find((g) => g.groupKey === 'location-control')).toBeUndefined();
    });
  });
});

describe('Discard Control', () => {
  const discardRule = getRuleById('discard')!;

  // Enablers
  const suddenChill = createCard({
    id: 'sudden-chill',
    name: 'Sudden Chill',
    fullName: 'Sudden Chill',
    type: 'Action',
    ink: 'Emerald',
    cost: 2,
    text: 'Each opponent chooses and discards a card.',
  });

  const daisyDuck = createCard({
    id: 'daisy-secret-agent',
    name: 'Daisy Duck',
    fullName: 'Daisy Duck - Secret Agent',
    ink: 'Emerald',
    cost: 4,
    text: 'THWART Whenever this character quests, each opponent chooses and discards a card.',
  });

  const ludwigVonDrake = createCard({
    id: 'ludwig',
    name: 'Ludwig Von Drake',
    fullName: 'Ludwig Von Drake - All-Around Expert',
    ink: 'Amber',
    cost: 2,
    text: 'When you play this character, chosen opponent reveals their hand and discards a non-character card of your choice.',
  });

  const princeJohnMirror = createCard({
    id: 'pj-mirror',
    name: "Prince John's Mirror",
    fullName: "Prince John's Mirror",
    type: 'Item',
    ink: 'Emerald',
    cost: 3,
    text: "At the end of each opponent's turn, if they have more than 3 cards in their hand, they discard until they have 3 cards in their hand.",
  });

  const flynnRider = createCard({
    id: 'flynn-rider',
    name: 'Flynn Rider',
    fullName: 'Flynn Rider - Breaking and Entering',
    ink: 'Emerald',
    cost: 4,
    text: "When this character is challenged, the challenging player may choose and discard a card. If they don't, you gain 2 lore.",
  });

  const yzmaAbove = createCard({
    id: 'yzma-above',
    name: 'Yzma',
    fullName: 'Yzma - Above It All',
    ink: 'Amethyst',
    cost: 7,
    text: "Whenever another character is banished in a challenge, return that card to its player's hand, then that player discards a card at random.",
  });

  // Payoffs
  const pacha = createCard({
    id: 'pacha',
    name: 'Pacha',
    fullName: 'Pacha - Trekmate',
    ink: 'Emerald',
    cost: 3,
    text: 'While you have more cards in your hand than each opponent, this character gets +2 lore.',
  });

  const yzmaKitten = createCard({
    id: 'yzma-kitten',
    name: 'Yzma',
    fullName: 'Yzma - Transformed Kitten',
    ink: 'Amethyst',
    cost: 2,
    text: 'At the start of your turn, if you have more cards in your hand than each opponent, you may return this card to your hand.',
  });

  const unrelatedCard = createCard({
    id: 'unrelated',
    name: 'Anna',
    fullName: 'Anna - Some Version',
    cost: 3,
    text: 'Draw a card.',
  });

  describe('role detection', () => {
    it('should detect forced opponent discard as standard role', () => {
      expect(getDiscardRoles(suddenChill)).toEqual(['standard']);
    });

    it('should detect type-specific reveal+discard as targeted role', () => {
      expect(getDiscardRoles(ludwigVonDrake)).toEqual(['targeted']);
    });

    it('should detect hand-cap as standard role', () => {
      expect(getDiscardRoles(princeJohnMirror)).toEqual(['standard']);
    });

    it('should detect challenging player discard as standard role', () => {
      expect(getDiscardRoles(flynnRider)).toEqual(['standard']);
    });

    it('should detect "discards at random" as random role', () => {
      expect(getDiscardRoles(yzmaAbove)).toEqual(['random']);
    });

    it('should detect hand-size advantage as payoff', () => {
      expect(getDiscardRoles(pacha)).toEqual(['payoff']);
      expect(getDiscardRoles(yzmaKitten)).toEqual(['payoff']);
    });

    it('should not match unrelated cards', () => {
      expect(isDiscardCard(unrelatedCard)).toBe(false);
    });

    it('should not match self-discard cards', () => {
      const selfDiscard = createCard({
        text: 'You may choose and discard a card to draw 2 cards.',
      });
      expect(isDiscardCard(selfDiscard)).toBe(false);
    });

    it('should not match cards with no text', () => {
      expect(getDiscardRoles(createCard({text: undefined}))).toEqual([]);
    });

    it.each([
      [
        'have opponent choose and discard',
        'you may pay 2 to have each opponent choose and discard a card.',
      ],
      [
        'most cards choose and discard',
        'The player or players with the most cards in their hands choose and discard 2 cards.',
      ],
    ])('should detect standard role: %s', (_label, text) => {
      expect(getDiscardRoles(createCard({text}))).toEqual(['standard']);
    });

    it('should detect symmetric draw/discard chaos as random role', () => {
      expect(
        getDiscardRoles(
          createCard({text: 'Each player draws 3 cards, then discards 3 cards at random.'}),
        ),
      ).toEqual(['random']);
    });

    it('should detect dual-role card (standard + payoff)', () => {
      const dualRole = createCard({
        text: 'Each opponent chooses and discards a card. While you have more cards in your hand than each opponent, this character gets +2 lore.',
      });
      expect(getDiscardRoles(dualRole)).toEqual(['standard', 'payoff']);
    });
  });

  describe('rule matching', () => {
    it('should match enablers and payoffs', () => {
      expect(discardRule.matches(suddenChill)).toBe(true);
      expect(discardRule.matches(pacha)).toBe(true);
    });

    it('should not match unrelated cards', () => {
      expect(discardRule.matches(unrelatedCard)).toBe(false);
    });
  });

  describe('synergy scoring', () => {
    const allCards = [suddenChill, daisyDuck, pacha, yzmaKitten, unrelatedCard];

    it('enabler ↔ enabler scores 5 (parallel pressure baseline)', () => {
      const synergies = discardRule.findSynergies(suddenChill, allCards);
      const daisyMatch = synergies.find((s) => s.card.id === 'daisy-secret-agent');
      expect(daisyMatch).toBeDefined();
      expect(daisyMatch!.score).toBe(5);
      expect(daisyMatch!.explanation).toContain('disrupt');
    });

    it('enabler ↔ payoff scores 8 (asymmetric kill combo)', () => {
      const synergies = discardRule.findSynergies(suddenChill, allCards);
      const pachaMatch = synergies.find((s) => s.card.id === 'pacha');
      expect(pachaMatch).toBeDefined();
      expect(pachaMatch!.score).toBe(8);
      expect(pachaMatch!.explanation).toContain('hand-size edge');
    });

    it('payoff ↔ payoff scores 5 (same axis, no compounding)', () => {
      const synergies = discardRule.findSynergies(pacha, allCards);
      const yzmaMatch = synergies.find((s) => s.card.id === 'yzma-kitten');
      expect(yzmaMatch).toBeDefined();
      expect(yzmaMatch!.score).toBe(5);
      expect(yzmaMatch!.explanation).toContain('hand-size advantage');
    });

    it('should not include unrelated cards', () => {
      const synergies = discardRule.findSynergies(suddenChill, allCards);
      expect(synergies.find((s) => s.card.id === 'unrelated')).toBeUndefined();
    });

    it('should not include the card itself', () => {
      const synergies = discardRule.findSynergies(suddenChill, allCards);
      expect(synergies.find((s) => s.card.id === 'sudden-chill')).toBeUndefined();
    });

    it('should mark synergies as bidirectional', () => {
      const synergies = discardRule.findSynergies(suddenChill, allCards);
      expect(synergies.every((s) => s.bidirectional)).toBe(true);
    });

    it('should produce consistent scores in both directions', () => {
      const forward = discardRule.findSynergies(suddenChill, allCards);
      const reverse = discardRule.findSynergies(pacha, allCards);
      const forwardPacha = forward.find((s) => s.card.id === 'pacha')!.score;
      const reverseChill = reverse.find((s) => s.card.id === 'sudden-chill')!.score;
      expect(forwardPacha).toBe(reverseChill);
    });
  });
});

describe('Card Helper Functions', () => {
  describe('hasNegativeTargeting', () => {
    it('should detect exert targeting', () => {
      const card = createCard({
        text: 'When you play this character, you may exert chosen Princess character.',
      });
      expect(hasNegativeTargeting(card, 'Princess')).toBe(true);
      expect(hasNegativeTargeting(card, 'Villain')).toBe(false);
    });

    it('should detect banish targeting', () => {
      const card = createCard({text: 'Banish target Villain character.'});
      expect(hasNegativeTargeting(card, 'Villain')).toBe(true);
    });
  });

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
        ...(opts.singerCost !== undefined && {cost: opts.singerCost}),
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
      ['inefficient (diff >= 3) → 5', 'Singer 9', 1, 5],
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

    it('should fall back to card cost when Singer keyword has no numeric value', () => {
      const {singer, song} = makeSingerSongPair({
        singerKeyword: 'Singer',
        singerCost: 4,
        songCost: 4,
      });
      const synergies = singerRule.findSynergies(singer, [singer, song]);
      expect(synergies).toHaveLength(1);
      expect(synergies[0].score).toBe(8); // falls back to card.cost=4, diff=0
    });

    it('should include Singer value, song cost, and "sings" verb in explanation', () => {
      const {singer, song} = makeSingerSongPair({songCost: 4});
      const synergies = singerRule.findSynergies(singer, [singer, song]);
      // Explanation no longer interpolates card names (modal context provides
      // identity via the visible cards). Mechanic-level assertions only.
      expect(synergies[0].explanation).toContain('Singer 5');
      expect(synergies[0].explanation).toContain('sings');
      expect(synergies[0].explanation).toContain('cost 4');
      expect(synergies[0].explanation).toContain('for free');
    });
  });

  describe('Spike Suit', () => {
    const spikeRule = getRuleById('spike-suit')!;

    const anchor = createCard({
      id: 'dale',
      name: 'Dale',
      fullName: 'Dale - Ready for His Shot',
      ink: 'Amber',
      strength: 0,
      willpower: 4,
      text: 'SPIKE SUIT During challenges, your characters deal damage with their ⛉ instead of their ¤.',
    });

    const makePayoff = (strength: number, willpower: number, id = 'payoff') =>
      createCard({
        id,
        name: 'Body',
        fullName: 'Body - Big Wall',
        type: 'Character',
        strength,
        willpower,
      });

    it('matches the Spike Suit anchor by ability text', () => {
      expect(spikeRule.matches(anchor)).toBe(true);
    });

    it('matches a character whose willpower beats strength by >= 3', () => {
      expect(spikeRule.matches(makePayoff(1, 4))).toBe(true); // gap 3
    });

    it('does not match characters below the gap-3 floor', () => {
      expect(spikeRule.matches(makePayoff(2, 4))).toBe(false); // gap 2
      expect(spikeRule.matches(makePayoff(3, 3))).toBe(false); // gap 0
      expect(spikeRule.matches(makePayoff(5, 4))).toBe(false); // strength > willpower
    });

    it('forward: anchor finds qualifying payoffs, excludes sub-floor bodies and itself', () => {
      const ok = makePayoff(1, 4, 'ok'); // gap 3
      const low = makePayoff(3, 4, 'low'); // gap 1
      const synergies = spikeRule.findSynergies(anchor, [anchor, ok, low]);
      expect(synergies.map((s) => s.card.id)).toEqual(['ok']);
    });

    it('reverse: a payoff finds the anchor', () => {
      const payoff = makePayoff(1, 4);
      const synergies = spikeRule.findSynergies(payoff, [payoff, anchor]);
      expect(synergies).toHaveLength(1);
      expect(synergies[0].card.id).toBe('dale');
    });

    it.each([
      ['gap 3 body → 6', 3, 6, 6],
      ['gap 4 body → 7', 3, 7, 7],
      ['gap 5 body → 8', 4, 9, 8],
      ['gap 3 wall (0/3) → 7 (wall bonus)', 0, 3, 7],
      ['gap 8 wall (0/8) caps at 10', 0, 8, 10],
    ] as const)('scores %s', (_label, strength, willpower, expected) => {
      const synergies = spikeRule.findSynergies(anchor, [anchor, makePayoff(strength, willpower)]);
      expect(synergies[0].score).toBe(expected);
    });

    it('frames the anchor as the enabler in both directions (token-swap)', () => {
      const payoff = makePayoff(3, 7); // gap 4
      const fwd = spikeRule.findSynergies(anchor, [anchor, payoff])[0];
      const rev = spikeRule.findSynergies(payoff, [payoff, anchor])[0];
      // Forward: anchor is the searcher → {A}; payoff is {B}
      expect(fwd.explanation).toContain('{A} lets {B}');
      // Reverse: payoff is the searcher → {A}; anchor swaps to {B} but still the actor
      expect(rev.explanation).toContain('{B} lets {A}');
      // Payoff stats interpolate correctly (3/7 body)
      expect(rev.explanation).toContain('7 willpower instead of its 3 strength');
    });

    it('marks synergies as bidirectional', () => {
      const synergies = spikeRule.findSynergies(anchor, [anchor, makePayoff(1, 4)]);
      expect(synergies.every((s) => s.bidirectional)).toBe(true);
    });
  });

  describe('Ramp', () => {
    const rampRule = getRuleById('ramp')!;

    // ── Inkwell Ramp (deck ramp) ──
    const mamaOdie = createCard({
      id: 'mama-odie',
      name: 'Mama Odie',
      fullName: 'Mama Odie - Mystical Maven',
      ink: 'Sapphire',
      cost: 3,
      text: 'THIS GOING TO BE GOOD Whenever you play a song,\nyou may put the top card of your deck into your inkwell\nfacedown and exerted.',
    });

    const oneJumpAhead = createCard({
      id: 'one-jump',
      name: 'One Jump Ahead',
      fullName: 'One Jump Ahead',
      type: 'Action',
      ink: 'Sapphire',
      cost: 2,
      text: '(A character with cost 2 or more can ⟳ to sing this song\nfor free.)\nPut the top card of your deck into your inkwell facedown\nand exerted.',
    });

    // ── Inkwell Ramp (self-sacrifice) ──
    const winniePooh = createCard({
      id: 'winnie',
      name: 'Winnie the Pooh',
      fullName: 'Winnie the Pooh - Having a Think',
      ink: 'Sapphire',
      cost: 3,
      text: 'HUNNY POT Whenever this character quests, you may put a card from your hand into your inkwell facedown.',
    });

    // ── Inkwell Triggers (repeating) ──
    const jafar = createCard({
      id: 'jafar',
      name: 'Jafar',
      fullName: 'Jafar - Power-Hungry Vizier',
      ink: 'Steel',
      cost: 5,
      text: "YOU'LL GET WHAT'S COMING TO YOU During your turn,\nwhenever a card is put into your inkwell, deal 1 damage\nto chosen character.",
    });

    const amberCoil = createCard({
      id: 'amber-coil',
      name: 'Amber Coil',
      fullName: 'Amber Coil',
      type: 'Item',
      ink: 'Amber',
      cost: 1,
      text: 'HEALING AURA During your turn, whenever a card is\nput into your inkwell, you may remove up to 2 damage\nfrom chosen character.',
    });

    // ── Inkwell Triggers (once per turn) ──
    const rayaKumandran = createCard({
      id: 'raya',
      name: 'Raya',
      fullName: 'Raya - Kumandran Rider',
      ink: 'Ruby',
      cost: 4,
      text: "COME ON, LET'S DO THIS Once during your turn,\nwhenever a card is put into your inkwell, you may\nready another chosen character of yours.",
    });

    // ── Cost Reduction Grants ──
    const pluto = createCard({
      id: 'pluto',
      name: 'Pluto',
      fullName: 'Pluto - Friendly Pooch',
      ink: 'Amber',
      cost: 1,
      text: 'GOOD DOG ⟳ — You pay 1 ⬡ less for the next\ncharacter you play this turn.',
    });

    const lantern = createCard({
      id: 'lantern',
      name: 'Lantern',
      fullName: 'Lantern',
      type: 'Item',
      ink: 'Amber',
      cost: 2,
      text: 'BIRTHDAY LIGHTS ⟳ — You pay 1 ⬡ less for the next\ncharacter you play this turn.',
    });

    // ── Opponent Ink (should be EXCLUDED) ──
    const hideAway = createCard({
      id: 'hide-away',
      name: 'Hide Away',
      fullName: 'Hide Away',
      type: 'Action',
      ink: 'Sapphire',
      cost: 2,
      text: "Put chosen item or location into its player's inkwell\nfacedown and exerted.",
    });

    const wipeOut = createCard({
      id: 'wipe-out',
      name: 'Wipe Out!',
      fullName: 'Wipe Out!',
      type: 'Action',
      ink: 'Sapphire',
      cost: 2,
      text: "Put chosen character with Bodyguard or item into their player's inkwell facedown and exerted.",
    });

    // ── Self-discount (should be EXCLUDED) ──
    const kristoff = createCard({
      id: 'kristoff',
      name: 'Kristoff',
      fullName: 'Kristoff - Reindeer Keeper',
      ink: 'Amber',
      cost: 9,
      text: 'SONG OF THE HERD For each song card in your\ndiscard, you pay 1 ⬡ less to play this character.',
    });

    // ── Cost Reduction (location — different target type) ──
    const elsaConcerned = createCard({
      id: 'elsa-concerned',
      name: 'Elsa',
      fullName: 'Elsa - Concerned Sister',
      ink: 'Ruby',
      cost: 3,
      text: 'CLEAR THE WAY When you play this character, you pay 2 ⬡ less for the next location you play this turn.',
    });

    // ── Unrelated card ──
    const unrelated = createCard({
      id: 'unrelated',
      name: 'Generic',
      fullName: 'Generic Card',
      cost: 3,
      text: 'Draw a card.',
    });

    // ── Variant wording triggers ──
    const fgWand = createCard({
      id: 'fg-wand',
      name: "Fairy Godmother's Wand",
      fullName: "Fairy Godmother's Wand",
      type: 'Item',
      ink: 'Sapphire',
      cost: 2,
      text: 'ONLY TILL MIDNIGHT During your turn, whenever you\nput a card into your inkwell, chosen Princess character\nof yours gains Ward until the start of your next turn.',
    });

    // ── Role Detection ──

    it('should detect deck ramp cards', () => {
      expect(getRampRoles(mamaOdie)).toContain('inkwell-ramp');
      expect(getRampRoles(oneJumpAhead)).toContain('inkwell-ramp');
      expect(isDeckRamp(mamaOdie)).toBe(true);
      expect(isDeckRamp(oneJumpAhead)).toBe(true);
    });

    it('should detect self-sacrifice ramp cards', () => {
      expect(getRampRoles(winniePooh)).toContain('inkwell-ramp');
      expect(isDeckRamp(winniePooh)).toBe(false);
    });

    it('should detect repeating inkwell triggers', () => {
      expect(getRampRoles(jafar)).toContain('inkwell-trigger');
      expect(getRampRoles(amberCoil)).toContain('inkwell-trigger');
      expect(isRepeatingTrigger(jafar)).toBe(true);
      expect(isRepeatingTrigger(amberCoil)).toBe(true);
    });

    it('should detect once-per-turn inkwell triggers', () => {
      expect(getRampRoles(rayaKumandran)).toContain('inkwell-trigger');
      expect(isRepeatingTrigger(rayaKumandran)).toBe(false);
    });

    it('should detect variant wording triggers', () => {
      expect(getRampRoles(fgWand)).toContain('inkwell-trigger');
    });

    it('should detect cost reduction grants', () => {
      expect(getRampRoles(pluto)).toContain('cost-reduction');
      expect(getRampRoles(lantern)).toContain('cost-reduction');
    });

    it('should detect cost reduction target types', () => {
      expect(getCostReductionTarget(pluto)).toBe('character');
      expect(getCostReductionTarget(lantern)).toBe('character');
      expect(getCostReductionTarget(elsaConcerned)).toBe('location');
    });

    it('should exclude opponent-ink cards', () => {
      expect(isRampCard(hideAway)).toBe(false);
      expect(isRampCard(wipeOut)).toBe(false);
    });

    it('should exclude self-discount payoffs', () => {
      expect(isRampCard(kristoff)).toBe(false);
    });

    it('should not match unrelated cards', () => {
      expect(isRampCard(unrelated)).toBe(false);
    });

    // ── Scoring ──

    it('should score deck ramp + repeating trigger at 9', () => {
      const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, jafar]);
      expect(synergies[0].score).toBe(9);
    });

    it('should score deck ramp + once-per-turn trigger at 8', () => {
      const synergies = rampRule.findSynergies(oneJumpAhead, [oneJumpAhead, rayaKumandran]);
      expect(synergies[0].score).toBe(8);
    });

    it('should score self-sacrifice + repeating trigger at 8', () => {
      const synergies = rampRule.findSynergies(winniePooh, [winniePooh, jafar]);
      expect(synergies[0].score).toBe(8);
    });

    it('should score self-sacrifice + once-per-turn trigger at 7', () => {
      const synergies = rampRule.findSynergies(winniePooh, [winniePooh, rayaKumandran]);
      expect(synergies[0].score).toBe(7);
    });

    it('ramp ↔ ramp scores 5 (parallel ramp, no compounding)', () => {
      const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, oneJumpAhead]);
      expect(synergies[0].score).toBe(5);
    });

    it('ramp ↔ cost reduction scores 5 (parallel curve acceleration)', () => {
      const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, pluto]);
      expect(synergies[0].score).toBe(5);
    });

    it('trigger ↔ trigger scores 5 (parallel triggers, both need ramp to fire)', () => {
      const synergies = rampRule.findSynergies(jafar, [jafar, amberCoil]);
      expect(synergies[0].score).toBe(5);
    });

    it('should score cost reduction + cost reduction at 6 when same target type', () => {
      const synergies = rampRule.findSynergies(pluto, [pluto, lantern]);
      expect(synergies[0].score).toBe(6);
    });

    it('should not pair cost reduction cards that discount different types', () => {
      // Pluto discounts characters, Elsa discounts locations — no synergy
      const synergies = rampRule.findSynergies(pluto, [pluto, elsaConcerned]);
      expect(synergies).toHaveLength(0);
    });

    it('should score trigger + cost reduction at 5', () => {
      const synergies = rampRule.findSynergies(amberCoil, [amberCoil, pluto]);
      expect(synergies[0].score).toBe(5);
    });

    // ── Integration ──

    it('should not find synergies with unrelated cards', () => {
      const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, unrelated]);
      expect(synergies).toHaveLength(0);
    });

    it('should not find synergies for opponent-ink cards', () => {
      const synergies = rampRule.findSynergies(hideAway, [hideAway, jafar, pluto]);
      expect(synergies).toHaveLength(0);
    });

    it('should generate non-empty mechanic-level explanations', () => {
      // Card-name interpolation was removed in favor of mechanic-focused copy
      // (modal context provides identity via the visible cards). Assert the
      // explanation is present and references ink/inkwell mechanics.
      const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, jafar]);
      expect(synergies[0].explanation.length).toBeGreaterThan(0);
      expect(synergies[0].explanation).toMatch(/ink|inkwell/i);
    });

    it('should mark all matches as bidirectional', () => {
      const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, jafar, pluto]);
      synergies.forEach((s) => expect(s.bidirectional).toBe(true));
    });
  });

  describe('hasPositiveClassificationEffect', () => {
    it('should detect positive buff effects', () => {
      const card = createCard({text: 'Your Princess characters get +2 strength.'});
      expect(hasPositiveClassificationEffect(card, 'Princess')).toBe(true);
    });

    it('should detect conditional benefits', () => {
      const card = createCard({text: 'If you have a Villain character, draw a card.'});
      expect(hasPositiveClassificationEffect(card, 'Villain')).toBe(true);
    });
  });
});

describe('Toy Tribal', () => {
  const toyRule = getRuleById('toy')!;

  // Real-card-shaped fixtures
  const woodyLeader = createCard({
    id: 'woody-leader',
    name: 'Woody',
    fullName: 'Woody - Leader of the Toys',
    classifications: ['Storyborn', 'Hero', 'Toy'],
    text: 'When you play this character, look at the top 4 cards of your deck. You may reveal a Toy character and put it into your hand. Put the rest on the bottom of your deck in any order.',
  });

  const woodyJungleGuide = createCard({
    id: 'woody-jungle',
    name: 'Woody',
    fullName: 'Woody - Jungle Guide',
    classifications: ['Floodborn', 'Hero', 'Toy'],
    // Both a tribal buff (matches `classifyToyPayoff` moderate tier regex)
    // and a draw effect (so the card has a specific role and enters the playstyle).
    text: 'When you play this character, draw a card. Your other Toy characters get +1 willpower.',
  });

  const sidPhillips = createCard({
    id: 'sid-phillips',
    name: 'Sid Phillips',
    fullName: 'Sid Phillips - Toy Surgeon',
    classifications: ['Storyborn', 'Villain'],
    text: 'During your turn, whenever a Toy character is banished, gain 2 lore.',
  });

  const buzzMember = createCard({
    id: 'buzz-member',
    name: 'Buzz Lightyear',
    fullName: 'Buzz Lightyear - Space Ranger',
    classifications: ['Storyborn', 'Hero', 'Toy'],
    text: '', // member only, no Toy text
  });

  const buzzAbilityName = createCard({
    id: 'buzz-ability-name',
    name: 'Buzz Lightyear',
    fullName: 'Buzz Lightyear - On the Way',
    classifications: ['Storyborn', 'Hero', 'Toy'],
    // Ability NAME contains "TOY" but no actual Toy-tribal effect
    text: "WORLD'S GREATEST TOY Whenever you pay 2 ⬡ or less to play a character, deal 1 damage to chosen opposing damaged character.",
  });

  const handInTheBox = createCard({
    id: 'hand-in-box',
    name: 'Hand-in-the-Box',
    fullName: "Hand-in-the-Box - Sid's Toy",
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: 'You may put a Toy character card from your discard on the bottom of your deck to play this character for free.',
  });

  const windUpFrog = createCard({
    id: 'wind-up-frog',
    name: 'Wind-Up Frog',
    fullName: "Wind-Up Frog - Sid's Toy",
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: 'If one of your Toy characters was banished this turn, you pay 2 ⬡ less to play this character.',
  });

  const bullseye = createCard({
    id: 'bullseye',
    name: 'Bullseye',
    fullName: 'Bullseye - Loyal Horse',
    classifications: ['Storyborn', 'Ally', 'Toy'],
    text: 'If you have a character named Woody or Jessie in play, you pay 1 less ⬡ to play this character.',
  });

  const alien = createCard({
    id: 'alien',
    name: 'Alien',
    fullName: 'Alien - True Believer',
    classifications: ['Storyborn', 'Alien', 'Ally', 'Toy'],
    // Self-banish trigger — "when this character is banished" — counted as Toy banish via membership gate.
    text: 'During your turn, when this character is banished, return another character card named Alien from your discard to your hand.',
  });

  const mickey = createCard({
    id: 'mickey-control',
    name: 'Mickey Mouse',
    fullName: 'Mickey Mouse - Brave Little Tailor',
    classifications: ['Storyborn', 'Hero'],
    text: 'When you play this character, gain 1 lore.',
  });

  describe('getToyRoles', () => {
    it('detects member from Toy classification', () => {
      expect(getToyRoles(buzzMember)).toEqual(['member']);
    });

    it('detects banish-trigger from "whenever a Toy character is banished"', () => {
      expect(getToyRoles(sidPhillips)).toEqual(['banish-trigger']);
    });

    it('detects banish-trigger from self-banish ("when this character is banished") on Toy member', () => {
      // Membership gate makes self-banish count as a Toy-banish event.
      // Alien is also a member, so roles include 'member' alongside 'banish-trigger'.
      expect(getToyRoles(alien)).toEqual(['member', 'banish-trigger']);
    });

    it('detects self-discount on Toy member with conditional cost reduction', () => {
      // Wind-Up Frog: "If one of your Toy characters was banished, you pay 2 less"
      // Past tense ("was banished") naturally excludes from banish-trigger.
      expect(getToyRoles(windUpFrog)).toEqual(['member', 'self-discount']);
    });

    it('detects self-discount even when condition is non-Toy (named gate)', () => {
      // Bullseye: condition is "named Woody or Jessie" — still self-discount on a Toy member.
      expect(getToyRoles(bullseye)).toEqual(['member', 'self-discount']);
    });

    it('Hand-in-the-Box (free-play via discard) is self-discount via the "for free" limit case', () => {
      // "play this character for free" = max self-discount (cost = 0).
      // Recursion component (Toy from discard → deck) is a separate mechanic, deferred to Phase 4.
      expect(getToyRoles(handInTheBox)).toEqual(['member', 'self-discount']);
    });

    it('detects member + specific mechanic role for hybrid Toy cards', () => {
      // Woody Leader is a Toy member with a Search effect (look at top 4, reveal a Toy)
      expect(getToyRoles(woodyLeader)).toEqual(['member', 'search']);
    });

    it('skips ability-name false positives (Buzz Lightyear "WORLD\'S GREATEST TOY")', () => {
      expect(getToyRoles(buzzAbilityName)).toEqual(['member']);
    });

    it('returns empty for non-Toy cards', () => {
      expect(getToyRoles(mickey)).toEqual([]);
      expect(isToyCard(mickey)).toBe(false);
    });
  });

  describe('rule scoring', () => {
    const engine = new SynergyEngine();
    const allCards = [
      woodyLeader,
      woodyJungleGuide,
      sidPhillips,
      alien,
      buzzMember,
      handInTheBox,
      mickey,
    ];

    const findToyScore = (selected: typeof woodyLeader, partnerId: string): number => {
      const groups = engine.findSynergies(selected, allCards);
      const toy = groups.find((g) => g.groupKey === 'toy');
      return toy?.synergies.find((s) => s.card.id === partnerId)?.score ?? -1;
    };

    it('pure member ↔ pure member scores 5 (density only)', () => {
      // Both cards have only the 'member' role — neither carries a specific mechanic.
      const plainMemberA = createCard({id: 'rex', classifications: ['Toy'], text: ''});
      const plainMemberB = createCard({id: 'jessie-plain', classifications: ['Toy'], text: ''});
      const groups = engine.findSynergies(plainMemberA, [plainMemberA, plainMemberB]);
      const toy = groups.find((g) => g.groupKey === 'toy');
      expect(toy?.synergies[0]?.score).toBe(5);
    });

    it('member ↔ search scores 8 (search fetches a tribal member)', () => {
      // Buzz (pure member) ↔ Woody — Leader of the Toys (member + search)
      expect(findToyScore(buzzMember, 'woody-leader')).toBe(8);
    });

    it('search ↔ banish-trigger scores 8 (peak tribal chain)', () => {
      // Woody Leader (search) ↔ Sid Phillips (banish-trigger): load board, pay off on banish
      expect(findToyScore(woodyLeader, 'sid-phillips')).toBe(8);
    });

    it('member ↔ banish-trigger scores 7 (member feeds the trigger)', () => {
      expect(findToyScore(buzzMember, 'sid-phillips')).toBe(7);
    });

    it('member ↔ self-discount scores 7 (member activates discount density)', () => {
      // Hand-in-the-Box has self-discount via "play this character for free"
      expect(findToyScore(buzzMember, 'hand-in-box')).toBe(7);
    });

    it('tribal ↔ tribal scores 7 (multiple density rewards compound)', () => {
      // Sid (banish-trigger) ↔ Alien (member + banish-trigger): both tribal payoffs
      expect(findToyScore(sidPhillips, 'alien')).toBe(7);
    });

    it('member ↔ generic mechanic scores 5 (deck-share, no tribal compounding)', () => {
      // Woody Jungle Guide has 'draw' role only (generic, not tribal-specific)
      expect(findToyScore(buzzMember, 'woody-jungle')).toBe(5);
    });

    it('rule does not match non-Toy cards', () => {
      expect(toyRule.matches(mickey)).toBe(false);
    });
  });
});

describe('Sacrifice rule (Banish Matters)', () => {
  const sacrificeRule = getRuleById('sacrifice')!;

  // Enablers (self-banish cards) — banish your OWN characters on demand.
  const hadesStrongArm = createCard({
    id: 'hades-strong-arm',
    fullName: 'Hades - Strong Arm',
    ink: 'Ruby',
    text: 'WHAT ARE YOU GONNA DO? \u27f3, 3 \u2b21, Banish one of your characters \u2014 Banish chosen character.',
  });
  const timeToGo = createCard({
    id: 'time-to-go',
    fullName: 'Time to Go!',
    ink: 'Ruby',
    type: 'Action',
    text: 'Banish chosen character of yours to draw 2 cards. If that character had a card under them, draw 3 cards instead.',
  });
  const theClaw = createCard({
    id: 'the-claw',
    fullName: 'The Claw',
    ink: 'Emerald',
    type: 'Item',
    text: 'THE CLAW CHOOSES \u27f3, 2 \u2b21, Banish one of your characters \u2014 Return chosen opposing character to their player\u2019s hand.',
  });

  // Payoffs (banish-triggers) — reward your characters being banished, any cause.
  const diablo = createCard({
    id: 'diablo',
    fullName: 'Diablo - Obedient Raven',
    ink: 'Amethyst',
    text: 'FLY, MY PET! When this character is banished, you may draw a card.',
  });
  const davidXanatos = createCard({
    id: 'david-xanatos',
    fullName: 'David Xanatos - Charismatic Leader',
    ink: 'Ruby',
    text: 'LEARN FROM EVERYTHING During your turn, whenever one of your characters is banished, draw a card.',
  });
  const kingCandyRoyal = createCard({
    id: 'king-candy-royal',
    fullName: 'King Candy - Royal Racer',
    ink: 'Amber',
    ink2: 'Ruby',
    text: 'A NEW ROSTER Whenever one of your other Racer characters is banished, each opponent loses 1 lore.',
  });

  // Excluded cases.
  const iagoChallenge = createCard({
    id: 'iago',
    fullName: 'Iago - Reappearing Parrot',
    ink: 'Amethyst',
    text: 'GUESS WHO When this character is banished in a challenge, return this card to your hand.',
  });
  const energyBlast = createCard({
    id: 'energy-blast',
    fullName: 'Energy Blast',
    ink: 'Ruby',
    type: 'Action',
    text: 'Banish chosen character. Draw a card.',
  });
  const unrelated = createCard({id: 'unrelated', fullName: 'Anna', text: 'Draw a card.'});

  describe('role detection', () => {
    it('detects self-banish from "Banish one of your characters"', () => {
      expect(getSacrificeRoles(hadesStrongArm)).toEqual(['self-banish']);
    });

    it('detects self-banish from "Banish chosen character of yours"', () => {
      expect(getSacrificeRoles(timeToGo)).toEqual(['self-banish']);
    });

    it('detects banish-trigger from self-banish ("when this character is banished")', () => {
      expect(getSacrificeRoles(diablo)).toEqual(['banish-trigger']);
    });

    it('detects banish-trigger from "whenever one of your characters is banished"', () => {
      expect(getSacrificeRoles(davidXanatos)).toEqual(['banish-trigger']);
    });

    it('detects banish-trigger from a tribal your-side trigger (Racer)', () => {
      expect(getSacrificeRoles(kingCandyRoyal)).toEqual(['banish-trigger']);
    });

    it('excludes "banished in a challenge" recursion (belongs to Challenge axis)', () => {
      expect(getSacrificeRoles(iagoChallenge)).toEqual([]);
    });

    it('excludes opponent removal ("banish chosen character" without "of yours")', () => {
      expect(getSacrificeRoles(energyBlast)).toEqual([]);
    });

    it('returns no roles for unrelated or text-less cards', () => {
      expect(getSacrificeRoles(unrelated)).toEqual([]);
      expect(getSacrificeRoles(createCard({text: undefined}))).toEqual([]);
      expect(isSacrificeCard(unrelated)).toBe(false);
    });
  });

  describe('rule matching', () => {
    it('matches both self-banish cards and payoffs, not unrelated cards', () => {
      expect(sacrificeRule.matches(hadesStrongArm)).toBe(true);
      expect(sacrificeRule.matches(diablo)).toBe(true);
      expect(sacrificeRule.matches(unrelated)).toBe(false);
    });
  });

  describe('synergy scoring', () => {
    const allCards = [hadesStrongArm, timeToGo, theClaw, diablo, davidXanatos, unrelated];

    it('self-banish \u2194 banish-trigger scores 8 (banish combo)', () => {
      const synergies = sacrificeRule.findSynergies(hadesStrongArm, allCards);
      const match = synergies.find((s) => s.card.id === 'diablo');
      expect(match!.score).toBe(8);
      // Token swap: the SELF-BANISH card ({A}, the searcher here) reads as the actor.
      expect(match!.explanation).toBe(
        "{A} banishes your own character on demand, guaranteeing {B}'s banish payoff.",
      );
    });

    it('keeps the self-banish card as the actor when the payoff is the searcher', () => {
      const synergies = sacrificeRule.findSynergies(diablo, allCards);
      const match = synergies.find((s) => s.card.id === 'hades-strong-arm');
      expect(match!.score).toBe(8);
      // Now the self-banish card is the partner ({B}), so the tokens swap accordingly.
      expect(match!.explanation).toBe(
        "{B} banishes your own character on demand, guaranteeing {A}'s banish payoff.",
      );
    });

    it('banish-trigger \u2194 banish-trigger scores 5 (parallel payoff density)', () => {
      const synergies = sacrificeRule.findSynergies(diablo, allCards);
      const match = synergies.find((s) => s.card.id === 'david-xanatos');
      expect(match!.score).toBe(5);
      expect(match!.explanation).toContain('pay off when your characters are banished');
    });

    it('self-banish \u2194 self-banish scores 5 (parallel enablers)', () => {
      const synergies = sacrificeRule.findSynergies(hadesStrongArm, allCards);
      const match = synergies.find((s) => s.card.id === 'the-claw');
      expect(match!.score).toBe(5);
      expect(match!.explanation).toContain('parallel self-banish cards');
    });
  });
});

describe('Dwarfs Tribal', () => {
  const dwarfsRule = getRuleById('dwarfs')!;

  // Members — Seven Dwarfs subtype.
  const plainMemberA = createCard({
    id: 'dopey-music',
    fullName: 'Dopey - Drawn to Music',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
    text: 'TONGUE-TIED This character can’t ⟳ to sing songs.',
  });
  const plainMemberB = createCard({
    id: 'happy-adventurer',
    fullName: 'Happy - Joyful Adventurer',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
    text: '',
  });
  const docTakingNotes = createCard({
    id: 'doc-taking-notes',
    fullName: 'Doc - Taking Notes',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Ally', 'Seven Dwarfs'],
    text: 'SHARE KNOWLEDGE When you play this character, if you have another Seven Dwarfs character or a Princess character in play, draw a card.',
  });

  // Payoffs — reference Seven Dwarfs in text but are NOT members.
  const snowWhiteMerry = createCard({
    id: 'snow-white-merry',
    fullName: 'Snow White - Merry as the Morning',
    ink: 'Amethyst',
    classifications: ['Dreamborn', 'Hero', 'Princess'],
    text: 'CLARION CALL Whenever this character quests, you may return chosen Seven Dwarfs character of yours to your hand to draw a card.',
  });
  const rightBehindYou = createCard({
    id: 'right-behind-you',
    fullName: 'Right Behind You',
    ink: 'Amethyst',
    type: 'Action',
    text: 'Draw a card. If you have a Seven Dwarfs character and a Princess character in play, you may play a Seven Dwarfs character for free.',
  });
  const dontBeNervous = createCard({
    id: 'dont-be-nervous',
    fullName: "Don't Be Nervous",
    ink: 'Amethyst',
    type: 'Action',
    text: 'Search your deck for a Princess character card, reveal that card to all players, and put it into your hand. Then, shuffle your deck. If you have 2 or more Seven Dwarfs characters in play, draw 2 cards and gain 2 lore.',
  });

  // Excluded — a Princess with no Seven Dwarfs text reference.
  const princessOnly = createCard({
    id: 'cinderella',
    fullName: 'Cinderella - Gentle and Kind',
    ink: 'Amethyst',
    classifications: ['Storyborn', 'Hero', 'Princess'],
    text: 'When you play this character, gain 1 lore.',
  });

  describe('getDwarfsRoles', () => {
    it('detects member from the Seven Dwarfs classification', () => {
      expect(getDwarfsRoles(plainMemberA)).toEqual(['member']);
    });

    it('detects member + density for a Dwarf with a density payoff', () => {
      expect(getDwarfsRoles(docTakingNotes)).toEqual(['member', 'density']);
    });

    it('detects density on a non-member action', () => {
      expect(getDwarfsRoles(dontBeNervous)).toEqual(['density']);
    });

    it('detects density + recruit on Right Behind You', () => {
      expect(getDwarfsRoles(rightBehindYou)).toEqual(['density', 'recruit']);
    });

    it('detects return on Snow White - Merry as the Morning', () => {
      expect(getDwarfsRoles(snowWhiteMerry)).toEqual(['return']);
    });

    it('excludes a Princess card with no Seven Dwarfs text', () => {
      expect(getDwarfsRoles(princessOnly)).toEqual([]);
      expect(isDwarfsCard(princessOnly)).toBe(false);
    });
  });

  describe('rule matching', () => {
    it('matches members and Seven Dwarfs payoffs, not Princess-only cards', () => {
      expect(dwarfsRule.matches(plainMemberA)).toBe(true);
      expect(dwarfsRule.matches(rightBehindYou)).toBe(true);
      expect(dwarfsRule.matches(princessOnly)).toBe(false);
    });
  });

  describe('rule scoring', () => {
    const allCards = [
      plainMemberA,
      plainMemberB,
      docTakingNotes,
      snowWhiteMerry,
      rightBehindYou,
      dontBeNervous,
      princessOnly,
    ];
    const findScore = (selected: typeof plainMemberA, partnerId: string): number =>
      dwarfsRule.findSynergies(selected, allCards).find((s) => s.card.id === partnerId)?.score ?? -1;

    it('member ↔ member scores 5 (density baseline)', () => {
      expect(findScore(plainMemberA, 'happy-adventurer')).toBe(5);
    });

    it('recruit ↔ member scores 8, and precedence beats the density tier', () => {
      // Right Behind You is BOTH recruit and density; vs a member, recruit (8) wins over density (7).
      expect(findScore(rightBehindYou, 'dopey-music')).toBe(8);
    });

    it('recruit ↔ density scores 8', () => {
      expect(findScore(rightBehindYou, 'dont-be-nervous')).toBe(8);
    });

    it('density ↔ member scores 7 (member feeds the payoff)', () => {
      expect(findScore(docTakingNotes, 'dopey-music')).toBe(7);
    });

    it('density ↔ density scores 7 (payoffs compound)', () => {
      expect(findScore(docTakingNotes, 'dont-be-nervous')).toBe(7);
    });

    it('return ↔ member scores 7 (bounce re-buys the enter-play ability)', () => {
      expect(findScore(snowWhiteMerry, 'dopey-music')).toBe(7);
    });
  });
});
