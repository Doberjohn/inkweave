import {describe, it, expect} from 'vitest';
import {getRuleById, getCrossSynergyStrength} from '../engine/rules.js';
import {hasNegativeTargeting, hasPositiveClassificationEffect, getLocationRoles, isLocationSupportCard} from '../utils/cardHelpers.js';
import {SynergyEngine} from '../engine/SynergyEngine.js';
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

    it('should not show other Shift cards in forward direction', () => {
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
      expect(synergies.find((s) => s.card.id === 'elsa-shift-2')).toBeUndefined();
    });

    it('should not match non-Character cards', () => {
      const shiftAction = createCard({
        id: 'action-1',
        type: 'Action',
        keywords: ['Shift 3'],
      });

      expect(shiftRule.matches(shiftAction)).toBe(false);
    });

    describe('strength calculation', () => {
      it('should rate on-curve inkable base as strong (curveGap 1)', () => {
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
        expect(synergies[0].strength).toBe('strong');
      });

      it('should rate on-curve non-inkable base as moderate (curveGap 1)', () => {
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
        expect(synergies[0].strength).toBe('moderate');
      });

      it('should rate curveGap 2 with inkable base as strong', () => {
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
        expect(synergies[0].strength).toBe('strong');
      });

      it('should rate slightly off-curve base as moderate (curveGap 3)', () => {
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
        expect(synergies[0].strength).toBe('moderate');
      });

      it('should rate far off-curve base as weak (curveGap >= 4)', () => {
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
        expect(synergies[0].strength).toBe('weak');
      });

      it('should rate same-cost-as-shift base as moderate (curveGap 0)', () => {
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
        expect(synergies[0].strength).toBe('moderate');
      });

      it('should produce consistent strength in reverse direction', () => {
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
        expect(forward[0].strength).toBe('strong');
        expect(reverse[0].strength).toBe(forward[0].strength);
      });

      it('regression: small shift onto cheap base should not be weak', () => {
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
        expect(synergies[0].strength).toBe('strong');
      });

      it('regression: huge shift onto tiny base should not be strong', () => {
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
        expect(synergies[0].strength).toBe('weak');
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
      expect(synergies.every((s) => s.strength === 'strong')).toBe(true);
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
    const allCards = [elsaIceArtisan, transportPod, johnSilver, islandsPulled, felixSteward, agrabah, anotherLocation, unrelatedCard];

    it('should find location-support cards when a Location is selected', () => {
      const groups = engine.findSynergies(agrabah, allCards);
      const locationGroup = groups.find((g) => g.type === 'location');

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
      const locationGroup = groups.find((g) => g.type === 'location');

      expect(locationGroup).toBeDefined();
      const cardIds = locationGroup!.synergies.map((s) => s.card.id);
      expect(cardIds).toContain('agrabah');
      expect(cardIds).toContain('motunui');
    });

    it('should assign strong strength for at-payoff cards with Locations', () => {
      const groups = engine.findSynergies(agrabah, allCards);
      const locationGroup = groups.find((g) => g.type === 'location')!;
      const elsaSynergy = locationGroup.synergies.find((s) => s.card.id === 'elsa-ice-artisan');

      expect(elsaSynergy!.strength).toBe('strong');
    });

    it('should assign moderate strength for move/tutor cards with Locations', () => {
      const groups = engine.findSynergies(agrabah, allCards);
      const locationGroup = groups.find((g) => g.type === 'location')!;
      const podSynergy = locationGroup.synergies.find((s) => s.card.id === 'transport-pod');
      const tutorSynergy = locationGroup.synergies.find((s) => s.card.id === 'islands-pulled');

      expect(podSynergy!.strength).toBe('moderate');
      expect(tutorSynergy!.strength).toBe('moderate');
    });

    it('should not produce location synergies for unrelated cards', () => {
      const groups = engine.findSynergies(unrelatedCard, allCards);
      const locationGroup = groups.find((g) => g.type === 'location');

      expect(locationGroup).toBeUndefined();
    });
  });

  describe('Cross-synergy between support cards', () => {
    it('should return moderate when both have high-value roles', () => {
      // at-payoff + play-trigger vs buff
      expect(getCrossSynergyStrength(['at-payoff', 'play-trigger'], ['buff'])).toBe('moderate');
    });

    it('should return weak when one has high-value and other has support role', () => {
      expect(getCrossSynergyStrength(['at-payoff'], ['move'])).toBe('weak');
      expect(getCrossSynergyStrength(['tutor'], ['buff'])).toBe('weak');
    });

    it('should return null for cards with only the same roles', () => {
      expect(getCrossSynergyStrength(['at-payoff'], ['at-payoff'])).toBe(null);
      expect(getCrossSynergyStrength(['move', 'tutor'], ['move', 'tutor'])).toBe(null);
    });

    it('should return null when only support roles on both sides', () => {
      expect(getCrossSynergyStrength(['move'], ['tutor'])).toBe(null);
    });

    it('should show cross-synergy between Elsa and Felix in engine results', () => {
      const engine = new SynergyEngine();
      const allCards = [elsaIceArtisan, felixSteward, agrabah];
      const groups = engine.findSynergies(elsaIceArtisan, allCards);
      const locationGroup = groups.find((g) => g.type === 'location');

      expect(locationGroup).toBeDefined();
      const felixMatch = locationGroup!.synergies.find((s) => s.card.id === 'felix-steward');
      expect(felixMatch).toBeDefined();
      expect(felixMatch!.strength).toBe('moderate');
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
