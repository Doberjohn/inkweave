import {describe, it, expect} from 'vitest';
import {getItemRoles, readiesItemsOnly} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

// Items fixes from the 2026-10-14 misread review, kept out of rules.test.ts (CodeScene: function
// count). Real card text.

// Counts of item cards in your discard, which no item you play reaches.
const stegmutt = createCard({
  id: 'stegmutt-clumsy-dinosaur',
  name: 'Stegmutt',
  fullName: 'Stegmutt - Clumsy Dinosaur',
  ink: 'Emerald',
  text: 'WAKE OF DESTRUCTION For each item card in your\ndiscard, you pay 1 ⬡ less to play this character.\nCOLLATERAL DAMAGE When you play this character, you\nmay put 3 item cards from your discard on the bottom\nof your deck in any order. If you do, deal 3 damage to\nchosen character.',
});
const quackerjack = createCard({
  id: 'quackerjack-loony-toymaker',
  name: 'Quackerjack',
  fullName: 'Quackerjack - Loony Toymaker',
  ink: 'Sapphire',
  text: 'EVIL DESIGN When you play this character and\nwhenever he quests, put the top 4 cards of your\ndeck into your discard. You may deal 1 damage to\nchosen character for each item card put into your\ndiscard this way.',
});
const ariel = createCard({
  id: 'ariel-collector-of-oddities',
  name: 'Ariel',
  fullName: 'Ariel - Collector of Oddities',
  ink: 'Sapphire',
  text: 'ONE OF A KIND Whenever you play an item, if the\nitem you played has a different name than each\nother item you have in play, draw a card.\nPERSONAL COLLECTION For each item with a\ndifferent name you have in play, this character\ngets +1 ◊.',
});
const pooh = createCard({
  id: 'winnie-the-pooh-hungry-bear',
  name: 'Winnie the Pooh',
  fullName: 'Winnie the Pooh - Hungry Bear',
  ink: 'Sapphire',
  text: 'LOOKING FOR A MORSEL When you play this\ncharacter, you may return an item card from your\ndiscard to your hand.',
});
const darkwing = createCard({
  id: 'darkwing-duck-dashing-gadgeteer',
  name: 'Darkwing Duck',
  fullName: 'Darkwing Duck - Dashing Gadgeteer',
  ink: 'Sapphire',
  text: 'MODERN MARVEL Whenever this character quests,\nyou may put an item card from your discard on the\nbottom of your deck. If you do, you may play an item\nwith cost 5 or less from your discard for free.',
});

describe('Items: item cards in your discard', () => {
  it('reads no item payoff from a count of item cards in your discard', () => {
    expect(getItemRoles(stegmutt)).not.toContain('payoff-static');
    expect(getItemRoles(quackerjack)).toEqual([]);
    expect(getItemRoles(ariel)).toContain('payoff-static');
  });

  it('reads no recursion from moving item cards to the bottom of your deck', () => {
    expect(getItemRoles(stegmutt)).not.toContain('item-engine');
    expect(getItemRoles(pooh)).toEqual(['item-engine']);
    // Darkwing Duck still plays an item from your discard.
    expect(getItemRoles(darkwing)).toEqual(['item-engine']);
  });
});

const itemsRule = getRuleById('items')!;
/** The Items pair `card` finds with `partner`, or undefined when they do not pair. */
const itemsPair = (card: LorcanaCard, partner: LorcanaCard) =>
  itemsRule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);

// Payoffs that only ready an item.
const edna = createCard({
  id: 'edna-mode-super-suit-designer',
  name: 'Edna Mode',
  fullName: 'Edna Mode - Super Suit Designer',
  ink: 'Sapphire',
  text: "KEY ACCESSORY ⟳ — Ready chosen item.\nALL THE BASICS While you have an item\nnamed Super Suit in play, this character gains\nWard. (Opponents can't choose them except to\nchallenge.)",
});
const castle = createCard({
  id: 'castle-of-the-horned-king-bastion-of-evil',
  name: 'Castle of the Horned King',
  fullName: 'Castle of the Horned King - Bastion of Evil',
  type: 'Location',
  ink: 'Sapphire',
  text: 'INTO THE GLOOM Once during your turn, whenever a character quests\nwhile here, you may ready chosen item.',
});
// An item with no exert ability, and one with a ⟳ ability.
const potato = createCard({
  id: 'potato',
  name: 'Potato',
  fullName: 'Potato',
  type: 'Item',
  ink: 'Emerald',
  text: 'FULL OF POTENTIAL This item enters play exerted.',
});
const screamCanister = createCard({
  id: 'scream-canister',
  name: 'Scream Canister',
  fullName: 'Scream Canister',
  type: 'Item',
  ink: 'Ruby',
  text: 'ERRATIC SCREAMS ⟳, 2 ⬡ — Exert all cards in your\ninkwell. Exert chosen opposing character with 2 ¤\nor less.',
});

describe('Items: a payoff that only readies an item', () => {
  it('reads which payoffs only ready an item', () => {
    expect(readiesItemsOnly(edna)).toBe(true);
    expect(readiesItemsOnly(castle)).toBe(true);
    expect(readiesItemsOnly(ariel)).toBe(false);
  });

  it('pairs only with items that have an exert ability, from either side', () => {
    for (const payoff of [edna, castle]) {
      expect(itemsPair(payoff, potato)).toBeUndefined();
      expect(itemsPair(potato, payoff)).toBeUndefined();
      expect(itemsPair(payoff, screamCanister)?.score).toBe(6);
    }
  });
});
