import {describe, it, expect} from 'vitest';
import {getSelfDiscardRoles} from '../utils';
import {createCard} from './fixtures';

// Self-Discard fixes from #628, kept out of rules.test.ts (CodeScene: function count). Real card
// text, named by fullName (Set 14 preview ids renumber when the set graduates).

// Recursion that can only return the card itself or a card it just handled.
const aurora = createCard({
  fullName: 'Aurora - Delightful Musician',
  text: 'MELODIC REFRAIN When you play this character, return a song card you played this turn with cost 3 or less from your discard to your hand.\nJOYOUS RECEPTION At the end of your turn, if you played a song this turn, gain 1 lore.',
});
const tiana = createCard({
  fullName: 'Tiana - Party Hostess',
  text: 'Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your characters named Tiana.)\nIDEAL VENUE When you play this character, you may draw 2 cards, then choose and discard a card. If you discarded a location card this way, you may play it from your discard for free.',
});
const tornScrap = createCard({
  fullName: 'Torn Scrap',
  type: 'Item',
  text: 'FOND MEMORIES ⟳, 1 ⬡ — If you have 10 or more cards in your discard, draw a card.\nTOGETHER AGAIN When this card is put into your discard from your deck, if you have an item named Rivera Family Photo in play, you may play this item from your discard for free.',
});
const heiHei = createCard({
  fullName: 'HeiHei - Persistent Presence',
  text: "HE'S BACK! When this character is banished in a\nchallenge, return this card from your discard to\nyour hand.",
});

// Recursion that fires when you discard the card: hand discard really feeds it.
const gothel = createCard({
  fullName: 'Mother Gothel - Evil as Ever',
  text: "MUMMY'S BACK During your turn, when you\ndiscard this card, you may play this character\nfrom your discard. (You pay all costs.)",
});
const lookWhatYouveDone = createCard({
  fullName: "Look What You've Done",
  type: 'Action',
  text: 'Deal 2 damage to chosen character. During your turn,\nwhen you discard this card, you may play it from your\ndiscard. (You pay all costs.)',
});

describe('Self-Discard roles: self-contained recursion', () => {
  it('does not read recursion of the card itself, or of a card it just handled, as a reanimator', () => {
    expect(getSelfDiscardRoles(aurora)).not.toContain('reanimator');
    expect(getSelfDiscardRoles(heiHei)).toEqual([]);
  });

  it("keeps a card's other roles when its recursion is self-contained", () => {
    expect(getSelfDiscardRoles(tiana)).toEqual(['enabler']);
    expect(getSelfDiscardRoles(tornScrap)).toEqual(['zone-payoff']);
  });

  it('keeps self-recursion that fires when you discard the card', () => {
    expect(getSelfDiscardRoles(gothel)).toContain('reanimator');
    expect(getSelfDiscardRoles(lookWhatYouveDone)).toContain('reanimator');
  });
});
