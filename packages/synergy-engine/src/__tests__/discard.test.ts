import {describe, it, expect} from 'vitest';
import {getDiscardRoles, isDiscardCard} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';

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
      expect(yzmaMatch!.explanation).toBe(
        '{A} and {B} both reward having more cards in hand than the opponent.',
      );
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
