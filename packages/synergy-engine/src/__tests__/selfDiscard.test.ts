import {describe, it, expect} from 'vitest';
import {getSelfDiscardRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

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
const belle = createCard({
  fullName: 'Belle - Snowfield Strategist',
  text: 'WINTER STOCKPILE Whenever one of your characters is banished, you may put that card from your discard into your inkwell facedown and exerted.',
});
const sulleyAndBoo = createCard({
  fullName: 'Sulley & Boo - Scare Buddies',
  text: 'Combo Shift 4 ⬡ (You may pay 4 ⬡ to play this on top\nof one of your characters named Sulley, one named Boo,\nor one of each.)\nTHE POWER OF FRIENDSHIP When this character is\nbanished, if any of the cards that were under them are\ncharacter cards, you may play those characters from\nyour discard for free.',
});

// Recursion that fires when you discard the card: hand discard really feeds it.
const gothel = createCard({
  fullName: 'Mother Gothel - Evil as Ever',
  text: "MUMMY'S BACK During your turn, when you\ndiscard this card, you may play this character\nfrom your discard. (You pay all costs.)",
});
const lookWhatYouveDone = createCard({
  id: 'look-what-youve-done',
  name: "Look What You've Done",
  fullName: "Look What You've Done",
  type: 'Action',
  ink: 'Ruby',
  text: 'Deal 2 damage to chosen character. During your turn,\nwhen you discard this card, you may play it from your\ndiscard. (You pay all costs.)',
});

describe('Self-Discard roles: self-contained recursion', () => {
  it('does not read recursion of the card itself, or of a card it just handled, as a reanimator', () => {
    expect(getSelfDiscardRoles(aurora)).not.toContain('reanimator');
    expect(getSelfDiscardRoles(heiHei)).toEqual([]);
    expect(getSelfDiscardRoles(belle)).toEqual([]);
    expect(getSelfDiscardRoles(sulleyAndBoo)).toEqual([]);
  });

  it("keeps a card's other roles when its recursion is self-contained", () => {
    expect(getSelfDiscardRoles(tiana)).toEqual(['enabler']);
    expect(getSelfDiscardRoles(tornScrap)).toEqual(['zone-payoff']);
  });

  it('keeps self-recursion that fires when you discard the card', () => {
    expect(getSelfDiscardRoles(gothel)).toContain('reanimator');
    expect(getSelfDiscardRoles(lookWhatYouveDone)).toContain('reanimator');
  });

  it('keeps enter-play recursion whose trigger names this character', () => {
    const onPlay = createCard({text: 'When you play this character, return a card from your discard to your hand.'});
    expect(getSelfDiscardRoles(onPlay)).toContain('reanimator');
  });
});

// Outlets that can only discard one kind of card, and the payoffs they may or may not feed.
const maxKaraoke = createCard({
  id: 'max-karaoke-star',
  name: 'Max Goof',
  fullName: 'Max Goof - Karaoke Star',
  ink: 'Emerald',
  text: 'SWEET REMIX When you play this character, you may choose and discard a song card. If you do, draw 2 cards.\nBRAND-NEW PLAYLIST While you have 5 or more song cards in your discard, this character gets +3 ◊.',
});
const sprout = createCard({
  id: 'sprout-experiment-509',
  name: 'Sprout',
  fullName: 'Sprout - Experiment 509',
  ink: 'Steel',
  text: 'Resist +1 (Damage dealt to this character is\nreduced by 1.)\nBOTANICAL EVIL When you play this character,\nyou may choose and discard an Alien character\ncard or a location card from your hand. If you do,\ndeal 2 damage to chosen character.',
});
const youBrokeMySmolder = createCard({
  id: 'you-broke-my-smolder',
  name: 'You Broke My Smolder',
  fullName: 'You Broke My Smolder',
  type: 'Action',
  ink: 'Steel',
  text: 'Discard your hand. Draw 2 cards.',
});
const kronk = createCard({
  id: 'kronk-meat-hut-cook',
  name: 'Kronk',
  fullName: 'Kronk - Meat Hut Cook',
  ink: 'Steel',
  text: 'Resist +1 (Damage dealt to this character is\nreduced by 1.)\nPICKUP! Once during your turn, you may pay 1 ⬡\nto draw a card, then choose and discard a card.',
});

const maxTeen = createCard({
  id: 'max-rebellious-teen',
  name: 'Max Goof',
  fullName: 'Max Goof - Rebellious Teen',
  ink: 'Emerald',
  text: 'PERSONAL SOUNDTRACK When you play this\ncharacter, you may pay 1 ⬡ to return a song card\nwith cost 3 or less from your discard to your hand.',
});
const buzz = createCard({
  id: 'buzz-jungle-ranger',
  name: 'Buzz Lightyear',
  fullName: 'Buzz Lightyear - Jungle Ranger',
  ink: 'Emerald',
  text: 'Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of\nyour characters named Buzz Lightyear.)\nTAKE CHARGE When you play this character, you may\nreturn an action card with cost 7 or less from your discard\nto your hand.\nADVANCED TRAINING Whenever you play an action, chosen\ncharacter gets +1 ◊ this turn.',
});
const jiminy = createCard({
  id: 'jiminy-ghost-of-christmas-past',
  name: 'Jiminy Cricket',
  fullName: 'Jiminy Cricket - Ghost of Christmas Past',
  ink: 'Sapphire',
  text: 'Boost 2 ⬡ (Once during your turn, you may pay 2 ⬡\nto put the top card of your deck facedown under this\ncharacter.)\nLOOK INTO YOUR PAST Whenever you put a card\nunder this character, you may put a card from your\ndiscard into your inkwell facedown and exerted.',
});
const circleOfLife = createCard({
  id: 'circle-of-life',
  name: 'Circle of Life',
  fullName: 'Circle of Life',
  type: 'Action',
  ink: 'Amber',
  classifications: ['Song'],
  text: "Sing Together 8 (Any number of your or your\nteammates' characters with total cost 8 or more may\n⟳ to sing this song for free.)\nPlay a character from your discard for free.",
});
const salvageOperation = createCard({
  id: 'salvage-operation',
  name: 'Salvage Operation',
  fullName: 'Salvage Operation',
  type: 'Action',
  ink: 'Sapphire',
  text: 'Return an item card from your discard to your hand. If you\nhave a character with 4 ⛉ or more in play, gain 1 lore.',
});
const merida = createCard({
  id: 'merida-formidable-archer',
  name: 'Merida',
  fullName: 'Merida - Formidable Archer',
  ink: 'Steel',
  text: 'FULL QUIVER When you play this character, you\nmay return an action card named Three Arrows\nfrom your discard to your hand.\nSTEADY AIM Whenever one of your actions deals\ndamage to an opposing character, deal 2 damage\nto that character.',
});
const getToSafety = createCard({
  id: 'get-to-safety',
  name: 'Get to Safety!',
  fullName: 'Get to Safety!',
  type: 'Action',
  ink: 'Ruby',
  text: 'Play a location with cost 3 or less from your discard for\nfree. Then, if you have a location named Sleepy Hollow\nin play, draw a card.',
});
const alien = createCard({
  id: 'alien-true-believer',
  name: 'Alien',
  fullName: 'Alien - True Believer',
  ink: 'Emerald',
  text: 'WE ARE ONE This character gets +1 ¤ for each\nother Toy character you have in play.\nHE HAS BEEN CHOSEN During your turn, when\nthis character is banished, return another\ncharacter card named Alien from your discard to\nyour hand.',
});
const maximus = createCard({
  id: 'maximus-relentless-stallion',
  name: 'Maximus',
  fullName: 'Maximus - Relentless Stallion',
  ink: 'Steel',
  text: 'NO ESCAPE If you discarded a card this turn, this\ncharacter gains Challenger +2 and can challenge\nready characters this turn. (They get +2 ¤ while\nchallenging.)',
});
const megavolt = createCard({
  id: 'megavolt-electrical-menace',
  name: 'Megavolt',
  fullName: 'Megavolt - Electrical Menace',
  ink: 'Steel',
  text: 'FORCE FIELD While you have no cards in your\nhand, this character gains Resist +2. (Damage\ndealt to them is reduced by 2.)',
});

describe('Self-Discard scoring: an outlet feeds only the payoffs its discard can switch on', () => {
  const rule = getRuleById('self-discard')!;
  /** The pair's score with `card` as the searcher. */
  const score = (card: LorcanaCard, partner: LorcanaCard) =>
    rule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id)?.score;

  it('scores a song-only outlet 8 with song, action and any-card recursion', () => {
    expect(score(maxKaraoke, maxTeen)).toBe(8);
    expect(score(maxKaraoke, buzz)).toBe(8);
    expect(score(maxKaraoke, jiminy)).toBe(8);
  });

  it('scores a song-only outlet 5 with recursion its discard cannot supply', () => {
    expect(score(maxKaraoke, circleOfLife)).toBe(5);
    expect(score(circleOfLife, maxKaraoke)).toBe(5);
    expect(score(maxKaraoke, salvageOperation)).toBe(5);
    expect(score(maxKaraoke, lookWhatYouveDone)).toBe(5);
    expect(score(maxKaraoke, merida)).toBe(5);
  });

  it('lets any discard feed a discard-event payoff, but not a refill outlet feed an empty-hand one', () => {
    expect(score(maxKaraoke, maximus)).toBe(8);
    expect(score(maxKaraoke, megavolt)).toBe(5);
    expect(score(youBrokeMySmolder, megavolt)).toBe(8);
    expect(score(kronk, megavolt)).toBe(8);
  });

  it('scores a character-or-location outlet 8 with character, location and self-named recursion', () => {
    expect(score(sprout, getToSafety)).toBe(8);
    expect(score(sprout, circleOfLife)).toBe(8);
    expect(score(sprout, alien)).toBe(8);
    expect(score(sprout, megavolt)).toBe(8);
  });

  it('scores a character-or-location outlet 5 with item and song recursion', () => {
    expect(score(sprout, salvageOperation)).toBe(5);
    expect(score(sprout, maxTeen)).toBe(5);
  });
});
