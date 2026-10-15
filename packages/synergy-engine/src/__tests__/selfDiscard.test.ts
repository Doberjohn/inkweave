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
  id: 'mother-gothel-evil-as-ever',
  fullName: 'Mother Gothel - Evil as Ever',
  classifications: ['Storyborn', 'Villain'],
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
const rapunzelAndFlynn = createCard({
  id: 'rapunzel-flynn-unlikely-pair',
  name: 'Rapunzel & Flynn Rider',
  fullName: 'Rapunzel & Flynn Rider - Unlikely Pair',
  ink: 'Emerald',
  text: 'Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of one\nof your characters named Rapunzel or Flynn Rider.)\nCLEVER SWAP Whenever this character quests, you may\ndraw a card, then choose and discard a card.\nFRESH START During your turn, whenever you discard\na character card, you may play that character from your\ndiscard. (You pay all costs.)',
});

// Payoffs that take only one classification or kind of card.
const fangmeyer = createCard({
  id: 'fangmeyer-icy-officer',
  name: 'Fangmeyer',
  fullName: 'Fangmeyer - Icy Officer',
  text: 'REQUEST REINFORCEMENTS When you play this\ncharacter, you may return a Detective character\ncard from your discard to your hand.',
});
const drHamsterviel = createCard({
  id: 'dr-hamsterviel-infamous-scientist',
  name: 'Dr. Hamsterviel',
  fullName: 'Dr. Hamsterviel - Infamous Scientist',
  ink: 'Steel',
  text: "CONTROLLED VARIABLES For each Alien character\ncard in your discard, you pay 1 ⬡ less to play this\ncharacter.\nAWESTRUCK When you play this character,\nchosen opposing character can't challenge during\ntheir next turn.",
});
const coldstone = createCard({
  id: 'coldstone-reincarnated-cyborg',
  name: 'Coldstone',
  fullName: 'Coldstone - Reincarnated Cyborg',
  ink: 'Amethyst',
  text: 'THE CANTRIPS HAVE BEEN SPOKEN When you play\nthis character, if you have 2 or more Gargoyle\ncharacter cards in your discard, gain 2 lore.',
});
const priya = createCard({
  id: 'priya-serious-music-lover',
  name: 'Priya Mangal',
  fullName: 'Priya Mangal - Serious Music Lover',
  text: "THIS IS MY JAM When you play this character, if\nthere's a song card in your discard, gain 1 lore.",
});

// A mill: it puts cards into your discard without discarding them.
const hectorStreetMusician = createCard({
  id: 'hector-rivera-street-musician',
  name: 'Héctor Rivera',
  fullName: 'Héctor Rivera - Street Musician',
  ink: 'Ruby',
  text: 'Singer 2 (This character counts as cost 2 to sing songs.)\nSTRIKE A CHORD When you play this character, you\nmay put the top card of your deck into your discard.',
});

// An outlet that discards only as your turn ends, and payoffs that look before or at that point.
const meeko = createCard({
  id: 'meeko-skittish-scrounger',
  name: 'Meeko',
  fullName: 'Meeko - Skittish Scrounger',
  ink: 'Amethyst',
  text: 'Evasive (Only characters with Evasive can\nchallenge this character.)\nBOTTOMLESS PIT At the end of your turn, if this\ncharacter is exerted, choose and discard a card or\nbanish him.',
});
const helgaNoBackup = createCard({
  id: 'helga-no-backup-needed',
  name: 'Helga Sinclair',
  fullName: 'Helga Sinclair - No Backup Needed',
  ink: 'Emerald',
  text: 'CRISIS MANAGEMENT If 2 or more cards were put into your discard this turn, you pay 2 ⬡ less to play this character.',
});
const miloHandsDirty = createCard({
  id: 'milo-getting-his-hands-dirty',
  name: 'Milo Thatch',
  fullName: 'Milo Thatch - Getting His Hands Dirty',
  ink: 'Emerald',
  text: "Ward\nSCHOLAR'S GAMBIT When you play this character,\nyou may choose and discard a card to return chosen\ncharacter to their player's hand.\nPRACTICAL KNOWLEDGE At the end of your turn, if\n2 or more cards were put into your discard this turn,\ndraw a card.",
  textSections: [
    'Ward',
    "SCHOLAR'S GAMBIT When you play this character,\nyou may choose and discard a card to return chosen\ncharacter to their player's hand.",
    'PRACTICAL KNOWLEDGE At the end of your turn, if\n2 or more cards were put into your discard this turn,\ndraw a card.',
  ],
});

describe('Self-Discard scoring: an outlet feeds only the payoffs its discard can switch on', () => {
  const rule = getRuleById('self-discard')!;
  /** The pair's match with `card` as the searcher. */
  const match = (card: LorcanaCard, partner: LorcanaCard) =>
    rule.findSynergies(card, [card, partner]).find((s) => s.card.id === partner.id);
  /** The pair's score with `card` as the searcher. */
  const score = (card: LorcanaCard, partner: LorcanaCard) => match(card, partner)?.score;

  it('scores 8 when the recursion fires on the discard, 7 when the outlet only stocks the bin', () => {
    expect(score(kronk, gothel)).toBe(8);
    expect(score(gothel, kronk)).toBe(8);
    expect(score(kronk, lookWhatYouveDone)).toBe(8);
    expect(score(kronk, rapunzelAndFlynn)).toBe(8);
    expect(score(kronk, salvageOperation)).toBe(7);
    expect(score(salvageOperation, kronk)).toBe(7);
  });

  it('reads the outlet that feeds as the actor when both cards have one', () => {
    expect(match(rapunzelAndFlynn, kronk)).toMatchObject({
      score: 8,
      explanation: '{B} discards your own cards so {A} can replay them from the discard.',
    });
  });

  it('scores a song-only outlet 7 with song, action and any-card recursion', () => {
    expect(score(maxKaraoke, maxTeen)).toBe(7);
    expect(score(maxKaraoke, buzz)).toBe(7);
    expect(score(maxKaraoke, jiminy)).toBe(7);
  });

  it('scores a song-only outlet 5 with recursion its discard cannot supply', () => {
    expect(score(maxKaraoke, circleOfLife)).toBe(5);
    expect(score(circleOfLife, maxKaraoke)).toBe(5);
    expect(score(maxKaraoke, salvageOperation)).toBe(5);
    expect(score(maxKaraoke, lookWhatYouveDone)).toBe(5);
  });

  it('lets any discard feed a discard-event payoff, but not a refill outlet feed an empty-hand one', () => {
    expect(score(maxKaraoke, maximus)).toBe(8);
    expect(score(maxKaraoke, megavolt)).toBe(5);
    expect(score(youBrokeMySmolder, megavolt)).toBe(8);
    expect(score(kronk, megavolt)).toBe(8);
    expect(score(sprout, megavolt)).toBe(8);
  });

  it('lets a mill stock recursion, but not recursion that fires only on your discard', () => {
    expect(score(hectorStreetMusician, salvageOperation)).toBe(7);
    expect(score(hectorStreetMusician, gothel)).toBe(5);
    expect(score(lookWhatYouveDone, hectorStreetMusician)).toBe(5);
  });

  it('lets an end-of-turn outlet feed only the checks made as the turn ends', () => {
    expect(score(meeko, maximus)).toBe(5);
    expect(score(meeko, helgaNoBackup)).toBe(5);
    expect(score(meeko, miloHandsDirty)).toBe(6);
    expect(score(kronk, maximus)).toBe(8);
    expect(score(kronk, helgaNoBackup)).toBe(6);
  });

  it('scores a character-or-location outlet 7 with character and location recursion', () => {
    expect(score(sprout, getToSafety)).toBe(7);
    expect(score(sprout, circleOfLife)).toBe(7);
  });

  it('keeps an outlet for one classification to recursion that takes it', () => {
    expect(score(sprout, rapunzelAndFlynn)).toBe(8);
    expect(score(sprout, gothel)).toBe(5);
    expect(score(sprout, fangmeyer)).toBe(5);
  });

  it('scores a typed outlet 6 only with a pile count its discard adds to', () => {
    expect(score(sprout, drHamsterviel)).toBe(6);
    expect(score(sprout, coldstone)).toBe(5);
    expect(score(maxKaraoke, priya)).toBe(6);
    expect(score(maxKaraoke, drHamsterviel)).toBe(5);
    expect(score(kronk, coldstone)).toBe(6);
  });

  it('scores a character-or-location outlet 5 with item and song recursion', () => {
    expect(score(sprout, salvageOperation)).toBe(5);
    expect(score(sprout, maxTeen)).toBe(5);
  });
});

// Recursion or a pile check that names one card: only that card switches it on, and Named
// Companions already pairs the two.
const hook = createCard({
  fullName: 'Captain Hook - Captain of the Jolly Roger',
  text: 'DOUBLE THE POWDER! When you play this character, you may return an action card named Fire the Cannons! from your discard to your hand.',
});
const pain = createCard({
  fullName: 'Pain - Running with Scissors',
  text: 'MULTIPURPOSE TOOL When you play this character, if you have a character card named Panic in your discard, gain 2 lore.',
});

describe('Self-Discard roles: a clause that names one card', () => {
  it('reads no recursion from a clause that returns one named card', () => {
    expect(getSelfDiscardRoles(hook)).toEqual([]);
    expect(getSelfDiscardRoles(merida)).toEqual([]);
    expect(getSelfDiscardRoles(alien)).toEqual([]);
  });

  it('reads no pile check from a clause that looks for one named card', () => {
    expect(getSelfDiscardRoles(pain)).toEqual([]);
  });

  it('keeps recursion when a named card sits in another sentence', () => {
    expect(getSelfDiscardRoles(getToSafety)).toEqual(['reanimator']);
  });
});

// A sweep that moves cards from your discard to the bottom of your deck: no card comes back.
const mamaImelda = createCard({
  fullName: 'Mamá Imelda - No-Nonsense Ancestor',
  text: 'LET ME THROUGH When you play this character, put 3 cards from your discard on the bottom of your deck in any order or banish her.',
});
const bouncingDucky = createCard({
  fullName: "Bouncing Ducky - Sid's Toy",
  text: 'REJECTED TOYS For each Toy character card in your discard, you pay 1 ⬡ less to play this character.\nREPURPOSED When you play this character, put all Toy character cards from your discard on the bottom of your deck in any order.',
});
const handInTheBox = createCard({
  fullName: "Hand-in-the-Box - Sid's Toy",
  text: 'SPRING-LOADED You may put a Toy character card from your discard on the bottom of your deck to play this character for free.',
});

describe('Self-Discard roles: a sweep from the discard to the bottom of the deck', () => {
  it('reads no recursion from a sweep the card must make', () => {
    expect(getSelfDiscardRoles(mamaImelda)).toEqual([]);
    expect(getSelfDiscardRoles(bouncingDucky)).toEqual(['zone-payoff']);
  });

  it('keeps an optional sweep the card pays as a cost', () => {
    expect(getSelfDiscardRoles(handInTheBox)).toEqual(['reanimator']);
  });
});
