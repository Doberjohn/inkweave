import {describe, it, expect} from 'vitest';
import {getRuleById, getCrossSynergyScore, SynergyEngine} from '../engine';
import {
  hasNegativeTargeting,
  hasPositiveClassificationEffect,
  getLocationRoles,
  isLocationSupportCard,
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

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 4,
      });

      const anna = createCard({
        id: 'anna-1',
        name: 'Anna',
        fullName: 'Anna - Heir to Arendelle',
        cost: 3,
      });

      const allCards = [elsaShift, elsaBase, anna];
      const synergies = shiftRule.findSynergies(elsaShift, allCards);

      expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
    });

    it('should find Shift cards when selecting a base character (reverse)', () => {
      const elsaShift = createCard({
        id: 'elsa-shift',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
        classifications: ['Floodborn'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 4,
      });

      const anna = createCard({
        id: 'anna-1',
        name: 'Anna',
        fullName: 'Anna - Heir to Arendelle',
        cost: 3,
      });

      const allCards = [elsaShift, elsaBase, anna];
      const synergies = shiftRule.findSynergies(elsaBase, allCards);

      expect(synergies.find((s) => s.card.id === 'elsa-shift')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'anna-1')).toBeUndefined();
    });

    it('should show other Shift cards with same base name', () => {
      const elsaShift1 = createCard({
        id: 'elsa-shift-1',
        name: 'Elsa',
        fullName: 'Elsa - Ice Maker',
        cost: 7,
        keywords: ['Shift 5'],
      });

      const elsaShift2 = createCard({
        id: 'elsa-shift-2',
        name: 'Elsa',
        fullName: 'Elsa - Frost Mage',
        cost: 6,
        keywords: ['Shift 4'],
      });

      const elsaBase = createCard({
        id: 'elsa-base',
        name: 'Elsa',
        fullName: 'Elsa - Snow Queen',
        cost: 3,
      });

      const allCards = [elsaShift1, elsaShift2, elsaBase];
      const synergies = shiftRule.findSynergies(elsaShift1, allCards);

      expect(synergies.find((s) => s.card.id === 'elsa-base')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'elsa-shift-2')).toBeDefined();
    });

    it('should not match non-Character cards', () => {
      const shiftAction = createCard({
        id: 'action-1',
        type: 'Action',
        keywords: ['Shift 3'],
      });

      expect(shiftRule.matches(shiftAction)).toBe(false);
    });

    describe('score calculation', () => {
      it('should rate on-curve inkable base as 9 (curveGap 1)', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: 7,
          keywords: ['Shift 5'],
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: 4,
          inkwell: true,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(9);
      });

      it('should rate on-curve non-inkable base as 7 (curveGap 1)', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: 7,
          keywords: ['Shift 5'],
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: 4,
          inkwell: false,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(7);
      });

      it('should rate curveGap 2 with inkable base as 7', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: 8,
          keywords: ['Shift 6'],
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: 4,
          inkwell: true,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(7);
      });

      it('should rate slightly off-curve base as 5 (curveGap 3)', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: 7,
          keywords: ['Shift 5'],
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: 2,
          inkwell: true,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(5);
      });

      it('should rate far off-curve base as 3 (curveGap >= 4)', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: 7,
          keywords: ['Shift 5'],
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: 1,
          inkwell: true,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(3);
      });

      it('should rate same-cost-as-shift base as 5 (curveGap 0)', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: 7,
          keywords: ['Shift 5'],
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: 5,
          inkwell: true,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(5);
      });

      it('should produce consistent score in reverse direction', () => {
        const shiftCard = createCard({
          id: 'elsa-shift',
          name: 'Elsa',
          fullName: 'Elsa - Ice Maker',
          cost: 7,
          keywords: ['Shift 5'],
        });
        const base = createCard({
          id: 'elsa-base',
          name: 'Elsa',
          fullName: 'Elsa - Snow Queen',
          cost: 4,
          inkwell: true,
        });
        const forward = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        const reverse = shiftRule.findSynergies(base, [shiftCard, base]);
        expect(forward[0].score).toBe(9);
        expect(reverse[0].score).toBe(forward[0].score);
      });

      it('regression: small shift onto cheap base should not score 3', () => {
        // Issue #108: Shift 3 onto cost 2 was rated weak (costDiff 1)
        // but curveGap 1 is an ideal play pattern
        const shiftCard = createCard({
          id: 'simba-shift',
          name: 'Simba',
          fullName: 'Simba - Returned King',
          cost: 4,
          keywords: ['Shift 3'],
        });
        const base = createCard({
          id: 'simba-base',
          name: 'Simba',
          fullName: 'Simba - Young Prince',
          cost: 2,
          inkwell: true,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(9);
      });

      it('regression: huge shift onto tiny base should not score high', () => {
        // Issue #108: Shift 8 onto cost 2 was rated strong (costDiff 6)
        // but curveGap 6 is an unrealistic play pattern
        const shiftCard = createCard({
          id: 'ursula-shift',
          name: 'Ursula',
          fullName: 'Ursula - Sea Witch Queen',
          cost: 10,
          keywords: ['Shift 8'],
        });
        const base = createCard({
          id: 'ursula-base',
          name: 'Ursula',
          fullName: 'Ursula - Cauldron Keeper',
          cost: 2,
          inkwell: true,
        });
        const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
        expect(synergies[0].score).toBe(3);
      });
    });
  });

  describe('Lore Loss', () => {
    const loreLossRule = getRuleById('lore-loss')!;

    const thievery = createCard({
      id: 'thievery',
      name: 'Thievery',
      fullName: 'Thievery',
      type: 'Action',
      ink: 'Ruby',
      cost: 1,
      text: 'Chosen opponent loses 1 lore. Gain 1 lore.',
    });

    const jasmine = createCard({
      id: 'jasmine-rebellious',
      name: 'Jasmine',
      fullName: 'Jasmine - Rebellious Princess',
      ink: 'Ruby',
      cost: 3,
      text: "YOU'LL NEVER MISS IT Whenever this character quests, each opponent loses 1 lore.",
    });

    const flotilla = createCard({
      id: 'flotilla',
      name: 'Flotilla',
      fullName: 'Flotilla - Coconut Armada',
      type: 'Location',
      ink: 'Ruby',
      cost: 2,
      text: 'TINY THIEVES At the start of your turn, if you have a character here, all opponents lose 1 lore and you gain lore equal to the lore lost this way.',
    });

    const unrelatedCard = createCard({
      id: 'anna-1',
      name: 'Anna',
      fullName: 'Anna - Heir to Arendelle',
      cost: 3,
      text: 'When you play this character, draw a card.',
    });

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
      const nanisPayback = createCard({
        id: 'nanis-payback',
        name: "Nani's Payback",
        text: 'Each opponent loses lore equal to the damage on chosen character of yours, to a maximum of 4 lore each.',
      });
      expect(loreLossRule.matches(nanisPayback)).toBe(true);
    });

    it('should find other lore removers as strong synergies', () => {
      const allCards = [thievery, jasmine, flotilla, unrelatedCard];
      const synergies = loreLossRule.findSynergies(thievery, allCards);

      expect(synergies).toHaveLength(2);
      expect(synergies.every((s) => s.score === 7)).toBe(true);
      expect(synergies.find((s) => s.card.id === 'jasmine-rebellious')).toBeDefined();
      expect(synergies.find((s) => s.card.id === 'flotilla')).toBeDefined();
    });

    it('should not include the selected card itself', () => {
      const allCards = [thievery, jasmine];
      const synergies = loreLossRule.findSynergies(thievery, allCards);

      expect(synergies.find((s) => s.card.id === 'thievery')).toBeUndefined();
    });

    it('should mark synergies as bidirectional', () => {
      const allCards = [thievery, jasmine];
      const synergies = loreLossRule.findSynergies(thievery, allCards);

      expect(synergies[0].bidirectional).toBe(true);
    });
  });
});

describe('Location Synergy Rules', () => {
  // --- Fixtures based on real Lorcana cards ---
  const elsaIceArtisan = createCard({
    id: 'elsa-ice-artisan',
    name: 'Elsa',
    fullName: 'Elsa - Ice Artisan',
    cost: 6,
    ink: 'Ruby',
    keywords: ['Shift 4'],
    text: 'Shift 4 ENDLESS WINTER When you play this character and whenever you play a location, you may exert chosen character with 3 or less. DISTANT CALL While this character is at a location, she gets +3 lore.',
  });

  const transportPod = createCard({
    id: 'transport-pod',
    name: 'Transport Pod',
    fullName: 'Transport Pod',
    type: 'Item',
    cost: 1,
    ink: 'Emerald',
    text: "GIVE 'EM A SHOW At the start of your turn, you may move a character of yours to a location for free.",
  });

  const johnSilver = createCard({
    id: 'john-silver-treasure',
    name: 'John Silver',
    fullName: 'John Silver - Greedy Treasure Seeker',
    cost: 3,
    ink: 'Ruby',
    text: 'CHART YOUR OWN COURSE For each location you have in play, this character gains Resist +1 and gets +1 lore.',
  });

  const islandsPulled = createCard({
    id: 'islands-pulled',
    name: 'The Islands I Pulled from the Sea',
    fullName: 'The Islands I Pulled from the Sea',
    type: 'Action',
    cost: 3,
    ink: 'Ruby',
    text: 'Search your deck for a location card, reveal that card to all players, and put it into your hand. Then, shuffle your deck.',
  });

  const felixSteward = createCard({
    id: 'felix-steward',
    name: 'Fix-It Felix, Jr.',
    fullName: 'Fix-It Felix, Jr. - Niceland Steward',
    cost: 5,
    ink: 'Amber',
    keywords: ['Shift 3'],
    text: 'Shift 3 BUILDING TOGETHER Your locations get +2 willpower.',
  });

  const agrabah = createCard({
    id: 'agrabah',
    name: 'Agrabah',
    fullName: 'Agrabah - Marketplace',
    type: 'Location',
    cost: 3,
    ink: 'Ruby',
  });

  const unrelatedCard = createCard({
    id: 'anna-plain',
    name: 'Anna',
    fullName: 'Anna - Heir to Arendelle',
    cost: 3,
    text: 'When you play this character, draw a card.',
  });

  const anotherLocation = createCard({
    id: 'motunui',
    name: 'Motunui',
    fullName: 'Motunui - Island Paradise',
    type: 'Location',
    cost: 2,
    ink: 'Emerald',
  });

  describe('Location role detection', () => {
    it('should detect at-payoff and play-trigger on Elsa - Ice Artisan', () => {
      const roles = getLocationRoles(elsaIceArtisan);
      expect(roles).toContain('at-payoff');
      expect(roles).toContain('play-trigger');
    });

    it('should detect move role on Transport Pod', () => {
      expect(getLocationRoles(transportPod)).toEqual(['move']);
    });

    it('should detect in-play-check on John Silver', () => {
      expect(getLocationRoles(johnSilver)).toContain('in-play-check');
    });

    it('should detect tutor on The Islands I Pulled from the Sea', () => {
      expect(getLocationRoles(islandsPulled)).toEqual(['tutor']);
    });

    it('should detect buff on Felix Steward', () => {
      expect(getLocationRoles(felixSteward)).toContain('buff');
    });

    it('should return empty for Location cards', () => {
      expect(getLocationRoles(agrabah)).toEqual([]);
      expect(isLocationSupportCard(agrabah)).toBe(false);
    });

    it('should return empty for unrelated cards', () => {
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
      // Should NOT include other locations or unrelated cards
      expect(cardIds).not.toContain('motunui');
      expect(cardIds).not.toContain('anna-plain');
    });

    it('should find Locations when a support card is selected', () => {
      const groups = engine.findSynergies(elsaIceArtisan, allCards);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');

      expect(locationGroup).toBeDefined();
      const cardIds = locationGroup!.synergies.map((s) => s.card.id);
      expect(cardIds).toContain('agrabah');
      expect(cardIds).toContain('motunui');
    });

    it('should assign score 7 for at-payoff cards with Locations', () => {
      const groups = engine.findSynergies(agrabah, allCards);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control')!;
      const elsaSynergy = locationGroup.synergies.find((s) => s.card.id === 'elsa-ice-artisan');

      expect(elsaSynergy!.score).toBe(7);
    });

    it('should assign score 5 for move/tutor cards with Locations', () => {
      const groups = engine.findSynergies(agrabah, allCards);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control')!;
      const podSynergy = locationGroup.synergies.find((s) => s.card.id === 'transport-pod');
      const tutorSynergy = locationGroup.synergies.find((s) => s.card.id === 'islands-pulled');

      expect(podSynergy!.score).toBe(5);
      expect(tutorSynergy!.score).toBe(5);
    });

    it('should not produce location synergies for unrelated cards', () => {
      const groups = engine.findSynergies(unrelatedCard, allCards);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');

      expect(locationGroup).toBeUndefined();
    });
  });

  describe('Cross-synergy between support cards', () => {
    it('should return 5 when both have high-value complementary roles', () => {
      // at-payoff complements buff (buff keeps locations alive for payoff)
      expect(getCrossSynergyScore(['at-payoff', 'play-trigger'], ['buff'])).toBe(5);
    });

    it('should return 3 when complementary but not both high-value', () => {
      // at-payoff complements move (move enables payoff)
      expect(getCrossSynergyScore(['at-payoff'], ['move'])).toBe(3);
      // tutor complements buff (tutor finds locations for buff to protect)
      expect(getCrossSynergyScore(['tutor'], ['buff'])).toBe(3);
    });

    it('should return null for cards with only the same roles (no complement)', () => {
      expect(getCrossSynergyScore(['at-payoff'], ['at-payoff'])).toBeNull();
      expect(getCrossSynergyScore(['boost'], ['boost'])).toBeNull();
    });

    it('should return null for non-complementary role pairs', () => {
      // at-payoff and in-play-check don't directly enable each other
      expect(getCrossSynergyScore(['at-payoff'], ['in-play-check'])).toBeNull();
      // boost and move have no direct interaction
      expect(getCrossSynergyScore(['boost'], ['move'])).toBeNull();
    });

    it('should return 3 for tutor + move (enabler + positioning)', () => {
      expect(getCrossSynergyScore(['move'], ['tutor'])).toBe(3);
    });

    it('should show cross-synergy between Elsa and Felix in engine results', () => {
      const engine = new SynergyEngine();
      const allCards = [elsaIceArtisan, felixSteward, agrabah];
      const groups = engine.findSynergies(elsaIceArtisan, allCards);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');

      expect(locationGroup).toBeDefined();
      const felixMatch = locationGroup!.synergies.find((s) => s.card.id === 'felix-steward');
      expect(felixMatch).toBeDefined();
      // Both high-value: at-payoff complements buff
      expect(felixMatch!.score).toBe(5);
    });
  });

  describe('Boost role detection', () => {
    const webbysDiary = createCard({
      id: 'webbys-diary',
      name: "Webby's Diary",
      fullName: "Webby's Diary",
      type: 'Item',
      cost: 2,
      ink: 'Amber',
      text: 'LATEST ENTRY Whenever you put a card under one of your characters or locations, you may pay 1 to draw a card.',
    });

    it('should detect boost role', () => {
      expect(getLocationRoles(webbysDiary)).toContain('boost');
    });

    it('should find Locations as synergies for boost cards', () => {
      const engine = new SynergyEngine();
      const groups = engine.findSynergies(webbysDiary, [webbysDiary, agrabah, unrelatedCard]);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');
      expect(locationGroup).toBeDefined();
      expect(locationGroup!.synergies.map((s) => s.card.id)).toContain('agrabah');
    });

    it('should assign score 5 for boost cards with Locations', () => {
      const engine = new SynergyEngine();
      const groups = engine.findSynergies(agrabah, [agrabah, webbysDiary]);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control')!;
      const diaryMatch = locationGroup.synergies.find((s) => s.card.id === 'webbys-diary');
      expect(diaryMatch!.score).toBe(5);
    });
  });

  describe('Location-ramp role detection', () => {
    const elsaConcerned = createCard({
      id: 'elsa-concerned',
      name: 'Elsa',
      fullName: 'Elsa - Concerned Sister',
      cost: 4,
      ink: 'Ruby',
      text: 'CLEAR THE WAY When you play this character, you pay 2 less for the next location you play this turn.',
    });

    it('should detect location-ramp role', () => {
      expect(getLocationRoles(elsaConcerned)).toContain('location-ramp');
    });

    it('should assign score 7 for location-ramp cards with Locations', () => {
      const engine = new SynergyEngine();
      const groups = engine.findSynergies(agrabah, [agrabah, elsaConcerned]);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control')!;
      const elsaMatch = locationGroup.synergies.find((s) => s.card.id === 'elsa-concerned');
      expect(elsaMatch!.score).toBe(7);
    });
  });

  describe('Anti-location exclusion', () => {
    const launchpadPilot = createCard({
      id: 'launchpad-pilot',
      name: 'Launchpad',
      fullName: 'Launchpad - Exceptional Pilot',
      cost: 4,
      ink: 'Emerald',
      text: 'OFF THE MAP When you play this character, you may banish chosen location.',
    });

    it('should exclude anti-location cards from all roles', () => {
      expect(getLocationRoles(launchpadPilot)).toEqual([]);
      expect(isLocationSupportCard(launchpadPilot)).toBe(false);
    });

    it('should not show anti-location cards in location synergies', () => {
      const engine = new SynergyEngine();
      const groups = engine.findSynergies(agrabah, [agrabah, launchpadPilot, unrelatedCard]);
      const locationGroup = groups.find((g) => g.groupKey === 'location-control');
      expect(locationGroup).toBeUndefined();
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
      const card = createCard({
        text: 'Banish target Villain character.',
      });

      expect(hasNegativeTargeting(card, 'Villain')).toBe(true);
    });
  });

  describe('hasPositiveClassificationEffect', () => {
    it('should detect positive buff effects', () => {
      const card = createCard({
        text: 'Your Princess characters get +2 strength.',
      });

      expect(hasPositiveClassificationEffect(card, 'Princess')).toBe(true);
    });

    it('should detect conditional benefits', () => {
      const card = createCard({
        text: 'If you have a Villain character, draw a card.',
      });

      expect(hasPositiveClassificationEffect(card, 'Villain')).toBe(true);
    });
  });
});
