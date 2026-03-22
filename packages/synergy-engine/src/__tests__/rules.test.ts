import {describe, it, expect} from 'vitest';
import {getRuleById, getCrossSynergyScore, SynergyEngine} from '../engine';
import {
  hasNegativeTargeting,
  hasPositiveClassificationEffect,
  getLocationRoles,
  isLocationSupportCard,
  getDiscardRoles,
  isDiscardCard,
} from '../utils';
import {createCard} from './fixtures.js';

describe('Synergy Rules', () => {
  describe('Shift Targets', () => {
    const shiftRule = getRuleById('shift-targets')!;

    it('should find same-named characters for Shift', () => {
      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
        classifications: ['Floodborn'],
      });
      const elsaBase = createCard({id: 'elsa-base', name: 'Elsa', cost: 4});
      const anna = createCard({id: 'anna-1', name: 'Anna', cost: 3});

      const synergies = shiftRule.findSynergies(elsaShift, [elsaShift, elsaBase, anna]);
      expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
    });

    it('should find Shift cards when selecting a base character (reverse)', () => {
      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        cost: 7,
        keywords: ['Shift 5'],
      });
      const elsaBase = createCard({id: 'elsa-base', name: 'Elsa', cost: 4});
      const anna = createCard({id: 'anna-1', name: 'Anna', cost: 3});

      const synergies = shiftRule.findSynergies(elsaBase, [elsaShift, elsaBase, anna]);
      expect(synergies.find((s) => s.card.id === 'elsa-shift')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
    });

    it('should show other Shift cards with same base name', () => {
      const elsaShift1 = createCard({
        id: 'elsa-shift-1',
        name: 'Elsa',
        cost: 7,
        keywords: ['Shift 5'],
      });
      const elsaShift2 = createCard({
        id: 'elsa-shift-2',
        name: 'Elsa',
        cost: 6,
        keywords: ['Shift 4'],
      });
      const elsaBase = createCard({id: 'elsa-base', name: 'Elsa', cost: 3});

      const synergies = shiftRule.findSynergies(elsaShift1, [elsaShift1, elsaShift2, elsaBase]);
      expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'elsa-shift-2')).toBeDefined();
    });

    it('should not match non-Character cards', () => {
      expect(shiftRule.matches(createCard({type: 'Action', keywords: ['Shift 3']}))).toBe(false);
    });

    describe('score calculation', () => {
      function shiftPair(
        shiftCost: number,
        shiftKeyword: string,
        baseCost: number,
        baseInkwell: boolean,
        shiftInkwell = true,
      ) {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: shiftCost,
          keywords: [shiftKeyword],
          inkwell: shiftInkwell,
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: baseCost,
          inkwell: baseInkwell,
        });
        return shiftRule.findSynergies(shiftCard, [shiftCard, base]);
      }

      // [label, shiftCost, keyword, baseCost, baseInkwell, expected, shiftInkwell?]
      it.each([
        ['on-curve both inkable (curveGap 1)', 7, 'Shift 5', 4, true, 9],
        ['on-curve one inkable (curveGap 1)', 7, 'Shift 5', 4, false, 8],
        ['on-curve neither inkable (curveGap 1)', 7, 'Shift 5', 4, false, 7, false],
        ['curveGap 2 with inkable base', 8, 'Shift 6', 4, true, 7],
        ['slightly off-curve (curveGap 3)', 7, 'Shift 5', 2, true, 5],
        ['far off-curve (curveGap >= 4)', 7, 'Shift 5', 1, true, 3],
        ['same-cost-as-shift (curveGap 0)', 7, 'Shift 5', 5, true, 5],
      ] as const)(
        '%s → score %d',
        (_label, shiftCost, keyword, baseCost, inkwell, expected, shiftInkwell?) => {
          const synergies = shiftPair(shiftCost, keyword, baseCost, inkwell, shiftInkwell);
          expect(synergies[0].score).toBe(expected);
        },
      );

      it('should produce consistent score in reverse direction', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          cost: 7,
          keywords: ['Shift 5'],
        });
        const base = createCard({id: 'elsa-base', name: 'Elsa', cost: 4, inkwell: true});
        const forward = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        const reverse = shiftRule.findSynergies(base, [shiftCard, base]);
        expect(forward[0].score).toBe(reverse[0].score);
      });

      it('regression: small shift onto cheap base scores 9, not 3 (#108)', () => {
        const synergies = shiftPair(4, 'Shift 3', 2, true);
        expect(synergies[0].score).toBe(9);
      });

      it('regression: huge shift onto tiny base scores 3, not high (#108)', () => {
        const synergies = shiftPair(10, 'Shift 8', 2, true);
        expect(synergies[0].score).toBe(3);
      });
    });

    describe('free Shift scoring', () => {
      it.each([
        [
          'base activates condition → 10',
          2,
          true,
          10,
          {
            text: "If a card left a player's discard this turn, this card gains Shift 0.",
            baseText:
              "When you play this character, you may put a card from chosen player's discard on the bottom of their deck.",
          },
        ],
        ['cheap base (cost <= 3) → 9', 2, true, 9, {}],
        ['mid-cost base (cost 4-5) → 7', 4, true, 7, {}],
        ['expensive base (cost 6+) → 5', 7, true, 5, {}],
      ])('%s', (_label, baseCost, inkwell, expected, opts: Record<string, string>) => {
        const shiftCard = createCard({
          id: 'anna-shift',
          name: 'Anna',
          fullName: 'Anna - Soothing Sister',
          cost: 5,
          keywords: ['Shift 0'],
          text: opts.text,
        });
        const base = createCard({
          id: 'anna-base',
          name: 'Anna',
          fullName: 'Anna - Base',
          cost: baseCost,
          inkwell,
          text: opts.baseText,
        });
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

    it('should find any character as target for Universal Shift', () => {
      const baymax = createCard({
        id: 'baymax-giant',
        name: 'Baymax',
        cost: 6,
        ink: 'Emerald',
        ink2: 'Sapphire',
        keywords: ['Universal Shift 4'],
      });
      const anyChar = createCard({id: 'random-char', name: 'Some Character', cost: 3});

      const synergies = shiftRule.findSynergies(baymax, [anyChar]);
      expect(synergies).toHaveLength(1);
      expect(synergies[0].card.id).toBe('random-char');
    });

    it('should show Universal Shift card when selecting any character (reverse)', () => {
      const baymax = createCard({
        id: 'baymax-giant',
        name: 'Baymax',
        cost: 6,
        keywords: ['Universal Shift 4'],
      });
      const anyChar = createCard({id: 'random-char', name: 'Some Character', cost: 3});

      const synergies = shiftRule.findSynergies(anyChar, [baymax]);
      expect(synergies).toHaveLength(1);
      expect(synergies[0].card.id).toBe('baymax-giant');
    });
  });

  describe('Lore Loss', () => {
    const loreLossRule = getRuleById('lore-loss')!;

    const thievery = createCard({
      id: 'thievery',
      name: 'Thievery',
      type: 'Action',
      ink: 'Ruby',
      cost: 1,
      text: 'Chosen opponent loses 1 lore. Gain 1 lore.',
    });

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

    it('should find other lore removers as strong synergies', () => {
      const synergies = loreLossRule.findSynergies(thievery, [
        thievery,
        jasmine,
        flotilla,
        unrelatedCard,
      ]);
      expect(synergies).toHaveLength(2);
      expect(synergies.every((s) => s.score === 7)).toBe(true);
      expect(synergies.find((s) => s.card.id === 'jasmine-rebellious')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'flotilla')).toBeDefined();
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
      ['tutor on Islands Pulled', islandsPulled, ['tutor']],
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

    it('should return empty for Location cards and unrelated cards', () => {
      expect(getLocationRoles(agrabah)).toEqual([]);
      expect(isLocationSupportCard(agrabah)).toBe(false);
      expect(getLocationRoles(unrelatedCard)).toEqual([]);
      expect(isLocationSupportCard(unrelatedCard)).toBe(false);
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
      // move/tutor → 5
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
      ['tutor + buff → 3', ['tutor'], ['buff'], 3],
      ['move + tutor → 3', ['move'], ['tutor'], 3],
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

    it('should detect boost role and find Locations as synergies', () => {
      expect(getLocationRoles(webbysDiary)).toContain('boost');

      const engine = new SynergyEngine();
      const groups = engine.findSynergies(webbysDiary, [webbysDiary, agrabah, unrelatedCard]);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');
      expect(locationGroup).toBeDefined();
      expect(locationGroup!.synergies.map((s) => s.card.id)).toContain('agrabah');
    });

    it('should assign score 5 for boost cards with Locations', () => {
      const engine = new SynergyEngine();
      const groups = engine.findSynergies(agrabah, [agrabah, webbysDiary]);
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
    it('should detect forced opponent discard as enabler', () => {
      expect(getDiscardRoles(suddenChill)).toEqual(['enabler']);
    });

    it('should detect targeted reveal+discard as enabler', () => {
      expect(getDiscardRoles(ludwigVonDrake)).toEqual(['enabler']);
    });

    it('should detect hand-cap as enabler', () => {
      expect(getDiscardRoles(princeJohnMirror)).toEqual(['enabler']);
    });

    it('should detect challenging player discard as enabler', () => {
      expect(getDiscardRoles(flynnRider)).toEqual(['enabler']);
    });

    it('should detect "that player discards at random" as enabler', () => {
      expect(getDiscardRoles(yzmaAbove)).toEqual(['enabler']);
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
      [
        'symmetric chaos draw/discard',
        'Each player draws 3 cards, then discards 3 cards at random.',
      ],
    ])('should detect enabler: %s', (_label, text) => {
      expect(getDiscardRoles(createCard({text}))).toEqual(['enabler']);
    });

    it('should detect dual-role card (enabler + payoff)', () => {
      const dualRole = createCard({
        text: 'Each opponent chooses and discards a card. While you have more cards in your hand than each opponent, this character gets +2 lore.',
      });
      expect(getDiscardRoles(dualRole)).toEqual(['enabler', 'payoff']);
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

    it('should score enabler ↔ enabler at 7', () => {
      const synergies = discardRule.findSynergies(suddenChill, allCards);
      const daisyMatch = synergies.find((s) => s.card.id === 'daisy-secret-agent');
      expect(daisyMatch).toBeDefined();
      expect(daisyMatch!.score).toBe(7);
      expect(daisyMatch!.explanation).toContain('disrupt');
    });

    it('should score enabler ↔ payoff at 8', () => {
      const synergies = discardRule.findSynergies(suddenChill, allCards);
      const pachaMatch = synergies.find((s) => s.card.id === 'pacha');
      expect(pachaMatch).toBeDefined();
      expect(pachaMatch!.score).toBe(8);
      expect(pachaMatch!.explanation).toContain('hand-size advantage');
    });

    it('should score payoff ↔ payoff at 7', () => {
      const synergies = discardRule.findSynergies(pacha, allCards);
      const yzmaMatch = synergies.find((s) => s.card.id === 'yzma-kitten');
      expect(yzmaMatch).toBeDefined();
      expect(yzmaMatch!.score).toBe(7);
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
      const singer = createCard({
        id: 'singer-1',
        name: 'Ariel',
        fullName: 'Ariel - Singing Mermaid',
        cost: 4,
        keywords: ['Singer 5'],
      });
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
      expect(synergies.find((s) => s.card.id === 'song-cheap')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'song-expensive')).toBeUndefined();
    });

    it('should score 8 when song cost equals Singer value (perfect fit)', () => {
      const singer = createCard({
        id: 'singer-1',
        name: 'Gazelle',
        fullName: 'Gazelle - Pop Star',
        cost: 3,
        keywords: ['Singer 5'],
      });
      const song = createCard({
        id: 'song-1',
        name: 'All Is Found',
        fullName: 'All Is Found',
        type: 'Action',
        cost: 5,
        text: 'A song card',
      });

      const synergies = singerRule.findSynergies(singer, [singer, song]);
      expect(synergies[0].score).toBe(8);
    });

    it('should score 7 when song cost is Singer value - 1', () => {
      const singer = createCard({
        id: 'singer-1',
        name: 'Gazelle',
        fullName: 'Gazelle - Pop Star',
        keywords: ['Singer 5'],
      });
      const song = createCard({
        id: 'song-1',
        name: 'Try Everything',
        fullName: 'Try Everything',
        type: 'Action',
        cost: 4,
        text: 'A song card',
      });

      const synergies = singerRule.findSynergies(singer, [singer, song]);
      expect(synergies[0].score).toBe(7);
    });

    it('should score 6 when song cost is Singer value - 2', () => {
      const singer = createCard({
        id: 'singer-1',
        name: 'Gazelle',
        fullName: 'Gazelle - Pop Star',
        keywords: ['Singer 5'],
      });
      const song = createCard({
        id: 'song-1',
        name: 'We Know the Way',
        fullName: 'We Know the Way',
        type: 'Action',
        cost: 3,
        text: 'A song card',
      });

      const synergies = singerRule.findSynergies(singer, [singer, song]);
      expect(synergies[0].score).toBe(6);
    });

    it('should score 5 when song cost is Singer value - 3 or more', () => {
      const singer = createCard({
        id: 'singer-1',
        name: 'Powerline',
        fullName: 'Powerline - World\'s Greatest Rock Star',
        keywords: ['Singer 9'],
      });
      const song = createCard({
        id: 'song-1',
        name: 'A Very Merry Unbirthday',
        fullName: 'A Very Merry Unbirthday',
        type: 'Action',
        cost: 1,
        text: 'A song card',
      });

      const synergies = singerRule.findSynergies(singer, [singer, song]);
      expect(synergies[0].score).toBe(5);
    });

    it('should mark synergies as bidirectional', () => {
      const singer = createCard({
        id: 'singer-1',
        name: 'Ariel',
        fullName: 'Ariel - Singing Mermaid',
        keywords: ['Singer 5'],
      });
      const song = createCard({
        id: 'song-1',
        name: 'Be Our Guest',
        fullName: 'Be Our Guest',
        type: 'Action',
        cost: 2,
        text: 'A song card',
      });

      const synergies = singerRule.findSynergies(singer, [singer, song]);
      expect(synergies[0].bidirectional).toBe(true);
    });

    it('should find Singers from Song perspective (reverse)', () => {
      const singer = createCard({
        id: 'singer-1',
        name: 'Gazelle',
        fullName: 'Gazelle - Pop Star',
        keywords: ['Singer 5'],
      });
      const weakSinger = createCard({
        id: 'singer-2',
        name: 'Angel',
        fullName: 'Angel - Siren Singer',
        keywords: ['Singer 3'],
      });
      const song = createCard({
        id: 'song-1',
        name: 'Try Everything',
        fullName: 'Try Everything',
        type: 'Action',
        cost: 4,
        text: 'A song card',
      });

      const synergies = singerRule.findSynergies(song, [song, singer, weakSinger]);
      // Gazelle (Singer 5) can play cost-4 song, Angel (Singer 3) cannot
      expect(synergies.find((s) => s.card.id === 'singer-1')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'singer-2')).toBeUndefined();
    });

    it('should not match non-Action cards even if text contains song', () => {
      const singer = createCard({
        id: 'singer-1',
        name: 'Ariel',
        fullName: 'Ariel - Singing Mermaid',
        keywords: ['Singer 5'],
      });
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
